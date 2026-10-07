-- Development seed for Phase 2. The district boundary is deliberately marked as a placeholder.
insert into public.pbt_rule_sets (name, version, rules, effective_from, source, reviewed_by, reviewed_at, is_active)
values (
  'perak_general', 1,
  jsonb_build_object(
    'classes', jsonb_build_object(
      'plastic_bottle', 'accepted', 'glass_bottle', 'conditional', 'can', 'accepted',
      'cardboard', 'accepted', 'paper', 'accepted', 'plastic_container', 'conditional',
      'plastic_bag_wrapper', 'not_accepted', 'beverage_carton', 'conditional',
      'food_waste', 'not_accepted', 'textile', 'conditional', 'e_waste', 'restricted',
      'battery_bulb', 'restricted', 'general_waste', 'not_accepted'
    ),
    'conditions', jsonb_build_object('clean_dry', 'eligible', 'contaminated_wet', 'needs_confirmation', 'broken_unsafe', 'not_eligible', 'unknown', 'needs_confirmation')
  ), now(), 'Phase 2 development seed; verify with local PBT guidance', 'unreviewed', now(), true
)
on conflict (name, version) do nothing;

insert into public.perak_districts (name, slug, boundary, is_placeholder)
values (
  'Perak service area (placeholder)', 'perak-placeholder',
  st_multi(st_geomfromtext('POLYGON((99.5 3.5, 101.8 3.5, 101.8 5.9, 99.5 5.9, 99.5 3.5))', 4326)), true
)
on conflict (slug) do nothing;
