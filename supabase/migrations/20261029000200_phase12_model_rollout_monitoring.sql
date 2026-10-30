-- Phase 12: Model delivery, rollout, and monitoring
-- Implements:
-- 1. Daily drift computation SQL function (compute_drift_daily) and pg_cron schedule
-- 2. Admin helpers (admin_approve_model_version, admin_rollback_model_version) writing to audit_log
-- 3. Staged rollout helper (get_eligible_model_for_user)

-- -----------------------------------------------------------------------------
-- 1. Drift Daily Computation Function
-- -----------------------------------------------------------------------------
create or replace function public.compute_drift_daily(p_target_date date default current_date)
returns setof public.drift_daily
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_inserted public.drift_daily;
begin
  -- Aggregate per model_version for scans occurring on p_target_date
  for v_rec in
    with date_scans as (
      select
        s.id as scan_id,
        s.model_version,
        s.preprocess_ms,
        s.inference_ms
      from public.scans s
      where s.created_at::date = p_target_date
    ),
    scan_metrics as (
      select
        ds.model_version,
        count(distinct ds.scan_id) as sample_count,
        coalesce(avg(ds.preprocess_ms), 0)::double precision as mean_preprocess_ms,
        coalesce(avg(ds.inference_ms), 0)::double precision as mean_inference_ms
      from date_scans ds
      group by ds.model_version
    ),
    det_metrics as (
      select
        ds.model_version,
        coalesce(avg(d.score), 0)::double precision as mean_top_score,
        coalesce(
          count(*) filter (where d.score >= 0.40 and d.score < 0.80)::double precision /
          nullif(count(*), 0)::double precision,
          0
        )::double precision as uncertain_share
      from date_scans ds
      join public.detections d on d.scan_id = ds.scan_id
      where d.source = 'detector'
      group by ds.model_version
    ),
    feedback_per_class as (
      select
        ds.model_version,
        jsonb_object_agg(
          class_counts.label,
          case
            when class_counts.total_count = 0 then 0.0
            else round((coalesce(class_counts.corrected_count, 0)::numeric / class_counts.total_count::numeric), 4)::double precision
          end
        ) as correction_rate_by_class
      from (
        select
          ds.model_version,
          d.model_label as label,
          count(d.id) as total_count,
          count(lf.id) filter (where lf.feedback_type in ('change_label', 'remove')) as corrected_count
        from date_scans ds
        join public.detections d on d.scan_id = ds.scan_id and d.source = 'detector'
        left join public.label_feedback lf on lf.scan_id = ds.scan_id and lf.original_model_label = d.model_label
        group by ds.model_version, d.model_label
      ) class_counts
      join date_scans ds on ds.model_version = class_counts.model_version
      group by ds.model_version
    ),
    collector_metrics as (
      select
        ds.model_version,
        coalesce(
          count(*) filter (where fs.collector_count_match = false)::double precision /
          nullif(count(*) filter (where fs.collector_count_match is not null), 0)::double precision,
          0
        )::double precision as collector_mismatch_rate
      from date_scans ds
      left join public.feedback_samples fs on fs.scan_id = ds.scan_id
      group by ds.model_version
    )
    select
      sm.model_version,
      p_target_date as record_date,
      coalesce(dm.mean_top_score, 0)::double precision as mean_top_score,
      coalesce(dm.uncertain_share, 0)::double precision as uncertain_share,
      coalesce(fpc.correction_rate_by_class, '{}'::jsonb) as correction_rate_by_class,
      coalesce(cm.collector_mismatch_rate, 0)::double precision as collector_mismatch_rate,
      sm.mean_preprocess_ms,
      sm.mean_inference_ms,
      sm.sample_count::integer as sample_count
    from scan_metrics sm
    left join det_metrics dm on dm.model_version = sm.model_version
    left join feedback_per_class fpc on fpc.model_version = sm.model_version
    left join collector_metrics cm on cm.model_version = sm.model_version
  loop
    insert into public.drift_daily (
      date,
      model_version,
      mean_top_score,
      uncertain_share,
      correction_rate_by_class,
      collector_mismatch_rate,
      mean_preprocess_ms,
      mean_inference_ms,
      sample_count,
      created_at
    ) values (
      v_rec.record_date,
      v_rec.model_version,
      v_rec.mean_top_score,
      v_rec.uncertain_share,
      v_rec.correction_rate_by_class,
      v_rec.collector_mismatch_rate,
      v_rec.mean_preprocess_ms,
      v_rec.mean_inference_ms,
      v_rec.sample_count,
      now()
    )
    on conflict (date, model_version) do update set
      mean_top_score = excluded.mean_top_score,
      uncertain_share = excluded.uncertain_share,
      correction_rate_by_class = excluded.correction_rate_by_class,
      collector_mismatch_rate = excluded.collector_mismatch_rate,
      mean_preprocess_ms = excluded.mean_preprocess_ms,
      mean_inference_ms = excluded.mean_inference_ms,
      sample_count = excluded.sample_count,
      created_at = now()
    returning * into v_inserted;

    return next v_inserted;
  end loop;

  return;
end;
$$;

grant execute on function public.compute_drift_daily(date) to authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- 2. Daily Cron Job (pg_cron)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove any prior schedule with the same name if exists
    begin
      perform cron.unschedule('compute-daily-drift-job');
    exception when others then null;
    end;

    perform cron.schedule(
      'compute-daily-drift-job',
      '15 0 * * *',
      'select public.compute_drift_daily(current_date - 1);'
    );
  end if;
