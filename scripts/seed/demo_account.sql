-- Demo account data for screen recordings and demos: makes the app look lived-in for adyhafetz@gmail.com.
-- Run first; then run supabase/tests/seed-demo.mjs, which adds the open pickups (map pins) as the test accounts
-- and submits the proof photo for the pickup awaiting confirmation (a real upload through the app's own function).
--
-- Re-running replaces the earlier demo rows (they use fixed ids starting with de000000).
-- Creates for the demo account: 6 scans with detections, 2 completed pickups with ratings,
-- 1 pending pickup, 1 pickup claimed by test_b and in progress.
-- Remove: scripts/seed/clean_demo_account.sql

begin;
do $$
declare
  demo uuid := (select id from auth.users where email = 'adyhafetz@gmail.com');
  b uuid := (select id from auth.users where email = 'test_b@gmail.com');
  kinta uuid := (select id from public.perak_districts where slug = 'kinta');
  rid uuid := (select id from public.pbt_rule_sets where is_active order by created_at limit 1);
  rver int := (select version from public.pbt_rule_sets where is_active order by created_at limit 1);
  s uuid;
  i int;
  cls text[] := array['plastic', 'paper', 'cardboard', 'metal', 'glass', 'plastic'];
begin
  if demo is null or b is null or kinta is null then
    raise exception 'Missing demo user, test_b or the Kinta district.';
  end if;

  delete from public.pickup_ratings where request_id::text like 'de000000-%';
  delete from public.pickup_requests_public where id::text like 'de000000-%';
  delete from public.scans where id::text like 'de000000-%';

  -- Scans (no images, so nothing enters the training pool)
  for i in 1..6 loop
    s := ('de000000-0000-4000-8000-00000000010' || i)::uuid;
    insert into public.scans (id, user_id, model_version, rule_set_id, rule_set_version, image_storage_consent, training_opt_in,
                              image_width, image_height, preprocess_ms, inference_ms, retention_date, created_at)
    values (s, demo, 'v0', rid, rver, true, true, 1080, 1920, 14, 52, now() + interval '90 days', now() - (i * interval '2 days'));
    insert into public.detections (scan_id, model_label, app_class, score, box_x1, box_y1, box_x2, box_y2, source, condition, eligibility, quantity, created_at)
    values (s, cls[i], cls[i], 0.80 + i * 0.03, 0.2, 0.15, 0.7, 0.8, 'detector', 'clean_dry', 'eligible', 1, now() - (i * interval '2 days'));
  end loop;

  -- Two completed pickups collected by test_b, both rated
  for i in 1..2 loop
    insert into public.pickup_requests_public (id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version, material_summary,
        pickup_window_start, pickup_window_end, approximate_location, claimed_at, submitted_at, confirmation_deadline, completed_at, created_at, updated_at)
    values (('de000000-0000-4000-8000-00000000020' || i)::uuid, demo, b, 'completed', kinta, rid, rver,
        case i when 1 then '[{"class":"plastic","quantity":8},{"class":"paper","quantity":5}]'::jsonb else '[{"class":"cardboard","quantity":6},{"class":"glass","quantity":3}]'::jsonb end,
        now() - (i * interval '9 days'), now() - (i * interval '9 days') + interval '3 hours',
        extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326), 0.01),
        now() - (i * interval '9 days') - interval '20 hours', now() - (i * interval '9 days') + interval '2 hours',
        now() - (i * interval '9 days') + interval '50 hours', now() - (i * interval '9 days') + interval '6 hours',
        now() - (i * interval '9 days') - interval '30 hours', now() - (i * interval '9 days') + interval '6 hours');
    insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
    values (('de000000-0000-4000-8000-00000000020' || i)::uuid, extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326), '12A', 'Jalan Sultan Azlan Shah', 'Near the community hall');
    insert into public.pickup_waste_items (request_id, app_class, requester_quantity, accepted, preparation_state, collector_quantity, source, eligibility)
    select ('de000000-0000-4000-8000-00000000020' || i)::uuid, (j ->> 'class'), (j ->> 'quantity')::int, true, 'clean_dry', (j ->> 'quantity')::int, 'detector', 'eligible'
    from jsonb_array_elements(case i when 1 then '[{"class":"plastic","quantity":8},{"class":"paper","quantity":5}]'::jsonb else '[{"class":"cardboard","quantity":6},{"class":"glass","quantity":3}]'::jsonb end) j;
    insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, created_at)
    values (('de000000-0000-4000-8000-00000000020' || i)::uuid, demo, b, case i when 1 then 5 else 4 end, now() - (i * interval '9 days') + interval '6 hours');
  end loop;

  -- One pending pickup (waiting for a collector)
  insert into public.pickup_requests_public (id, requester_id, status, district_id, rule_set_id, rule_set_version, material_summary,
      pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at)
  values ('de000000-0000-4000-8000-000000000301', demo, 'pending', kinta, rid, rver, '[{"class":"paper","quantity":6},{"class":"cardboard","quantity":4}]'::jsonb,
      date_trunc('day', now() + interval '1 day') + interval '9 hours', date_trunc('day', now() + interval '1 day') + interval '12 hours',
      extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_makepoint(101.0830, 4.6010), 4326), 0.01), now() - interval '3 hours', now() - interval '3 hours');
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark, pickup_note)
  values ('de000000-0000-4000-8000-000000000301', extensions.st_setsrid(extensions.st_makepoint(101.0830, 4.6010), 4326), '7', 'Jalan Raja Dr Nazrin Shah', 'Next to the bus stop', 'Bagged by the front gate');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state, source, eligibility)
  values ('de000000-0000-4000-8000-000000000301', 'paper', 6, 'clean_dry', 'detector', 'eligible'), ('de000000-0000-4000-8000-000000000301', 'cardboard', 4, 'clean_dry', 'detector', 'eligible');

  -- One pickup claimed by test_b and in progress (the proof photo is submitted by seed-demo.mjs)
  insert into public.pickup_requests_public (id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version, material_summary,
      pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at)
  values ('de000000-0000-4000-8000-000000000302', demo, b, 'in_progress', kinta, rid, rver, '[{"class":"plastic","quantity":12},{"class":"metal","quantity":4}]'::jsonb,
      now() - interval '1 hour', now() + interval '3 hours',
      extensions.st_snaptogrid(extensions.st_setsrid(extensions.st_makepoint(101.0960, 4.5890), 4326), 0.01), now() - interval '2 hours', now() - interval '5 hours', now() - interval '30 minutes');
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values ('de000000-0000-4000-8000-000000000302', extensions.st_setsrid(extensions.st_makepoint(101.0960, 4.5890), 4326), '22', 'Jalan Bercham', 'Opposite the market');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state, source, eligibility)
  values ('de000000-0000-4000-8000-000000000302', 'plastic', 12, 'clean_dry', 'detector', 'eligible'), ('de000000-0000-4000-8000-000000000302', 'metal', 4, 'clean_dry', 'detector', 'eligible');
end $$;
commit;

select (select count(*) from public.scans where id::text like 'de000000-%') as demo_scans,
       (select count(*) from public.pickup_requests_public where id::text like 'de000000-%') as demo_pickups,
       (select image_storage_consent from public.profiles where id = (select id from auth.users where email = 'adyhafetz@gmail.com')) as image_consent,
       (select community_pickup_safety_acknowledged from public.profiles where id = (select id from auth.users where email = 'adyhafetz@gmail.com')) as safety_ack;
