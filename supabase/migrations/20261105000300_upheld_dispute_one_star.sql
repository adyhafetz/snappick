-- Migration 20261105000300: an upheld dispute counts as a 1-star collector rating
--
-- 1. refresh_collector_rating(): single place that recomputes a collector's average and count.
-- 2. pickup_ratings is unique per (request, collector) instead of per request, so a relisted
--    request that a different collector completes does not overwrite the first collector's 1-star.
-- 3. rate_and_confirm_pickup uses the new conflict target.
-- 4. resolve_dispute writes the 1-star rating when the outcome is 'upheld'.
-- 5. Backfill: existing upheld disputes that still have a collector get the 1-star rating.

create or replace function public.refresh_collector_rating(p_collector uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles p
  set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.pickup_ratings where collector_id = p_collector), 5.0),
      rating_count = (select count(*) from public.pickup_ratings where collector_id = p_collector)
  where p.id = p_collector;
$$;
revoke all on function public.refresh_collector_rating(uuid) from public, anon, authenticated;

alter table public.pickup_ratings drop constraint pickup_ratings_request_id_key;
alter table public.pickup_ratings add constraint pickup_ratings_request_collector_key unique (request_id, collector_id);

CREATE OR REPLACE FUNCTION public.rate_and_confirm_pickup(p_request_id uuid, p_rating integer, p_feedback_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  on conflict (request_id, collector_id) do update
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
$function$
;

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
    on conflict (request_id, collector_id) do update set rating = 1, feedback_note = 'Dispute upheld';
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

insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
select r.id, r.requester_id, r.collector_id, 1, 'Dispute upheld'
from public.disputes d
join public.pickup_requests_public r on r.id = d.request_id
where d.outcome = 'upheld' and r.collector_id is not null
on conflict (request_id, collector_id) do nothing;

select public.refresh_collector_rating(c) from (
  select distinct collector_id as c from public.pickup_ratings
) x;
