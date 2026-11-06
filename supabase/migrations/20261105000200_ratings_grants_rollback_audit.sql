-- Migration 20261105000200: ratings privacy, admin function grants, single champion, dispute audit
--
-- 1. pickup_ratings: only the two parties (and admins) can read a rating, not every signed-in user.
-- 2. Admin and cron functions are no longer executable by the anon role / PUBLIC.
-- 3. admin_rollback_model_version: rolling back a non-champion no longer promotes v0 (two champions),
--    v0 itself cannot be rolled back, and a unique index enforces a single champion.
-- 4. resolve_dispute writes an audit_log row (including the collector) like the model actions do.

drop policy if exists pickup_ratings_read_authenticated on public.pickup_ratings;
create policy pickup_ratings_read_participants
  on public.pickup_ratings
  for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = collector_id or public.is_admin());

revoke execute on function public.admin_approve_model_version(text, integer) from public, anon;
grant execute on function public.admin_approve_model_version(text, integer) to authenticated;
revoke execute on function public.admin_rollback_model_version(text, text) from public, anon;
grant execute on function public.admin_rollback_model_version(text, text) to authenticated;
revoke execute on function public.compute_drift_daily(date) from public, anon, authenticated;
grant execute on function public.compute_drift_daily(date) to service_role;

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
  v_role text;
  v_restored_version text;
begin
  if not public.is_admin() then
    raise exception 'Unauthorized: Admin privileges required';
  end if;

  if p_version = 'v0' then
    raise exception 'The bundled baseline v0 cannot be rolled back';
  end if;

  select id, role into v_model_id, v_role
  from public.model_versions
  where version = p_version;

  if v_model_id is null then
    raise exception 'Model version % not found', p_version;
  end if;

  update public.model_versions
  set status = 'rolled_back', rollout_percent = 0, role = 'archived', updated_at = now()
  where id = v_model_id;

  if v_role = 'champion' then
    -- The champion was rolled back: restore the bundled baseline as champion.
    update public.model_versions
    set status = 'stable', role = 'champion', rollout_percent = 100, updated_at = now()
    where version = 'v0';
    v_restored_version := 'v0';
  else
    -- A non-champion was rolled back: the current champion is untouched.
    select version into v_restored_version from public.model_versions where role = 'champion';
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, metadata)
  values (
    auth.uid(), 'model_rolled_back', 'model_versions', v_model_id,
    jsonb_build_object('version', p_version, 'reason', p_reason, 'restored_version', v_restored_version)
  );

  return jsonb_build_object(
    'success', true,
    'rolled_back_version', p_version,
    'reason', p_reason,
    'restored_version', v_restored_version
  );
end;
$$;

create unique index if not exists model_versions_single_champion
  on public.model_versions ((true))
  where role = 'champion';

CREATE OR REPLACE FUNCTION public.resolve_dispute(request_id uuid, outcome dispute_outcome, note text)
 RETURNS TABLE(id uuid, status pickup_request_status, dispute_outcome dispute_outcome)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  insert into public.audit_log (actor_id, action, table_name, record_id, metadata)
  select actor, 'dispute_resolved', 'disputes', x.id,
         jsonb_build_object('request_id', resolve_dispute.request_id, 'outcome', resolve_dispute.outcome,
                            'collector_id', (select r.collector_id from public.pickup_requests_public r where r.id = resolve_dispute.request_id))
  from public.disputes x where x.request_id = resolve_dispute.request_id;
  return query select r.id, r.status, r.dispute_outcome from public.pickup_requests_public r where r.id = resolve_dispute.request_id;
end;
$function$
;
