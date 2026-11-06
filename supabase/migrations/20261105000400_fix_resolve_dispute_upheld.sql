-- Migration 20261105000400: fix resolve_dispute(upheld)
--
-- 20261105000300 used "on conflict (request_id, collector_id)" inside resolve_dispute, where
-- request_id is also a PL/pgSQL parameter, so upheld outcomes failed with an ambiguous column error.
-- Use the named unique constraint instead.

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
  -- An upheld dispute counts as a 1-star rating for the collector, so stars alone reflect bad pickups.
  if resolve_dispute.outcome = 'upheld' then
    insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
    select r.id, r.requester_id, r.collector_id, 1, 'Dispute upheld'
    from public.pickup_requests_public r
    where r.id = resolve_dispute.request_id and r.collector_id is not null
    on conflict on constraint pickup_ratings_request_collector_key do update set rating = 1, feedback_note = 'Dispute upheld';
    perform public.refresh_collector_rating(
      (select r.collector_id from public.pickup_requests_public r where r.id = resolve_dispute.request_id)
    );
  end if;

  insert into public.audit_log (actor_id, action, table_name, record_id, metadata)
  select actor, 'dispute_resolved', 'disputes', x.id,
         jsonb_build_object('request_id', resolve_dispute.request_id, 'outcome', resolve_dispute.outcome,
                            'collector_id', (select r.collector_id from public.pickup_requests_public r where r.id = resolve_dispute.request_id))
  from public.disputes x where x.request_id = resolve_dispute.request_id;
  return query select r.id, r.status, r.dispute_outcome from public.pickup_requests_public r where r.id = resolve_dispute.request_id;
end;
$function$
;