exception when others then
  raise notice 'pg_cron not available or schedule failed: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Admin Helpers: Approve & Rollback
-- -----------------------------------------------------------------------------

create or replace function public.admin_approve_model_version(
  p_version text,
  p_rollout_percent integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model_id uuid;
  v_current_status text;
  v_new_status text;
  v_new_role text;
begin
  if not (public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Admin privileges required';
  end if;

  if p_rollout_percent < 0 or p_rollout_percent > 100 then
    raise exception 'Invalid rollout_percent: must be between 0 and 100';
  end if;

  select id, status into v_model_id, v_current_status
  from public.model_versions
  where version = p_version;

  if v_model_id is null then
    raise exception 'Model version % not found', p_version;
  end if;

  if p_rollout_percent = 100 then
    v_new_status := 'stable';
    v_new_role := 'champion';

    -- Demote other champion models to archived (or bundled_fallback if v0)
    update public.model_versions
    set
      role = case when version = 'v0' then 'bundled_fallback' else 'archived' end,
      status = case when version = 'v0' then 'stable' else 'approved' end
    where version <> p_version and role = 'champion';

  elsif p_rollout_percent > 0 then
    v_new_status := 'rolling_out';
    v_new_role := 'candidate';
  else
    v_new_status := 'approved';
    v_new_role := 'candidate';
  end if;

  update public.model_versions
  set
    status = v_new_status,
    role = v_new_role,
    rollout_percent = p_rollout_percent,
    updated_at = now()
  where id = v_model_id;

  -- Record in audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    auth.uid(),
    'model_approved',
    'model_versions',
    v_model_id,
    jsonb_build_object(
      'version', p_version,
      'previous_status', v_current_status,
      'new_status', v_new_status,
      'rollout_percent', p_rollout_percent,
      'role', v_new_role
    )
  );

  return jsonb_build_object(
    'success', true,
    'version', p_version,
    'status', v_new_status,
    'rollout_percent', p_rollout_percent,
    'role', v_new_role
  );
end;
$$;

grant execute on function public.admin_approve_model_version(text, integer) to authenticated, service_role;

create or replace function public.admin_rollback_model_version(
  p_version text,
  p_reason text default 'manual rollback'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model_id uuid;
  v_restored_version text := 'v0';
begin
  if not (public.is_admin() or auth.role() = 'service_role' or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Admin privileges required';
  end if;

  select id into v_model_id
  from public.model_versions
  where version = p_version;

  if v_model_id is null then
    raise exception 'Model version % not found', p_version;
  end if;

  -- Mark target version as rolled back with 0 rollout
  update public.model_versions
  set
    status = 'rolled_back',
    rollout_percent = 0,
    role = case when version = 'v0' then 'bundled_fallback' else 'archived' end,
    updated_at = now()
  where id = v_model_id;

  -- Restore bundled baseline v0 or prior champion
  update public.model_versions
  set
    status = 'stable',
    role = 'champion',
    rollout_percent = 100,
    updated_at = now()
  where version = 'v0';

  -- Record in audit log
  insert into public.audit_log (
    actor_id,
    action,
    table_name,
    record_id,
    metadata
  ) values (
    auth.uid(),
    'model_rolled_back',
    'model_versions',
    v_model_id,
    jsonb_build_object(
      'version', p_version,
      'reason', p_reason,
      'restored_version', v_restored_version
    )
  );

  return jsonb_build_object(
    'success', true,
    'rolled_back_version', p_version,
    'reason', p_reason,
    'restored_version', v_restored_version
  );
end;
$$;

grant execute on function public.admin_rollback_model_version(text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. User Rollout Bucket & Model Eligibility RPC
-- -----------------------------------------------------------------------------

create or replace function public.compute_user_rollout_bucket(p_user_id uuid)
returns integer
language sql
immutable
as $$
  -- Deterministic 0..99 bucket based on 32-bit integer conversion of md5 hash
  select abs(('x' || substr(md5(p_user_id::text), 1, 8))::bit(32)::integer) % 100;
$$;

grant execute on function public.compute_user_rollout_bucket(uuid) to authenticated, anon, service_role;

create or replace function public.get_eligible_model_for_user(
  p_user_id uuid default auth.uid()
)
returns table (
  version text,
  role text,
  status text,
  sha256 text,
  size_bytes bigint,
  storage_path text,
  thresholds jsonb,
  min_app_version text,
  rollout_percent integer,
  user_bucket integer,
  is_eligible boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket integer;
begin
  if p_user_id is null then
    v_bucket := 0;
  else
    v_bucket := public.compute_user_rollout_bucket(p_user_id);
  end if;

  return query
  select
    mv.version,
    mv.role,
    mv.status,
    mv.sha256,
    mv.size_bytes,
    mv.storage_path,
    mv.thresholds,
    mv.min_app_version,
    mv.rollout_percent,
    v_bucket as user_bucket,
    (mv.status in ('approved', 'rolling_out', 'stable') and v_bucket < mv.rollout_percent) as is_eligible
  from public.model_versions mv
  where mv.status in ('approved', 'rolling_out', 'stable')
  order by
    -- Stable champion first, then newest approved rolling out
    case when mv.role = 'champion' and mv.rollout_percent = 100 then 0 else 1 end,
    mv.created_at desc;
end;
$$;

grant execute on function public.get_eligible_model_for_user(uuid) to authenticated, anon, service_role;
