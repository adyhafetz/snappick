-- Migration: 20261101000100_simplified_collection_flow_and_cleanup.sql
-- Purpose:
-- 1. Streamline submit_collection RPC: allow collectors to complete pickups without micro-managing item quantities or cleanliness conditions.
-- 2. Purge old test requests, scans, and feedback data while strictly preserving user accounts and profiles.

create or replace function public.submit_collection(
  request_id uuid,
  p_items jsonb default null,
  p_non_collection_reason text default null,
  p_proof_path text default null,
  p_captured_at timestamptz default now()
)
returns table (
  id uuid,
  status public.pickup_request_status,
  confirmation_deadline timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.pickup_requests_public%rowtype;
  item jsonb;
  row public.pickup_waste_items%rowtype;
  qty integer;
  condition_value public.condition_state;
  total_collected integer := 0;
  deadline timestamptz;
begin
  if actor is null then
    raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED';
  end if;

  select r.* into target
  from public.pickup_requests_public r
  where r.id = submit_collection.request_id for update;

  if not found or target.collector_id <> actor or target.status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_SUBMITTABLE';
  end if;

  if p_proof_path is null or length(p_proof_path) > 500 or p_proof_path !~ ('^' || actor::text || '/' || request_id::text || '/[A-Za-z0-9._-]+[.]jpg$') then
    raise exception using errcode = '22023', message = 'PROOF_REQUIRED';
  end if;

  -- 1. Case: Unable to collect (Non-collection reported with reason)
  if p_non_collection_reason is not null and btrim(p_non_collection_reason) <> '' then
    if coalesce(nullif(btrim(p_non_collection_reason), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;

    update public.pickup_waste_items w
    set collector_quantity = 0,
        collector_condition = preparation_state,
        not_collected_reason = btrim(p_non_collection_reason),
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.request_id = target.id;

    update public.pickup_requests_public r
    set status = 'not_collected',
        non_collection_reason = btrim(p_non_collection_reason),
        submitted_at = now(),
        completed_at = now()
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), true);

    return query select target.id, 'not_collected'::public.pickup_request_status, null::timestamptz;
    return;
  end if;

  -- 2. Case: Streamlined collection (Default happy path - all requested items collected)
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    update public.pickup_waste_items w
    set collector_quantity = requester_quantity,
        collector_condition = preparation_state,
        not_collected_reason = null,
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.request_id = target.id
      and w.accepted = true
      and w.eligibility = 'eligible';

    deadline := now() + interval '48 hours';
    update public.pickup_requests_public r
    set status = 'awaiting_confirmation',
        submitted_at = now(),
        confirmation_deadline = deadline,
        non_collection_reason = null
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), false);

    return query select target.id, 'awaiting_confirmation'::public.pickup_request_status, deadline;
    return;
  end if;

  -- 3. Case: Legacy / manual item array passed
  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'quantity') is distinct from 'number'
       or jsonb_typeof(item->'condition') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM';
    end if;

    select w.* into row
    from public.pickup_waste_items w
    where w.id = (item->>'id')::uuid and w.request_id = submit_collection.request_id for update;

    if not found then
      raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM';
    end if;

    if not row.accepted or row.eligibility <> 'eligible' then
      raise exception using errcode = '22023', message = 'INELIGIBLE_CHECKLIST_ITEM';
    end if;

    qty := (item->>'quantity')::integer;
    if qty < 0 or qty > row.requester_quantity then
      raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
    end if;

    begin
      condition_value := (item->>'condition')::public.condition_state;
    exception when others then
      raise exception using errcode = '22023', message = 'INVALID_CONDITION';
    end;

    if qty < row.requester_quantity and coalesce(nullif(btrim(item->>'reason'), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;

    update public.pickup_waste_items w
    set collector_quantity = qty,
        collector_condition = condition_value,
        not_collected_reason = nullif(btrim(item->>'reason'), ''),
        collector_verified_at = now(),
        collector_verified_by = actor
    where w.id = row.id;

    total_collected := total_collected + qty;
  end loop;

  if total_collected = 0 then
    update public.pickup_requests_public r
    set status = 'not_collected',
        non_collection_reason = 'missing',
        submitted_at = now(),
        completed_at = now()
    where r.id = target.id;

    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), true);

    return query select target.id, 'not_collected'::public.pickup_request_status, null::timestamptz;
    return;
  end if;

  deadline := now() + interval '48 hours';
  update public.pickup_requests_public r
  set status = 'awaiting_confirmation',
      submitted_at = now(),
      confirmation_deadline = deadline,
      non_collection_reason = null
  where r.id = target.id;

  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
  values (target.id, actor, p_proof_path, coalesce(p_captured_at, now()), false);

  return query select target.id, 'awaiting_confirmation'::public.pickup_request_status, deadline;
end;
$$;

revoke all on function public.submit_collection(uuid, jsonb, text, text, timestamptz) from public, anon;
grant execute on function public.submit_collection(uuid, jsonb, text, text, timestamptz) to authenticated;

-- Clean existing non-user data (requests, scans, feedback) while preserving all user accounts and profiles:
delete from public.pickup_requests_public;
delete from public.scans;
delete from public.label_feedback;
delete from public.feedback_samples;
delete from public.scan_upload_queue;
delete from public.reports;
