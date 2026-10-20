-- Add is_mine boolean to pending_pickup_marketplace so users can visually distinguish their own pickup requests
create or replace view public.pending_pickup_marketplace
with (security_barrier = true)
as
  select r.id, d.name as district_name, r.material_summary,
         r.pickup_window_start, r.pickup_window_end,
         extensions.st_x(r.approximate_location)::double precision as longitude,
         extensions.st_y(r.approximate_location)::double precision as latitude,
         count(*) over (partition by extensions.st_x(r.approximate_location), extensions.st_y(r.approximate_location))::integer as cell_count,
         (r.requester_id = auth.uid()) as is_mine
  from public.pickup_requests_public r
  left join public.perak_districts d on d.id = r.district_id
  where r.status = 'pending' and r.pickup_window_end > now();

revoke all on public.pending_pickup_marketplace from public, anon;
grant select on public.pending_pickup_marketplace to authenticated;

