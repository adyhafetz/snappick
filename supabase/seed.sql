-- perak_general v2 is inserted by the Phase 6 migration so a database reset
-- always starts with the same complete seven-label rule set.

insert into public.perak_districts (name, slug, boundary, is_placeholder)
values (
  'Perak service area (placeholder)', 'perak-placeholder',
  st_multi(st_geomfromtext('POLYGON((99.5 3.5, 101.8 3.5, 101.8 5.9, 99.5 5.9, 99.5 3.5))', 4326)), true
)
on conflict (slug) do nothing;
