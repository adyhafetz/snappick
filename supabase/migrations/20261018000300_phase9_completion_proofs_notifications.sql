-- Phase 9: collector verification, proof, confirmation, disputes and idempotent completion.
alter table public.pickup_requests_public
  add column if not exists submitted_at timestamptz,
  add column if not exists confirmation_deadline timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists non_collection_reason text,
  add column if not exists dispute_outcome public.dispute_outcome;

alter table public.pickup_waste_items
  add column if not exists collector_verified_at timestamptz,
  add column if not exists collector_verified_by uuid references auth.users(id) on delete set null;

alter table public.label_feedback
  alter column scan_id drop not null,
  add column if not exists pickup_waste_item_id uuid references public.pickup_waste_items(id) on delete cascade;

alter table public.pickup_proofs
  add column if not exists retention_until timestamptz not null default (now() + interval '90 days');

alter table public.pickup_waste_items
  add constraint pickup_waste_items_not_collected_reason_check
  check (not_collected_reason is null or not_collected_reason in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other'));

create index if not exists pickup_confirmation_deadline_idx
  on public.pickup_requests_public (status, confirmation_deadline);

-- Client writes for lifecycle data are RPC-only. Participants can read the checklist and proofs.
drop policy if exists waste_participant on public.pickup_waste_items;
drop policy if exists proofs_participant on public.pickup_proofs;
drop policy if exists disputes_participant on public.disputes;
create or replace function public.is_pickup_participant(p_request_id uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.pickup_requests_public r
    where r.id = p_request_id and (r.requester_id = auth.uid() or r.collector_id = auth.uid() or public.is_admin())
  );
$$;
revoke all on function public.is_pickup_participant(uuid) from public, anon;
grant execute on function public.is_pickup_participant(uuid) to authenticated;

create policy pickup_waste_read_participant on public.pickup_waste_items
  for select to authenticated using (public.is_pickup_participant(request_id));
create policy pickup_proofs_read_participant on public.pickup_proofs
  for select to authenticated using (public.is_pickup_participant(request_id));
create policy disputes_read_participant on public.disputes
  for select to authenticated using (raised_by = auth.uid() or public.is_admin());
revoke insert, update, delete, truncate, references, trigger on public.pickup_waste_items, public.pickup_proofs, public.disputes from anon, authenticated;
grant select on public.pickup_waste_items, public.pickup_proofs, public.disputes to authenticated;

create or replace function public.submit_collection(
  request_id uuid,
  p_items jsonb,
  p_non_collection_reason text default null,
  p_proof_path text default null,
  p_captured_at timestamptz default now()
)
returns table (id uuid, status public.pickup_request_status, confirmation_deadline timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  actor uuid := auth.uid();
  target public.pickup_requests_public%rowtype;
  item jsonb;
  row public.pickup_waste_items%rowtype;
  qty integer;
  condition_value public.condition_state;
  total_collected integer := 0;
  missing integer := 0;
  deadline timestamptz;
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'CHECKLIST_REQUIRED';
  end if;
  select r.* into target from public.pickup_requests_public r where r.id = submit_collection.request_id for update;
  if not found or target.collector_id <> actor or target.status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_SUBMITTABLE';
  end if;
  if p_proof_path is null or length(p_proof_path) > 500 or p_proof_path !~ ('^' || actor::text || '/' || request_id::text || '/[A-Za-z0-9._-]+[.]jpg$') then
    raise exception using errcode = '22023', message = 'PROOF_REQUIRED';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(item->'id') is distinct from 'string' or jsonb_typeof(item->'quantity') is distinct from 'number'
       or jsonb_typeof(item->'condition') is distinct from 'string' then
      raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM';
    end if;
    select w.* into row from public.pickup_waste_items w where w.id = (item->>'id')::uuid and w.request_id = submit_collection.request_id for update;
    if not found then raise exception using errcode = '22023', message = 'INVALID_CHECKLIST_ITEM'; end if;
    if not row.accepted or row.eligibility <> 'eligible' then raise exception using errcode = '22023', message = 'INELIGIBLE_CHECKLIST_ITEM'; end if;
    if item->>'quantity' !~ '^[0-9]+$' then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    qty := (item->>'quantity')::integer;
    if qty < 0 or qty > row.requester_quantity then raise exception using errcode = '22023', message = 'INVALID_QUANTITY'; end if;
    begin condition_value := (item->>'condition')::public.condition_state; exception when others then raise exception using errcode = '22023', message = 'INVALID_CONDITION'; end;
    if qty < row.requester_quantity and coalesce(nullif(btrim(item->>'reason'), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;
    update public.pickup_waste_items w set collector_quantity = qty, collector_condition = condition_value,
      not_collected_reason = nullif(btrim(item->>'reason'), ''), collector_verified_at = now(), collector_verified_by = actor
      where w.id = row.id;
    insert into public.label_feedback (detection_id, scan_id, pickup_waste_item_id, user_id, original_model_label,
      corrected_app_class, original_condition, corrected_condition, feedback_type, collector_verified_at)
      values (null, null, row.id, actor, row.app_class, row.app_class, row.preparation_state, condition_value, 'collector_verification', now());
    total_collected := total_collected + qty;
    if qty < row.requester_quantity then missing := missing + 1; end if;
  end loop;
  if (select count(*) from public.pickup_waste_items w where w.request_id = submit_collection.request_id and w.collector_verified_at is null) > 0 then
    raise exception using errcode = '22023', message = 'CHECKLIST_INCOMPLETE';
  end if;
  if total_collected = 0 then
    if coalesce(nullif(btrim(p_non_collection_reason), ''), '') not in ('contaminated', 'missing', 'unsafe', 'access_issue', 'other') then
      raise exception using errcode = '22023', message = 'NON_COLLECTION_REASON_REQUIRED';
    end if;
    update public.pickup_requests_public r set status = 'not_collected', non_collection_reason = p_non_collection_reason,
      submitted_at = now(), completed_at = now() where r.id = target.id;
    insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
      values (target.id, actor, p_proof_path, p_captured_at, true);
    return query select target.id, 'not_collected'::public.pickup_request_status, null::timestamptz;
    return;
  end if;
  deadline := now() + interval '48 hours';
  update public.pickup_requests_public r set status = 'awaiting_confirmation', submitted_at = now(), confirmation_deadline = deadline,
    non_collection_reason = null where r.id = target.id;
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at, is_non_collection_evidence)
    values (target.id, actor, p_proof_path, p_captured_at, false);
  return query select target.id, 'awaiting_confirmation'::public.pickup_request_status, deadline;
end;
$$;
revoke all on function public.submit_collection(uuid, jsonb, text, text, timestamptz) from public, anon;
grant execute on function public.submit_collection(uuid, jsonb, text, text, timestamptz) to authenticated;

create or replace function public.confirm_pickup(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  update public.pickup_requests_public r set status = 'completed', completed_at = now()
    where r.id = request_id and r.requester_id = actor and r.status = 'awaiting_confirmation'
      and r.confirmation_deadline > now();
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_CONFIRMABLE'; end if;
  update public.pickup_proofs set requester_confirmed_at = now() where pickup_proofs.request_id = confirm_pickup.request_id and is_non_collection_evidence = false and requester_confirmed_at is null;
  return query select confirm_pickup.request_id, 'completed'::public.pickup_request_status;
end;
$$;
revoke all on function public.confirm_pickup(uuid) from public, anon;
grant execute on function public.confirm_pickup(uuid) to authenticated;

create or replace function public.raise_dispute(request_id uuid, reason text)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  if length(btrim(coalesce(reason, ''))) not between 1 and 500 then raise exception using errcode = '22023', message = 'DISPUTE_REASON_REQUIRED'; end if;
  update public.pickup_requests_public r set status = 'disputed'
    where r.id = request_id and r.requester_id = actor and r.status = 'awaiting_confirmation' and r.confirmation_deadline > now();
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_DISPUTABLE'; end if;
  insert into public.disputes (request_id, raised_by, reason) values (request_id, actor, btrim(reason));
  return query select raise_dispute.request_id, 'disputed'::public.pickup_request_status;
end;
$$;
revoke all on function public.raise_dispute(uuid, text) from public, anon;
grant execute on function public.raise_dispute(uuid, text) to authenticated;

create or replace function public.relist_pickup(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  update public.pickup_requests_public r set status = 'pending', collector_id = null, claimed_at = null,
    submitted_at = null, confirmation_deadline = null, completed_at = null, non_collection_reason = null, dispute_outcome = null
    where r.id = request_id and r.requester_id = actor and r.status = 'not_collected';
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_RELISTABLE'; end if;
  return query select relist_pickup.request_id, 'pending'::public.pickup_request_status;
end;
$$;
revoke all on function public.relist_pickup(uuid) from public, anon;
grant execute on function public.relist_pickup(uuid) to authenticated;

create or replace function public.resolve_dispute(request_id uuid, outcome public.dispute_outcome, note text)
returns table (id uuid, status public.pickup_request_status, dispute_outcome public.dispute_outcome)
language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if length(btrim(coalesce(note, ''))) > 1000 then raise exception using errcode = '22023', message = 'INVALID_RESOLUTION_NOTE'; end if;
  update public.disputes d set outcome = resolve_dispute.outcome, resolved_by = actor, resolution_note = nullif(btrim(note), ''), resolved_at = now()
    where d.request_id = resolve_dispute.request_id and d.outcome is null;
  if not found then raise exception using errcode = 'P0001', message = 'DISPUTE_NOT_OPEN'; end if;
  update public.pickup_requests_public r set status = (case when resolve_dispute.outcome = 'upheld' then 'not_collected' else 'completed' end)::public.pickup_request_status,
    dispute_outcome = resolve_dispute.outcome, completed_at = case when resolve_dispute.outcome = 'upheld' then null else now() end
    where r.id = resolve_dispute.request_id and r.status = 'disputed';
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_DISPUTED'; end if;
  return query select r.id, r.status, r.dispute_outcome from public.pickup_requests_public r where r.id = resolve_dispute.request_id;
end;
$$;
revoke all on function public.resolve_dispute(uuid, public.dispute_outcome, text) from public, anon, authenticated;
grant execute on function public.resolve_dispute(uuid, public.dispute_outcome, text) to authenticated;

create or replace function public.auto_complete_pickups(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  update public.pickup_requests_public r set status = 'completed', completed_at = p_now
    where r.status = 'awaiting_confirmation' and r.confirmation_deadline <= p_now
      and not exists (select 1 from public.disputes d where d.request_id = r.id and d.outcome is null);
  get diagnostics changed = row_count;
  update public.pickup_proofs p set auto_completed_at = p_now
    where p.request_id in (select r.id from public.pickup_requests_public r where r.status = 'completed' and r.completed_at = p_now)
      and p.is_non_collection_evidence = false and p.auto_completed_at is null;
  return changed;
end;
$$;
revoke all on function public.auto_complete_pickups(timestamptz) from public, anon, authenticated;
grant execute on function public.auto_complete_pickups(timestamptz) to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'auto-complete-pickups';
    perform cron.schedule('auto-complete-pickups', '*/15 * * * *', 'select public.auto_complete_pickups(now());');
  end if;
end $$;

-- A status trigger can call the notify Edge Function when app settings are configured. The payload is
-- deliberately limited to request id and status; no address, image, note, or user id is transmitted.
create or replace function public.notify_pickup_status_change()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  endpoint text := current_setting('app.supabase_url', true);
  anon_key text := current_setting('app.supabase_anon_key', true);
  secret text := current_setting('app.notify_secret', true);
begin
  if endpoint is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'app.supabase_url' limit 1;
  end if;
  if anon_key is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into anon_key from vault.decrypted_secrets where name = 'app.supabase_anon_key' limit 1;
  end if;
  if secret is null and exists (select 1 from pg_extension where extname = 'supabase_vault') then
    select decrypted_secret into secret from vault.decrypted_secrets where name = 'app.notify_secret' limit 1;
  end if;

  if endpoint is not null and anon_key is not null and old.status is distinct from new.status then
    perform net.http_post(endpoint || '/functions/v1/notify', jsonb_build_object('request_id', new.id, 'status', new.status::text),
      jsonb_build_object('Content-Type', 'application/json', 'apikey', anon_key, 'x-notify-secret', secret), '{}'::jsonb, 5000);
  end if;
  return new;
end;
$$;
drop trigger if exists pickup_notify_status on public.pickup_requests_public;
create trigger pickup_notify_status after update of status on public.pickup_requests_public for each row execute function public.notify_pickup_status_change();

