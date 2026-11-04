-- Migration 20261102000100: Add Requester Details to my_claimed_pickups view

create or replace view public.my_claimed_pickups
with (security_barrier = true)
as
  select r.id,
         r.status,
         d.name as district_name,
         r.material_summary,
         r.pickup_window_start,
         r.pickup_window_end,
         r.created_at,
         r.updated_at,
         p.display_name as requester_name,
         p.rating_avg as requester_rating,
         p.rating_count as requester_rating_count
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  left join public.profiles p on p.id = r.requester_id
  where r.collector_id = auth.uid();

revoke all on public.my_claimed_pickups from public, anon;
grant select on public.my_claimed_pickups to authenticated;

