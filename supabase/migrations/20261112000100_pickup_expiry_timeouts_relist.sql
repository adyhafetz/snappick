-- Migration 20261112000100: pickups that can no longer happen leave the active states.
--
-- Before this, nothing ever set 'expired': a pending request whose pickup window had ended stayed 'pending'
-- forever (still counting toward the requester's 5 open requests), a claim whose window ended could never be
-- started, and a started pickup whose collector disappeared stayed 'in_progress' forever (counting toward the
-- collector's 3 active claims, and the requester could not cancel it).
--
--   1. expire_overdue_pickups(): run every 15 minutes by pg_cron.
--        pending  + window ended                 -> expired
--        accepted + window ended                 -> expired (collector released)
--        in_progress + window ended 12 hours ago -> not_collected, reason 'collector_timeout'
--   2. relist_pickup(request_id, p_window_start, p_window_end): "Request again" for not_collected and expired
--      requests. A new pickup window is required when the old one is over. Clears the previous collector's
--      checklist results and respects the 5 open requests limit.
--   3. resolve_dispute(): writes one audit row for the dispute it resolved (it wrote one per past dispute).

-- 1. Overdue pickups ------------------------------------------------------------------------------------------
create or replace function public.expire_overdue_pickups(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare
  n1 integer;
  n2 integer;
  n3 integer;
begin
  update public.pickup_requests_public r
     set status = 'expired'
   where r.status = 'pending' and r.pickup_window_end <= p_now;
  get diagnostics n1 = row_count;

  update public.pickup_requests_public r
     set status = 'expired', collector_id = null, claimed_at = null
   where r.status = 'accepted' and r.pickup_window_end <= p_now;
  get diagnostics n2 = row_count;

  update public.pickup_requests_public r
     set status = 'not_collected', non_collection_reason = 'collector_timeout', completed_at = p_now
   where r.status = 'in_progress' and r.pickup_window_end <= p_now - interval '12 hours';
  get diagnostics n3 = row_count;

  return n1 + n2 + n3;
end;
$$;

revoke all on function public.expire_overdue_pickups(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_overdue_pickups(timestamptz) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-overdue-pickups';
    perform cron.schedule('expire-overdue-pickups', '*/15 * * * *', 'select public.expire_overdue_pickups(now());');
  end if;
end;
$$;

-- Clear what is already overdue.
select public.expire_overdue_pickups(now());

-- 2. Request again ----------------------------------------------------------------------------------------------
drop function if exists public.relist_pickup(uuid);

create or replace function public.relist_pickup(
  request_id uuid,
  p_window_start timestamptz default null,
  p_window_end timestamptz default null
)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := auth.uid();
  target public.pickup_requests_public%rowtype;
  new_start timestamptz;
  new_end timestamptz;
begin
  if actor is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;

  select r.* into target from public.pickup_requests_public r
   where r.id = relist_pickup.request_id and r.requester_id = actor for update;
  if not found or target.status not in ('not_collected', 'expired') then
    raise exception using errcode = 'P0001', message = 'REQUEST_NOT_RELISTABLE';
  end if;

  new_start := coalesce(p_window_start, target.pickup_window_start);
  new_end := coalesce(p_window_end, target.pickup_window_end);
  if new_start < now() or new_end <= new_start or new_end > now() + interval '31 days' then
    raise exception using errcode = '22023', message = 'INVALID_PICKUP_WINDOW';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text, 1));
  if (select count(*) from public.pickup_requests_public open_r
       where open_r.requester_id = actor
         and open_r.status in ('pending', 'accepted', 'in_progress')) >= 5 then
    raise exception using errcode = 'P0001', message = 'OPEN_REQUEST_LIMIT';
  end if;

  update public.pickup_waste_items w
     set collector_quantity = null, collector_condition = null, not_collected_reason = null,
         collector_verified_at = null, collector_verified_by = null
   where w.request_id = target.id;

  update public.pickup_requests_public r
     set status = 'pending', collector_id = null, claimed_at = null, submitted_at = null,
         confirmation_deadline = null, completed_at = null, non_collection_reason = null, dispute_outcome = null,
         pickup_window_start = new_start, pickup_window_end = new_end
   where r.id = target.id;

  return query select target.id, 'pending'::public.pickup_request_status;
end;
$$;

revoke all on function public.relist_pickup(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.relist_pickup(uuid, timestamptz, timestamptz) to authenticated;

-- 3. One audit row per resolved dispute ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_dispute(request_id uuid, outcome dispute_outcome, note text)
 RETURNS TABLE(id uuid, status pickup_request_status, dispute_outcome dispute_outcome)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  actor uuid := auth.uid();
  resolved_id uuid;
begin
  if actor is null or not public.is_admin() then raise exception using errcode = '42501', message = 'ADMIN_REQUIRED'; end if;
  if length(btrim(coalesce(note, ''))) > 1000 then raise exception using errcode = '22023', message = 'INVALID_RESOLUTION_NOTE'; end if;
  update public.disputes d set outcome = resolve_dispute.outcome, resolved_by = actor, resolution_note = nullif(btrim(note), ''), resolved_at = now()
    where d.request_id = resolve_dispute.request_id and d.outcome is null
    returning d.id into resolved_id;
  if resolved_id is null then raise exception using errcode = 'P0001', message = 'DISPUTE_NOT_OPEN'; end if;
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
  values (actor, 'dispute_resolved', 'disputes', resolved_id,
          jsonb_build_object('request_id', resolve_dispute.request_id, 'outcome', resolve_dispute.outcome,
                             'collector_id', (select r.collector_id from public.pickup_requests_public r where r.id = resolve_dispute.request_id)));
  return query select r.id, r.status, r.dispute_outcome from public.pickup_requests_public r where r.id = resolve_dispute.request_id;
end;
$function$;
