-- Phase 11: ML Retraining Pipeline Automation
-- Tables: dataset_versions, training_runs, model_versions, drift_daily
-- Contracts: SNAPPICK_BUILD_GUIDE.md section 5.4, SNAPPICK_PLAN.md section 10

-- -----------------------------------------------------------------------------
-- 1. dataset_versions
-- -----------------------------------------------------------------------------
create table if not exists public.dataset_versions (
  id                    uuid primary key default gen_random_uuid(),
  version               text unique not null,
  manifest_hash         text not null,
  sample_count          integer not null default 0,
  per_class_counts      jsonb not null default '{}'::jsonb,
  per_tier_counts       jsonb not null default '{}'::jsonb,
  source_mix            jsonb not null default '{}'::jsonb,
  license_notes         text,
  is_golden_set         boolean not null default false,
  manifest_storage_path text,
  created_at            timestamptz not null default now()
);

create index if not exists dataset_versions_created_idx
  on public.dataset_versions (created_at desc);

-- -----------------------------------------------------------------------------
-- 2. training_runs
-- -----------------------------------------------------------------------------
create table if not exists public.training_runs (
  id                    uuid primary key default gen_random_uuid(),
  run_id                text unique not null,
  trigger_reason        text not null,
  status                text not null default 'queued'
                          check (status in ('queued', 'running', 'completed', 'failed', 'rejected', 'passed')),
  dataset_version_id    uuid references public.dataset_versions(id) on delete set null,
  dataset_version       text,
  config_hash           text not null,
  git_commit            text not null,
  ultralytics_version   text,
  champion_version      text,
  metrics               jsonb not null default '{}'::jsonb,
  gate_result           jsonb not null default '{}'::jsonb,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index if not exists training_runs_status_idx
  on public.training_runs (status, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. model_versions
-- -----------------------------------------------------------------------------
create table if not exists public.model_versions (
  id                    uuid primary key default gen_random_uuid(),
  version               text unique not null,
  role                  text not null default 'candidate'
                          check (role in ('bundled_fallback', 'champion', 'candidate', 'archived')),
  status                text not null default 'candidate'
                          check (status in ('candidate', 'approved', 'rolling_out', 'stable', 'rejected', 'rolled_back')),
  training_run_id       uuid references public.training_runs(id) on delete set null,
  dataset_version_id    uuid references public.dataset_versions(id) on delete set null,
  sha256                text not null,
  size_bytes            bigint not null,
  storage_path          text not null,
  metrics               jsonb not null default '{}'::jsonb,
  thresholds            jsonb not null default '{"default": {"confident": 0.8, "uncertain": 0.4}, "per_class": {}}'::jsonb,
  min_app_version       text not null default '1.0.0',
  rollout_percent       integer not null default 0
                          check (rollout_percent >= 0 and rollout_percent <= 100),
  manifest              jsonb not null default '{}'::jsonb,
  model_card            text,
  rejection_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists model_versions_status_idx
  on public.model_versions (status, rollout_percent);

-- -----------------------------------------------------------------------------
-- 4. drift_daily
-- -----------------------------------------------------------------------------
create table if not exists public.drift_daily (
  id                    uuid primary key default gen_random_uuid(),
  date                  date not null default current_date,
  model_version         text not null,
  mean_top_score        double precision,
  uncertain_share       double precision,
  correction_rate_by_class jsonb not null default '{}'::jsonb,
  collector_mismatch_rate double precision,
  mean_preprocess_ms    double precision,
  mean_inference_ms     double precision,
  sample_count          integer not null default 0,
  created_at            timestamptz not null default now(),
  unique (date, model_version)
);

create index if not exists drift_daily_date_idx
  on public.drift_daily (date desc, model_version);

-- -----------------------------------------------------------------------------
-- 5. Seed M0 Baseline Bundled Fallback into model_versions
-- -----------------------------------------------------------------------------
insert into public.model_versions (
  version,
  role,
  status,
  sha256,
  size_bytes,
  storage_path,
  min_app_version,
  rollout_percent,
  manifest,
  metrics
)
values (
  'v0',
  'bundled_fallback',
  'stable',
  'ffb5240658fdffabbf27ee5de6a9cc33c27a20882467723a0f4771a41468dd7d',
  12705251,
  'models/v0/snappick_det_v0.tflite',
  '1.0.0',
  100,
  jsonb_build_object(
    'version', 'v0',
    'file', 'snappick_det_v0.tflite',
    'sha256', 'ffb5240658fdffabbf27ee5de6a9cc33c27a20882467723a0f4771a41468dd7d',
    'framework', jsonb_build_object('name', 'ultralytics', 'version', '8.4.173'),
    'role', 'bundled_fallback',
    'input', jsonb_build_object('width', 384, 'height', 384, 'layout', 'NCHW', 'dtype', 'float32', 'normalize', '0-1', 'resize', 'centre_crop'),
    'output', jsonb_build_object('format', 'yolo_raw', 'shape', jsonb_build_array(1, 11, 3024), 'layout', 'attributes_first', 'box_format', 'cx,cy,w,h', 'box_units', 'normalised', 'postprocess_in_model', false),
    'nms', jsonb_build_object('iou', 0.5, 'max_boxes', 30),
    'labels', jsonb_build_array('metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'),
    'thresholds', jsonb_build_object('default', jsonb_build_object('confident', 0.8, 'uncertain', 0.4), 'per_class', jsonb_build_object()),
    'min_app_version', '1.0.0',
    'dataset_version', 'temporary-kaggle-sumn2u-garbage-classification-v2-bbox-384-unverified'
  ),
  jsonb_build_object(
    'map50', null,
    'model_size_bytes', 12705251
  )
)
on conflict (version) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.dataset_versions enable row level security;

alter table public.training_runs enable row level security;

alter table public.model_versions enable row level security;

alter table public.drift_daily enable row level security;

-- Admin policies
create policy dataset_versions_admin_all on public.dataset_versions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy training_runs_admin_all on public.training_runs
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy model_versions_admin_all on public.model_versions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy drift_daily_admin_all on public.drift_daily
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Read policies for clients and public dashboard
-- Authenticated users (mobile app) can read non-rejected models to check rollout
create policy model_versions_authenticated_select on public.model_versions
  for select to authenticated
  using (status in ('approved', 'rolling_out', 'stable', 'candidate'));

-- Public / anon users can read approved/stable models and daily drift for the dashboard transparency tab
create policy model_versions_anon_select on public.model_versions
  for select to anon
  using (status in ('approved', 'rolling_out', 'stable'));

create policy drift_daily_select_all on public.drift_daily
  for select to authenticated, anon
  using (true);

-- -----------------------------------------------------------------------------
-- 7. RPC Helper: Trigger Statistics
-- -----------------------------------------------------------------------------
create or replace function public.get_ml_retraining_trigger_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_trusted_count   integer := 0;
  v_weakest_class       text := null;
  v_weakest_count       integer := 0;
  v_corrections_7d      integer := 0;
  v_scans_7d            integer := 0;
  v_correction_rate     double precision := 0.0;
  v_last_run_time       timestamptz := null;
  v_days_since_last_run double precision := null;
  v_min_interval_met    boolean := false;
  v_threshold_new_images integer := 200;
  v_threshold_weak_instances integer := 30;
  v_threshold_correction_rate double precision := 0.15;
  v_should_trigger      boolean := false;
  v_trigger_reasons     text[] := array[]::text[];
begin
  -- 1. Count new trusted samples (Tier A or B) with uploaded images
  select count(distinct fs.id) into v_new_trusted_count
  from public.feedback_samples fs
  join public.scans s on s.id = fs.scan_id
  where fs.label_tier in ('A', 'B')
    and fs.training_opt_in = true
    and s.image_storage_consent = true
    and s.image_path is not null;

  -- 2. Find weakest class instances among trusted samples
  with class_counts as (
    select d.model_label as label, count(*) as cnt
    from public.detections d
    join public.feedback_samples fs on fs.scan_id = d.scan_id
    join public.scans s on s.id = fs.scan_id
    where fs.label_tier in ('A', 'B')
      and fs.training_opt_in = true
      and s.image_storage_consent = true
      and d.model_label is not null
    group by d.model_label
  )
  select label, cnt into v_weakest_class, v_weakest_count
  from class_counts
  order by cnt asc
  limit 1;

  -- 3. Compute 7-day correction rate
  select count(*) into v_corrections_7d
  from public.label_feedback lf
  where lf.feedback_type in ('change_label', 'remove')
    and lf.created_at >= now() - interval '7 days';

  select count(*) into v_scans_7d
  from public.scans s
  where s.created_at >= now() - interval '7 days';

  if v_scans_7d > 0 then
    v_correction_rate := v_corrections_7d::double precision / v_scans_7d::double precision;
  else
    v_correction_rate := 0.0;
  end if;

  -- 4. Check time since last completed/passed/queued training run
  select max(created_at) into v_last_run_time
  from public.training_runs
  where status in ('completed', 'passed', 'running', 'queued');

  if v_last_run_time is not null then
    v_days_since_last_run := extract(epoch from (now() - v_last_run_time)) / 86400.0;
    v_min_interval_met := (v_days_since_last_run >= 7.0);
  else
    v_days_since_last_run := null;
    v_min_interval_met := true; -- No previous run: guard passes
  end if;

  -- 5. Check trigger conditions
  if v_new_trusted_count >= v_threshold_new_images then
    v_trigger_reasons := array_append(v_trigger_reasons, 'new_trusted_images_threshold_met');
  end if;

  if v_weakest_count >= v_threshold_weak_instances then
    v_trigger_reasons := array_append(v_trigger_reasons, 'weakest_class_instances_threshold_met');
  end if;

  if v_correction_rate >= v_threshold_correction_rate and v_scans_7d >= 10 then
    v_trigger_reasons := array_append(v_trigger_reasons, 'correction_rate_drift_threshold_met');
  end if;

  if array_length(v_trigger_reasons, 1) > 0 and v_min_interval_met then
    v_should_trigger := true;
  end if;

  return jsonb_build_object(
    'new_trusted_samples_count', v_new_trusted_count,
    'weakest_class', v_weakest_class,
    'weakest_class_instances_count', v_weakest_count,
    'corrections_7d_count', v_corrections_7d,
    'scans_7d_count', v_scans_7d,
    'correction_rate_7d', v_correction_rate,
    'days_since_last_run', v_days_since_last_run,
    'min_interval_days', 7,
    'min_interval_met', v_min_interval_met,
    'should_trigger', v_should_trigger,
    'trigger_reasons', to_jsonb(v_trigger_reasons)
  );
end;
$$;

revoke all on function public.get_ml_retraining_trigger_stats() from public, anon;

grant execute on function public.get_ml_retraining_trigger_stats() to authenticated;
