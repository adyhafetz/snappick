-- Phase 8: collector marketplace, claim lifecycle, private detail access and expiry.
alter table public.pickup_requests_public
  alter column claimed_at drop not null;

create or replace view public.pending_pickup_marketplace
with (security_barrier = true)
as
  select r.id, d.name as district_name, r.material_summary,
         r.pickup_window_start, r.pickup_window_end,
         extensions.st_x(r.approximate_location)::double precision as longitude,
         extensions.st_y(r.approximate_location)::double precision as latitude,
         count(*) over (partition by extensions.st_x(r.approximate_location), extensions.st_y(r.approximate_location))::integer as cell_count
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  where r.status = 'pending' and r.pickup_window_end > now();
revoke all on public.pending_pickup_marketplace from public, anon;
grant select on public.pending_pickup_marketplace to authenticated;

create or replace view public.my_claimed_pickups
with (security_barrier = true)
as
  select r.id, r.status, d.name as district_name, r.material_summary,
         r.pickup_window_start, r.pickup_window_end, r.created_at, r.updated_at
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  where r.collector_id = auth.uid() and r.status in ('accepted', 'in_progress');
revoke all on public.my_claimed_pickups from public, anon;
grant select on public.my_claimed_pickups to authenticated;

create or replace function public.get_pickup_private_details_for_collector(p_request_id uuid, p_collector_user_id uuid)
returns jsonb language sql security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'longitude', extensions.st_x(private_details.exact_location)::double precision,
    'latitude', extensions.st_y(private_details.exact_location)::double precision,
    'unit_number', private_details.unit_number,
    'street', private_details.street,
    'landmark', private_details.landmark,
    'access_instructions', private_details.access_instructions
  )
  from public.pickup_requests_public r
  join public.pickup_request_private_details private_details on private_details.request_id = r.id
  where r.id = p_request_id and r.collector_id = p_collector_user_id
    and r.status in ('accepted', 'in_progress');
$$;
revoke all on function public.get_pickup_private_details_for_collector(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_pickup_private_details_for_collector(uuid, uuid) to service_role;

-- Realtime only signals that the safe marketplace should refresh. It never forwards row data.
drop trigger if exists pickup_marketplace_realtime on public.pickup_requests_public;
create or replace function public.broadcast_pickup_marketplace_refresh()
returns trigger language plpgsql security definer set search_path = public, realtime as $$
begin
  perform realtime.send(jsonb_build_object('refresh', true), 'refresh', 'pickup-marketplace', false);
  return coalesce(new, old);
end;
$$;
create trigger pickup_marketplace_realtime
  after insert or update or delete on public.pickup_requests_public
  for each row execute function public.broadcast_pickup_marketplace_refresh();
do $$ begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pickup_requests_public') then
    alter publication supabase_realtime drop table public.pickup_requests_public;
  end if;
end $$;
create extension if not exists pg_cron with schema pg_catalog;
create or replace function public.claim_pickup_request(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public, extensions as $$
declare
  collector uuid := auth.uid();
  target public.pickup_requests_public%rowtype;
  active_count integer;
begin
  if collector is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(collector::text, 0));
  select r.* into target from public.pickup_requests_public r where r.id = request_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_UNAVAILABLE'; end if;
  if target.requester_id = collector then raise exception using errcode = 'P0001', message = 'CANNOT_CLAIM_OWN_REQUEST'; end if;
  if target.status <> 'pending' then
    if target.status = 'accepted' or target.status = 'in_progress' then raise exception using errcode = 'P0001', message = 'REQUEST_ALREADY_CLAIMED';
    elsif target.status = 'cancelled' then raise exception using errcode = 'P0001', message = 'REQUEST_CANCELLED';
    elsif target.status = 'expired' or target.pickup_window_end <= now() then raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
    else raise exception using errcode = 'P0001', message = 'REQUEST_UNAVAILABLE'; end if;
  end if;
  select count(*) into active_count from public.pickup_requests_public r
   where r.collector_id = collector and r.status in ('accepted', 'in_progress');
  if active_count >= 3 then raise exception using errcode = 'P0001', message = 'ACTIVE_CLAIM_LIMIT_REACHED'; end if;
  update public.pickup_requests_public r set collector_id = collector, status = 'accepted', claimed_at = now()
   where r.id = request_id and r.status = 'pending' and r.pickup_window_end > now()
   returning r.id, r.status into id, status;
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED'; end if;
  return next;
end;
$$;
revoke all on function public.claim_pickup_request(uuid) from public, anon;
grant execute on function public.claim_pickup_request(uuid) to authenticated;

create or replace function public.release_pickup_request(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  return query update public.pickup_requests_public r
    set collector_id = null, claimed_at = null, status = 'pending'
    where r.id = request_id and r.collector_id = auth.uid() and r.status = 'accepted'
      and r.pickup_window_end > now()
    returning r.id, r.status;
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_RELEASABLE'; end if;
end;
$$;
revoke all on function public.release_pickup_request(uuid) from public, anon;
grant execute on function public.release_pickup_request(uuid) to authenticated;

create or replace function public.start_pickup(request_id uuid)
returns table (id uuid, status public.pickup_request_status)
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception using errcode = '28000', message = 'AUTHENTICATION_REQUIRED'; end if;
  return query update public.pickup_requests_public r set status = 'in_progress'
    where r.id = request_id and r.collector_id = auth.uid() and r.status = 'accepted'
      and r.claimed_at >= now() - interval '24 hours' and r.pickup_window_end > now()
    returning r.id, r.status;
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_STARTABLE'; end if;
end;
$$;
revoke all on function public.start_pickup(uuid) from public, anon;
grant execute on function public.start_pickup(uuid) to authenticated;

create or replace function public.expire_unstarted_pickup_claims(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer;
begin
  update public.pickup_requests_public r set collector_id = null, claimed_at = null, status = 'pending'
   where r.status = 'accepted' and r.claimed_at < p_now - interval '24 hours';
  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function public.expire_unstarted_pickup_claims(timestamptz) from public, anon, authenticated;
grant execute on function public.expire_unstarted_pickup_claims(timestamptz) to service_role;

create or replace function public.set_pickup_claimed_at_for_test(request_id uuid, p_claimed_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
begin
  if current_user not in ('postgres', 'service_role') then raise exception using errcode = '42501', message = 'TEST_HELPER_FORBIDDEN'; end if;
  update public.pickup_requests_public set claimed_at = p_claimed_at
   where id = request_id and status in ('accepted', 'in_progress');
  if not found then raise exception using errcode = 'P0001', message = 'REQUEST_NOT_ACCEPTED'; end if;
end;
$$;
revoke all on function public.set_pickup_claimed_at_for_test(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.set_pickup_claimed_at_for_test(uuid, timestamptz) to service_role;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-unstarted-pickup-claims';
    perform cron.schedule('expire-unstarted-pickup-claims', '*/15 * * * *', 'select public.expire_unstarted_pickup_claims(now());');
  end if;
end $$;
