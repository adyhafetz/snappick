-- Migration 20261102000300: Clear non-user data and seed comprehensive activity test data for all statuses

-- 1. Clear existing pickup, dispute, proof, rating, and scan records
delete from public.pickup_ratings;
delete from public.disputes;
delete from public.pickup_proofs;
delete from public.pickup_waste_items;
delete from public.pickup_request_private_details;
delete from public.pickup_requests_public;
delete from public.feedback_samples;
delete from public.label_feedback;
delete from public.detections;
delete from public.scans;

-- 2. Seed multi-status records for test_a@gmail.com and test_b@gmail.com
do $$
declare
  user_a uuid;
  user_b uuid;
  rule_id uuid;
  rule_ver integer;
  
  -- Perak District IDs
  dist_kinta uuid;
  dist_kampar uuid;
  dist_manjung uuid;
  dist_batang uuid;
  dist_kk uuid;
  dist_larut uuid;
  dist_hilir uuid;
  dist_kerian uuid;

  -- Test proof storage path (verified existing in proofs bucket)
  sample_proof_path text := '088afbab-21e4-417d-87d3-7f22beecb0d2/a5c6ad63-a4b5-4426-a61b-7ba8e63c4111/1793627187109.jpg';

  -- IDs for test_a as requester
  r_a_pending uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  r_a_accepted uuid := 'a0000000-0000-4000-8000-000000000002'::uuid;
  r_a_in_prog uuid := 'a0000000-0000-4000-8000-000000000003'::uuid;
  r_a_review uuid := 'a0000000-0000-4000-8000-000000000004'::uuid;
  r_a_completed uuid := 'a0000000-0000-4000-8000-000000000005'::uuid;
  r_a_disputed uuid := 'a0000000-0000-4000-8000-000000000006'::uuid;
  r_a_cancelled uuid := 'a0000000-0000-4000-8000-000000000007'::uuid;

  -- IDs for test_b as requester (test_a as collector)
  r_b_accepted uuid := 'b0000000-0000-4000-8000-000000000001'::uuid;
  r_b_in_prog uuid := 'b0000000-0000-4000-8000-000000000002'::uuid;
  r_b_review uuid := 'b0000000-0000-4000-8000-000000000003'::uuid;
  r_b_completed uuid := 'b0000000-0000-4000-8000-000000000004'::uuid;
  r_b_disputed uuid := 'b0000000-0000-4000-8000-000000000005'::uuid;

