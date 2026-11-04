-- Migration 20261030000200: Add Collector Ratings to my_pickup_requests view

create or replace view public.my_pickup_requests
with (security_barrier = true)
as
  select r.id, r.status, r.district_id, d.name as district_name, r.rule_set_id,
         r.rule_set_version, r.material_summary, r.pickup_window_start,
         r.pickup_window_end, r.approximate_location, r.created_at, r.updated_at,
         p.display_name as collector_name,
         p.rating_avg as collector_rating,
         p.rating_count as collector_rating_count
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  left join public.profiles p on p.id = r.collector_id
  where r.requester_id = auth.uid();

revoke all on public.my_pickup_requests from public, anon;
grant select on public.my_pickup_requests to authenticated;

