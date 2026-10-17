-- Allow anonymous role to execute resolve_pickup_area for public geofence resolution on the map.
grant execute on function public.resolve_pickup_area(double precision, double precision) to anon;

