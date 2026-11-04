-- Migration 20261030000100: Account Deletion, Pickup Ratings, and Seed M0 Baseline

-- -----------------------------------------------------------------------------
-- 1. Ensure M0 Baseline Bundled Fallback is seeded in model_versions
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
-- 2. Add rating aggregates to profiles
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists rating_avg numeric(3,2) default 5.0,
  add column if not exists rating_count integer default 0;

-- -----------------------------------------------------------------------------
-- 3. Pickup Ratings Table
-- -----------------------------------------------------------------------------
create table if not exists public.pickup_ratings (
  id            uuid primary key default gen_random_uuid(),
  request_id    uuid not null unique references public.pickup_requests_public(id) on delete cascade,
  requester_id  uuid not null references auth.users(id) on delete cascade,
  collector_id  uuid not null references auth.users(id) on delete cascade,
  rating        integer not null check (rating >= 1 and rating <= 5),
  feedback_note text check (feedback_note is null or length(feedback_note) <= 500),
  created_at    timestamptz not null default now()
);

create index if not exists pickup_ratings_collector_idx
  on public.pickup_ratings (collector_id, created_at desc);

alter table public.pickup_ratings enable row level security;

-- Read policy: Anyone authenticated can view ratings (e.g. collector profiles)
create policy pickup_ratings_read_authenticated
  on public.pickup_ratings
  for select
  to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- 4. Rate and Confirm Pickup RPC
-- -----------------------------------------------------------------------------
create or replace function public.rate_and_confirm_pickup(
  p_request_id uuid,
  p_rating integer,
  p_feedback_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_collector_id uuid;
begin
  if v_actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  if p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'INVALID_RATING_VALUE';
  end if;

  -- 1. Check pickup request
  select collector_id into v_collector_id
  from public.pickup_requests_public
  where id = p_request_id
    and requester_id = v_actor
    and status = 'awaiting_confirmation';

  if v_collector_id is null then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_CONFIRMABLE';
  end if;

  -- 2. Mark confirmed / completed
  update public.pickup_requests_public
  set
    status = 'completed',
    completed_at = now()
  where id = p_request_id;

  update public.pickup_proofs
  set requester_confirmed_at = now()
  where request_id = p_request_id
    and is_non_collection_evidence = false
    and requester_confirmed_at is null;

  -- 3. Insert or update rating
  insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
  values (p_request_id, v_actor, v_collector_id, p_rating, nullif(btrim(p_feedback_note), ''))
  on conflict (request_id) do update
  set
    rating = excluded.rating,
    feedback_note = excluded.feedback_note;

  -- 4. Update collector rating stats
  update public.profiles
  set
    rating_avg = (
      select coalesce(round(avg(rating)::numeric, 2), 5.0)
      from public.pickup_ratings
      where collector_id = v_collector_id
    ),
    rating_count = (
      select count(*)
      from public.pickup_ratings
      where collector_id = v_collector_id
    )
  where id = v_collector_id;

  return jsonb_build_object(
    'success', true,
    'request_id', p_request_id,
    'status', 'completed',
    'rating', p_rating
  );
end;
$$;

revoke all on function public.rate_and_confirm_pickup(uuid, integer, text) from public, anon;
grant execute on function public.rate_and_confirm_pickup(uuid, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Delete User Account RPC
-- -----------------------------------------------------------------------------
create or replace function public.delete_user_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  -- 1. Cancel unfulfilled requests owned by this user
  update public.pickup_requests_public
  set status = 'cancelled'
  where requester_id = v_user_id
    and status in ('pending', 'accepted');

  -- 2. If user is collector on accepted/in_progress pickups, release them back to pending
  update public.pickup_requests_public
  set
    status = 'pending',
    collector_id = null,
    claimed_at = null
  where collector_id = v_user_id
    and status in ('accepted', 'in_progress');

  -- 3. Delete from auth.users (cascades to public.profiles, scans, label_feedback, etc.)
  delete from auth.users where id = v_user_id;

  return jsonb_build_object(
    'success', true,
    'deleted_user_id', v_user_id
  );
end;
$$;

revoke all on function public.delete_user_account() from public, anon;
grant execute on function public.delete_user_account() to authenticated;

