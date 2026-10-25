-- Phase 10: Feedback capture, active-learning upload queue, and Home statistics.
-- All schema changes are additive; no applied migration is modified.

-- ──────────────────────────────────────────────────────────
-- 1. feedback_samples: add active-learning tracking columns
-- ──────────────────────────────────────────────────────────
alter table public.feedback_samples
  add column if not exists selection_reason text
    check (selection_reason is null or selection_reason in ('uncertain', 'corrected', 'mismatch', 'random_5pct')),
  add column if not exists upload_selected boolean not null default false,
  add column if not exists upload_selected_at timestamptz,
  add column if not exists daily_cap_date date,
  add column if not exists upload_status text not null default 'not_selected'
    check (upload_status in ('not_selected', 'queued', 'uploading', 'done', 'failed', 'skipped'));

-- One row per scan (upsert target in app code).
create unique index if not exists feedback_samples_scan_unique
  on public.feedback_samples (scan_id);

-- ──────────────────────────────────────────────────────────
-- 2. RLS fix: users need insert/update for their own scan rows
--    (was admin-only in Phase 2 to block direct writes;
--     Phase 10 writes through an RPC-equivalent upsert via service role,
--     but the app also needs select on its own feedback_samples rows)
-- ──────────────────────────────────────────────────────────
-- Default user_id to auth.uid() on label_feedback so authenticated clients do not need to provide it explicitly.
alter table public.label_feedback
  alter column user_id set default auth.uid();

drop policy if exists feedback_samples_admin on public.feedback_samples;
drop policy if exists feedback_samples_select_own on public.feedback_samples;
drop policy if exists feedback_samples_insert_own on public.feedback_samples;
drop policy if exists feedback_samples_admin_all on public.feedback_samples;

-- Owners can read and insert their own feedback_samples rows.
-- Updates (tier promotion, count-match, upload status) go through
-- RPCs / service-role functions, not direct client writes.
create policy feedback_samples_select_own on public.feedback_samples
  for select to authenticated
  using (
    exists (
      select 1 from public.scans s
      where s.id = scan_id and (s.user_id = auth.uid() or public.is_admin())
    )
  );

create policy feedback_samples_insert_own on public.feedback_samples
  for insert to authenticated
  with check (
    exists (
      select 1 from public.scans s
      where s.id = scan_id and s.user_id = auth.uid()
    )
  );

-- Admins retain full access for review workflow.
create policy feedback_samples_admin_all on public.feedback_samples
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ──────────────────────────────────────────────────────────
-- 3. Durable offline upload-queue metadata table
--    (in-app queue uses AsyncStorage; this table mirrors state
--     server-side for idempotency and cap enforcement)
-- ──────────────────────────────────────────────────────────
create table if not exists public.scan_upload_queue (
  id         uuid primary key default gen_random_uuid(),
  scan_id    uuid not null references public.scans(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending'
               check (status in ('pending', 'queued', 'uploading', 'done', 'failed', 'skipped')),
  attempts   integer not null default 0 check (attempts >= 0),
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (scan_id)
);

create index if not exists upload_queue_user_status_idx
  on public.scan_upload_queue (user_id, status, created_at);

alter table public.scan_upload_queue enable row level security;

drop policy if exists upload_queue_own on public.scan_upload_queue;

create policy upload_queue_own on public.scan_upload_queue
  for all to authenticated
  using  (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- ──────────────────────────────────────────────────────────
-- 4. Home statistics RPC
--    Returns counts for the calling user only.
--    No private addresses, exact coordinates, or other users' data.
-- ──────────────────────────────────────────────────────────
create or replace function public.get_home_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor           uuid := auth.uid();
  total_scans     integer;
  verified_items  integer;
  active_requests integer;
  recent_rows     jsonb;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  -- Total scans owned by this user.
  select count(*) into total_scans
  from public.scans s
  where s.user_id = actor;

  -- Verified recyclable items: sum of collector_quantity where the pickup
  -- is completed and the item was collected (quantity > 0).
  -- Only classes that are not 'trash' or 'biological' (the reject labels).
  -- This is a conservative definition: collector-confirmed, completed pickups only.
  select coalesce(sum(w.collector_quantity), 0) into verified_items
  from public.pickup_waste_items w
  join public.pickup_requests_public r on r.id = w.request_id
  where r.requester_id = actor
    and r.status = 'completed'
    and coalesce(w.collector_quantity, 0) > 0
    and w.app_class not in ('trash', 'biological');

  -- Active pickup requests for this user.
  select count(*) into active_requests
  from public.pickup_requests_public r
  where r.requester_id = actor
    and r.status in ('pending', 'accepted', 'in_progress', 'awaiting_confirmation');

  -- Recent scans (last 5) — scan id and timestamp only (no image path, no private data).
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',         s.id,
        'created_at', s.created_at,
        'item_count', (
          select count(*) from public.detections d
          where d.scan_id = s.id and d.source = 'detector'
        )
      )
      order by s.created_at desc
    ),
    '[]'::jsonb
  ) into recent_rows
  from (
    select s.id, s.created_at
    from public.scans s
    where s.user_id = actor
    order by s.created_at desc
    limit 5
  ) s;

  return jsonb_build_object(
    'total_scans',         total_scans,
    'verified_recyclable_items', verified_items,
    'active_requests',     active_requests,
    'recent_scans',        recent_rows
  );