begin
  select id into user_a from auth.users where email = 'test_a@gmail.com';
  select id into user_b from auth.users where email = 'test_b@gmail.com';
  
  if user_a is null or user_b is null then
    raise notice 'test_a or test_b not found in auth.users';
    return;
  end if;

  select id, version into rule_id, rule_ver from public.pbt_rule_sets order by version desc limit 1;
  select id into dist_kinta from public.perak_districts where name = 'Kinta';
  select id into dist_kampar from public.perak_districts where name = 'Kampar';
  select id into dist_manjung from public.perak_districts where name = 'Manjung';
  select id into dist_batang from public.perak_districts where name = 'Batang Padang';
  select id into dist_kk from public.perak_districts where name = 'Kuala Kangsar';
  select id into dist_larut from public.perak_districts where name = 'Larut Dan Matang';
  select id into dist_hilir from public.perak_districts where name = 'Hilir Perak';
  select id into dist_kerian from public.perak_districts where name = 'Kerian';

  -- =========================================================================
  -- GROUP 1: test_a is Requester (test_b is Collector)
  -- =========================================================================

  -- 1.1 Pending (Waiting for Collector)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) values (
    r_a_pending, user_a, null, 'pending', dist_kinta, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 5}, {"class": "cardboard", "quantity": 3}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326),
    now() - interval '1 hour', now() - interval '1 hour'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_pending, extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326), '12A', 'Jalan Sultan Azlan Shah', 'Near community hall');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_pending, 'paper', 5, 'clean_dry'), (r_a_pending, 'cardboard', 3, 'clean_dry');

  -- 1.2 Accepted (Assigned to test_b)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_a_accepted, user_a, user_b, 'accepted', dist_kampar, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 8}, {"class": "metal", "quantity": 4}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1444, 4.3167), 4326),
    now() - interval '45 minutes', now() - interval '2 hours', now() - interval '45 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_accepted, extensions.st_setsrid(extensions.st_makepoint(101.1444, 4.3167), 4326), '28', 'Jalan Universiti, Bandar Barat', 'Opposite campus gate');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_accepted, 'plastic', 8, 'clean_dry'), (r_a_accepted, 'metal', 4, 'clean_dry');

  -- 1.3 In Progress (Collector test_b en route)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_a_in_prog, user_a, user_b, 'in_progress', dist_manjung, rule_id, rule_ver,
    '[{"class": "cardboard", "quantity": 6}, {"class": "glass", "quantity": 2}]'::jsonb,
    now() - interval '2 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(100.6631, 4.2045), 4326),
    now() - interval '1 hour', now() - interval '3 hours', now() - interval '30 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_in_prog, extensions.st_setsrid(extensions.st_makepoint(100.6631, 4.2045), 4326), '15', 'Jalan Lumut, Seri Manjung', 'Near waterfront');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_in_prog, 'cardboard', 6, 'clean_dry'), (r_a_in_prog, 'glass', 2, 'clean_dry');

  -- 1.4 Awaiting Confirmation / Review (test_b submitted proof)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_a_review, user_a, user_b, 'awaiting_confirmation', dist_batang, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 12}, {"class": "plastic", "quantity": 5}]'::jsonb,
    now() - interval '3 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.2584, 4.1322), 4326),
    now() - interval '2 hours', now() - interval '4 hours', now() - interval '15 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_review, extensions.st_setsrid(extensions.st_makepoint(101.2584, 4.1322), 4326), '87', '25 Persiaran Perdana 1', 'Corner lot house');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_review, 'paper', 12, 'clean_dry'), (r_a_review, 'plastic', 5, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_a_review, user_b, sample_proof_path, now() - interval '15 minutes');

  -- 1.5 Completed
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_a_completed, user_a, user_b, 'completed', dist_kk, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 10}, {"class": "paper", "quantity": 15}]'::jsonb,
    now() - interval '1 day', now() - interval '1 hour',
    extensions.st_setsrid(extensions.st_makepoint(100.9419, 4.7735), 4326),
    now() - interval '1 day', now() - interval '2 days', now() - interval '2 hours'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_completed, extensions.st_setsrid(extensions.st_makepoint(100.9419, 4.7735), 4326), '5', 'Jalan Kangsar, Bandar Diraja', 'Near clock tower');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_completed, 'metal', 10, 'clean_dry'), (r_a_completed, 'paper', 15, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_a_completed, user_b, sample_proof_path, now() - interval '2 hours');
  insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
  values (r_a_completed, user_a, user_b, 5, 'Punctual and very polite collector!');

  -- 1.6 Disputed
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_a_disputed, user_a, user_b, 'disputed', dist_larut, rule_id, rule_ver,
    '[{"class": "glass", "quantity": 6}]'::jsonb,
    now() - interval '5 hours', now() + interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(100.7410, 4.8520), 4326),
    now() - interval '4 hours', now() - interval '6 hours', now() - interval '1 hour'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_disputed, extensions.st_setsrid(extensions.st_makepoint(100.7410, 4.8520), 4326), '42', 'Jalan Pasar, Taiping', 'Beside market');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_disputed, 'glass', 6, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_a_disputed, user_b, sample_proof_path, now() - interval '1 hour');
  insert into public.disputes (request_id, raised_by, reason)
  values (r_a_disputed, user_a, 'Recyclables were only partially collected; glass box left behind.');

  -- 1.7 Cancelled
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) values (
    r_a_cancelled, user_a, null, 'cancelled', dist_hilir, rule_id, rule_ver,
    '[{"class": "trash", "quantity": 2}]'::jsonb,
    now() - interval '2 days', now() - interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(101.0217, 4.0259), 4326),
    now() - interval '2 days', now() - interval '1 day'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_a_cancelled, extensions.st_setsrid(extensions.st_makepoint(101.0217, 4.0259), 4326), '9', 'Jalan Ah Cheong, Teluk Intan', 'Leaning tower vicinity');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_a_cancelled, 'trash', 2, 'clean_dry');

  -- =========================================================================
  -- GROUP 2: test_b is Requester (test_a is Collector) -> For Claimed Tasks
  -- =========================================================================

  -- 2.1 Claimed / Accepted (test_a claimed, not yet started)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_b_accepted, user_b, user_a, 'accepted', dist_kinta, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 3}, {"class": "cardboard", "quantity": 7}]'::jsonb,
    now() - interval '30 minutes', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1180, 4.6120), 4326),
    now() - interval '30 minutes', now() - interval '2 hours', now() - interval '30 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_b_accepted, extensions.st_setsrid(extensions.st_makepoint(101.1180, 4.6120), 4326), '3', 'Jalan Medan Ipoh 6', 'Behind shopping centre');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_b_accepted, 'metal', 3, 'clean_dry'), (r_b_accepted, 'cardboard', 7, 'clean_dry');

  -- 2.2 In Progress (test_a started collection)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_b_in_prog, user_b, user_a, 'in_progress', dist_kampar, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 10}, {"class": "paper", "quantity": 8}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1500, 4.3200), 4326),
    now() - interval '1 hour', now() - interval '3 hours', now() - interval '20 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_b_in_prog, extensions.st_setsrid(extensions.st_makepoint(101.1500, 4.3200), 4326), '18', 'Jalan Kolej, Kampar', 'Near sports complex');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_b_in_prog, 'plastic', 10, 'clean_dry'), (r_b_in_prog, 'paper', 8, 'clean_dry');

  -- 2.3 Review (test_a submitted proof to test_b)
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_b_review, user_b, user_a, 'awaiting_confirmation', dist_manjung, rule_id, rule_ver,
    '[{"class": "glass", "quantity": 4}, {"class": "cardboard", "quantity": 5}]'::jsonb,
    now() - interval '2 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(100.6900, 4.2150), 4326),
    now() - interval '2 hours', now() - interval '4 hours', now() - interval '10 minutes'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_b_review, extensions.st_setsrid(extensions.st_makepoint(100.6900, 4.2150), 4326), '22', 'Jalan Teluk Muroh, Sitiawan', 'Near roundabout');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_b_review, 'glass', 4, 'clean_dry'), (r_b_review, 'cardboard', 5, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_b_review, user_a, sample_proof_path, now() - interval '10 minutes');

  -- 2.4 Completed
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_b_completed, user_b, user_a, 'completed', dist_batang, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 25}]'::jsonb,
    now() - interval '1 day', now() - interval '2 hours',
    extensions.st_setsrid(extensions.st_makepoint(101.2600, 4.1800), 4326),
    now() - interval '1 day', now() - interval '2 days', now() - interval '3 hours'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_b_completed, extensions.st_setsrid(extensions.st_makepoint(101.2600, 4.1800), 4326), '11', 'Jalan Tapah Road, Tapah', 'Shop lot ground floor');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_b_completed, 'paper', 25, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_b_completed, user_a, sample_proof_path, now() - interval '3 hours');
  insert into public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
  values (r_b_completed, user_b, user_a, 5, 'Super fast collection, thank you!');

  -- 2.5 Disputed
  insert into public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) values (
    r_b_disputed, user_b, user_a, 'disputed', dist_kerian, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 5}, {"class": "plastic", "quantity": 6}]'::jsonb,
    now() - interval '6 hours', now() + interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(100.4900, 5.1200), 4326),
    now() - interval '5 hours', now() - interval '7 hours', now() - interval '2 hours'
  );
  insert into public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  values (r_b_disputed, extensions.st_setsrid(extensions.st_makepoint(100.4900, 5.1200), 4326), '7', 'Jalan Parit Buntar, Parit Buntar', 'Near bridge');
  insert into public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  values (r_b_disputed, 'metal', 5, 'clean_dry'), (r_b_disputed, 'plastic', 6, 'clean_dry');
  insert into public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  values (r_b_disputed, user_a, sample_proof_path, now() - interval '2 hours');
  insert into public.disputes (request_id, raised_by, reason)
  values (r_b_disputed, user_b, 'Collector reported unable to find location');

end $$;