end;
$$;

revoke all on function public.get_home_stats() from public, anon;

grant execute on function public.get_home_stats() to authenticated;

-- ──────────────────────────────────────────────────────────
-- 5. Collector-count comparison function
--    Called after submit_collection completes for a request.
--    Compares detector class totals (from detections) with
--    collector-verified totals (from pickup_waste_items).
--    Updates feedback_samples.collector_count_match and
--    promotes tier D→B where counts match and training is opted in.
-- ──────────────────────────────────────────────────────────
create or replace function public.update_collector_count_match(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor        uuid := auth.uid();
  req          public.pickup_requests_public%rowtype;
  scan_rec     record;
  counts_match boolean;
  det_class    text;
  det_count    integer;
  col_count    integer;
begin
  if actor is not null then
    select r.* into req
    from public.pickup_requests_public r
    where r.id = p_request_id
      and (r.requester_id = actor or r.collector_id = actor or public.is_admin());
  else
    select r.* into req
    from public.pickup_requests_public r
    where r.id = p_request_id;
  end if;

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_FOUND';
  end if;

  -- For each scan associated with this request's requester,
  -- attempt a class-level count comparison with the collector results.
  -- Scans are linked by requester_id matching the request's requester_id
  -- and created before the request was submitted.
  for scan_rec in
    select distinct s.id as scan_id, s.user_id, s.training_opt_in
    from public.scans s
    where s.user_id = req.requester_id
      and s.created_at <= coalesce(req.submitted_at, req.created_at, now()) + interval '10 seconds'
      and exists (
        select 1 from public.feedback_samples fs
        where fs.scan_id = s.id and fs.review_status = 'pending'
      )
    order by s.created_at desc
    limit 1  -- most recent scan before submission
  loop
    counts_match := true;

    -- Compare per-class totals between detector and collector.
    for det_class, det_count in
      select d.app_class, count(*)::integer
      from public.detections d
      where d.scan_id = scan_rec.scan_id
        and d.source = 'detector'
      group by d.app_class
    loop
      select coalesce(sum(w.collector_quantity), 0) into col_count
      from public.pickup_waste_items w
      where w.request_id = p_request_id
        and w.app_class = det_class
        and coalesce(w.collector_quantity, 0) > 0;

      if col_count <> det_count then
        counts_match := false;
        exit;
      end if;
    end loop;

    -- Also check reverse: any collector class not in detector?
    if counts_match then
      for det_class in
        select w.app_class
        from public.pickup_waste_items w
        where w.request_id = p_request_id
          and coalesce(w.collector_quantity, 0) > 0
          and not exists (
            select 1 from public.detections d
            where d.scan_id = scan_rec.scan_id
              and d.source = 'detector'
              and d.app_class = w.app_class
          )
      loop
        counts_match := false;
        exit;
      end loop;
    end if;

    -- Update the feedback_samples row for this scan.
    update public.feedback_samples fs
    set collector_count_match = counts_match,
        -- If counts mismatch, mark selection_reason for active learning if not already set
        selection_reason = case
          when not counts_match and fs.selection_reason is null then 'mismatch'
          else fs.selection_reason
        end,
        -- Promote D→B when: counts match, training opted in, no prior correction.
        label_tier = case
          when counts_match
               and scan_rec.training_opt_in
               and fs.label_tier = 'D'
          then 'B'
          else fs.label_tier
        end
    where fs.scan_id = scan_rec.scan_id;
  end loop;
end;
$$;

revoke all on function public.update_collector_count_match(uuid) from public, anon;

grant execute on function public.update_collector_count_match(uuid) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 6. Server-side daily upload cap check
--    Returns how many uploads the user can still do today.
--    Default cap: 20 per user per UTC day.
--    Cap is enforced by checking scan_upload_queue.
-- ──────────────────────────────────────────────────────────
create or replace function public.check_daily_upload_cap(p_cap integer default 20)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  actor    uuid := auth.uid();
  today    date := current_date;
  used     integer;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select count(*) into used
  from public.scan_upload_queue q
  where q.user_id = actor
    and q.status in ('done', 'uploading', 'queued', 'pending')
    and q.created_at::date = today;

  return greatest(0, p_cap - used);
end;
$$;

revoke all on function public.check_daily_upload_cap(integer) from public, anon;

grant execute on function public.check_daily_upload_cap(integer) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 7. Idempotent scan upsert RPC
--    The client generates a scan UUID. If the same UUID is
--    retried (network error after server write), the existing
--    row is returned without creating a duplicate.
-- ──────────────────────────────────────────────────────────
create or replace function public.upsert_scan(
  p_scan_id          uuid,
  p_model_version    text,
  p_rule_set_id      uuid,
  p_rule_set_version integer,
  p_image_storage_consent boolean,
  p_training_opt_in  boolean,
  p_image_width      integer,
  p_image_height     integer,
  p_preprocess_ms    integer,
  p_inference_ms     integer,
  p_retention_days   integer default 90
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;
  if p_scan_id is null then
    raise exception using errcode = '22023', message = 'SCAN_ID_REQUIRED';
  end if;

  insert into public.scans (
    id, user_id, model_version, rule_set_id, rule_set_version,
    image_storage_consent, training_opt_in,
    image_width, image_height,
    preprocess_ms, inference_ms,
    retention_date
  ) values (
    p_scan_id, actor, p_model_version, p_rule_set_id, p_rule_set_version,
    p_image_storage_consent, p_training_opt_in,
    p_image_width, p_image_height,
    p_preprocess_ms, p_inference_ms,
    now() + (p_retention_days || ' days')::interval
  )
  on conflict (id) do nothing;

  return p_scan_id;
end;
$$;

revoke all on function public.upsert_scan(uuid, text, uuid, integer, boolean, boolean, integer, integer, integer, integer, integer) from public, anon;

grant execute on function public.upsert_scan(uuid, text, uuid, integer, boolean, boolean, integer, integer, integer, integer, integer) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 8. Batch detection upsert RPC
--    Called once per scan. Skips rows that already exist
--    (retry-safe via on conflict do nothing on scan_id + ordering).
-- ──────────────────────────────────────────────────────────
create or replace function public.upsert_detections(
  p_scan_id   uuid,
  p_detections jsonb  -- array of detection objects
)
returns integer  -- number of rows inserted (0 on retry)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor  uuid := auth.uid();
  det    jsonb;
  n      integer := 0;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  -- Validate scan ownership.
  if not exists (
    select 1 from public.scans s
    where s.id = p_scan_id and s.user_id = actor
  ) then
    raise exception using errcode = 'P0001', message = 'SCAN_NOT_FOUND';
  end if;

  if jsonb_typeof(p_detections) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'DETECTIONS_MUST_BE_ARRAY';
  end if;

  for det in select value from jsonb_array_elements(p_detections) loop
    insert into public.detections (
      id, scan_id,
      model_label, app_class,
      score, second_best_label, second_best_score,
      box_x1, box_y1, box_x2, box_y2,
      source, condition, eligibility, quantity
    ) values (
      coalesce((det->>'id')::uuid, gen_random_uuid()),
      p_scan_id,
      det->>'model_label',
      det->>'app_class',
      (det->>'score')::numeric,
      det->>'second_best_label',
      (det->>'second_best_score')::numeric,
      (det->>'box_x1')::numeric,
      (det->>'box_y1')::numeric,
      (det->>'box_x2')::numeric,
      (det->>'box_y2')::numeric,
      coalesce(det->>'source', 'detector'),
      coalesce(det->>'condition', 'unknown')::public.condition_state,
      coalesce(det->>'eligibility', 'needs_confirmation'),
      coalesce((det->>'quantity')::integer, 1)
    )
    on conflict (id) do nothing;

    if found then n := n + 1; end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.upsert_detections(uuid, jsonb) from public, anon;

grant execute on function public.upsert_detections(uuid, jsonb) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 9. Upsert feedback_samples row for a scan
--    Called by the app after persist; updates tier/status later.
-- ──────────────────────────────────────────────────────────
create or replace function public.upsert_feedback_sample(
  p_scan_id         uuid,
  p_label_tier      text,
  p_training_opt_in boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  out_id uuid;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if not exists (
    select 1 from public.scans s where s.id = p_scan_id and s.user_id = actor
  ) then
    raise exception using errcode = 'P0001', message = 'SCAN_NOT_FOUND';
  end if;

  if p_label_tier not in ('A', 'B', 'C', 'D') then
    raise exception using errcode = '22023', message = 'INVALID_LABEL_TIER';
  end if;

  insert into public.feedback_samples (
    scan_id, label_tier, review_status, training_opt_in
  ) values (
    p_scan_id, p_label_tier, 'pending', p_training_opt_in
  )
  on conflict (scan_id) do update
    set label_tier      = excluded.label_tier,
        training_opt_in = excluded.training_opt_in
  returning id into out_id;

  return out_id;
end;
$$;

revoke all on function public.upsert_feedback_sample(uuid, text, boolean) from public, anon;

grant execute on function public.upsert_feedback_sample(uuid, text, boolean) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 10. Update feedback_sample tier when user makes a correction
--     (D→C or B→C).  Called from label_feedback insert path.
-- ──────────────────────────────────────────────────────────
create or replace function public.promote_feedback_sample_to_c(p_scan_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  update public.feedback_samples fs
  set label_tier = 'C'
  where fs.scan_id = p_scan_id
    and fs.label_tier in ('D', 'B')
    and exists (
      select 1 from public.scans s
      where s.id = fs.scan_id and s.user_id = actor
    );
end;
$$;

revoke all on function public.promote_feedback_sample_to_c(uuid) from public, anon;

grant execute on function public.promote_feedback_sample_to_c(uuid) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 11. Update image_path on a scan after successful upload
-- ──────────────────────────────────────────────────────────
create or replace function public.set_scan_image_path(
  p_scan_id uuid,
  p_image_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  update public.scans s
  set image_path = p_image_path
  where s.id = p_scan_id and s.user_id = actor;

  if not found then
    raise exception using errcode = 'P0001', message = 'SCAN_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.set_scan_image_path(uuid, text) from public, anon;

grant execute on function public.set_scan_image_path(uuid, text) to authenticated;

-- ──────────────────────────────────────────────────────────
-- 12. Hook confirm_pickup to run count comparison automatically
-- ──────────────────────────────────────────────────────────
create or replace function public.confirm_pickup(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  update public.pickup_requests_public r
  set status = 'completed', completed_at = now()
  where r.id = request_id
    and r.requester_id = actor
    and r.status = 'awaiting_confirmation'
    and r.confirmation_deadline > now();

  if not found then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_CONFIRMABLE';
  end if;

  update public.pickup_proofs
  set requester_confirmed_at = now()
  where pickup_proofs.request_id = confirm_pickup.request_id
    and is_non_collection_evidence = false
    and requester_confirmed_at is null;

  begin
    perform public.update_collector_count_match(confirm_pickup.request_id);
  exception when others then
    -- Non-fatal: do not block confirmation if count match raises
    null;
  end;

  return query select confirm_pickup.request_id, 'completed'::public.pickup_request_status;
end;
$$;

revoke all on function public.confirm_pickup(uuid) from public, anon;
grant execute on function public.confirm_pickup(uuid) to authenticated;

