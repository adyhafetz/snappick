-- Account states: test data for every mobile screen (test_a and test_b) for all SnapPick UI/UX flows.
-- Ensures test_a@gmail.com and test_b@gmail.com exist with password '12345678'.
-- Populates:
--   1. User profiles and consents
--   2. Scans and detections (for Home screen stats & recent scans)
--   3. All pickup request states for 'My Requests' tab (pending, accepted, in_progress, awaiting_confirmation, completed, disputed, cancelled)
--   4. All pickup task states for 'Claimed Tasks' tab (accepted, in_progress, awaiting_confirmation, completed, disputed)
--   5. Open marketplace pickup listings on the Perak map (for Collect tab)
--   6. Proof photos, ratings, and disputes for detail dialogs and modals

ALTER TABLE public.profiles DISABLE TRIGGER profiles_prevent_privilege_escalation;

DO $$
DECLARE
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
  dist_hulu uuid;

  -- Test proof storage path (verified existing in proofs bucket)
  sample_proof_path text := '088afbab-21e4-417d-87d3-7f22beecb0d2/a5c6ad63-a4b5-4426-a61b-7ba8e63c4111/1793627187109.jpg';

  -- IDs for test_a as requester
  r_a_pending  uuid := 'a0000000-0000-4000-8000-000000000001'::uuid;
  r_a_accepted uuid := 'a0000000-0000-4000-8000-000000000002'::uuid;
  r_a_in_prog  uuid := 'a0000000-0000-4000-8000-000000000003'::uuid;
  r_a_review   uuid := 'a0000000-0000-4000-8000-000000000004'::uuid;
  r_a_completed uuid := 'a0000000-0000-4000-8000-000000000005'::uuid;
  r_a_disputed uuid := 'a0000000-0000-4000-8000-000000000006'::uuid;
  r_a_cancelled uuid := 'a0000000-0000-4000-8000-000000000007'::uuid;

  -- IDs for test_b as requester (test_a as collector)
  r_b_accepted uuid := 'b0000000-0000-4000-8000-000000000001'::uuid;
  r_b_in_prog  uuid := 'b0000000-0000-4000-8000-000000000002'::uuid;
  r_b_review   uuid := 'b0000000-0000-4000-8000-000000000003'::uuid;
  r_b_completed uuid := 'b0000000-0000-4000-8000-000000000004'::uuid;
  r_b_disputed uuid := 'b0000000-0000-4000-8000-000000000005'::uuid;

  -- Extra Open Marketplace Requests (requested by test_b, open to claim)
  m_open_1 uuid := 'c0000000-0000-4000-8000-000000000001'::uuid;
  m_open_2 uuid := 'c0000000-0000-4000-8000-000000000002'::uuid;
  m_open_3 uuid := 'c0000000-0000-4000-8000-000000000003'::uuid;
  m_open_4 uuid := 'c0000000-0000-4000-8000-000000000004'::uuid;

  -- Scan IDs for test_a
  s_a_1 uuid := 'd0000000-0000-4000-8000-000000000001'::uuid;
  s_a_2 uuid := 'd0000000-0000-4000-8000-000000000002'::uuid;
  s_a_3 uuid := 'd0000000-0000-4000-8000-000000000003'::uuid;
  s_a_4 uuid := 'd0000000-0000-4000-8000-000000000004'::uuid;

  -- Scan IDs for test_b
  s_b_1 uuid := 'd0000000-0000-4000-8000-000000000011'::uuid;
  s_b_2 uuid := 'd0000000-0000-4000-8000-000000000012'::uuid;
  s_b_3 uuid := 'd0000000-0000-4000-8000-000000000013'::uuid;

BEGIN
  -- 1. Ensure user accounts exist and passwords are set to '12345678'
  SELECT id INTO user_a FROM auth.users WHERE email = 'test_a@gmail.com';
  IF user_a IS NULL THEN
    user_a := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      user_a, '00000000-0000-0000-0000-000000000000', 'test_a@gmail.com',
      extensions.crypt('12345678', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"name":"Test Requester A"}',
      now(), now(), 'authenticated', 'authenticated'
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('12345678', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now())
    WHERE id = user_a;
  END IF;

  SELECT id INTO user_b FROM auth.users WHERE email = 'test_b@gmail.com';
  IF user_b IS NULL THEN
    user_b := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
    ) VALUES (
      user_b, '00000000-0000-0000-0000-000000000000', 'test_b@gmail.com',
      extensions.crypt('12345678', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{"name":"Test Collector B"}',
      now(), now(), 'authenticated', 'authenticated'
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = extensions.crypt('12345678', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now())
    WHERE id = user_b;
  END IF;

  -- 2. Ensure profile details & consents are active
  INSERT INTO public.profiles (
    id, display_name, phone, image_storage_consent, image_storage_consent_at,
    community_pickup_safety_acknowledged, community_pickup_safety_acknowledged_at,
    training_opt_in, training_opt_in_at, rating_avg, rating_count
  ) VALUES (
    user_a, 'Test Requester A', '+60123456789', true, now(), true, now(), true, now(), 5.00, 5
  ) ON CONFLICT (id) DO UPDATE SET
    display_name = 'Test Requester A',
    phone = '+60123456789',
    image_storage_consent = true,
    image_storage_consent_at = now(),
    community_pickup_safety_acknowledged = true,
    community_pickup_safety_acknowledged_at = now(),
    training_opt_in = true,
    training_opt_in_at = now(),
    rating_avg = 5.00,
    rating_count = 5;

  INSERT INTO public.profiles (
    id, display_name, phone, image_storage_consent, image_storage_consent_at,
    community_pickup_safety_acknowledged, community_pickup_safety_acknowledged_at,
    training_opt_in, training_opt_in_at, rating_avg, rating_count
  ) VALUES (
    user_b, 'Test Collector B', '+60198765432', true, now(), true, now(), true, now(), 5.00, 8
  ) ON CONFLICT (id) DO UPDATE SET
    display_name = 'Test Collector B',
    phone = '+60198765432',
    image_storage_consent = true,
    image_storage_consent_at = now(),
    community_pickup_safety_acknowledged = true,
    community_pickup_safety_acknowledged_at = now(),
    training_opt_in = true,
    training_opt_in_at = now(),
    rating_avg = 5.00,
    rating_count = 8;

  -- 3. Resolve Reference Data
  SELECT id, version INTO rule_id, rule_ver FROM public.pbt_rule_sets ORDER BY version DESC LIMIT 1;
  SELECT id INTO dist_kinta FROM public.perak_districts WHERE name = 'Kinta';
  SELECT id INTO dist_kampar FROM public.perak_districts WHERE name = 'Kampar';
  SELECT id INTO dist_manjung FROM public.perak_districts WHERE name = 'Manjung';
  SELECT id INTO dist_batang FROM public.perak_districts WHERE name = 'Batang Padang';
  SELECT id INTO dist_kk FROM public.perak_districts WHERE name = 'Kuala Kangsar';
  SELECT id INTO dist_larut FROM public.perak_districts WHERE name = 'Larut Dan Matang';
  SELECT id INTO dist_hilir FROM public.perak_districts WHERE name = 'Hilir Perak';
  SELECT id INTO dist_kerian FROM public.perak_districts WHERE name = 'Kerian';
  SELECT id INTO dist_hulu FROM public.perak_districts WHERE name = 'Hulu Perak';

  -- 4. Seed Scans & Detections for test_a (Home screen stats)
  INSERT INTO public.scans (
    id, user_id, model_version, rule_set_id, rule_set_version,
    image_storage_consent, training_opt_in, image_width, image_height,
    preprocess_ms, inference_ms, retention_date, created_at
  ) VALUES
    (s_a_1, user_a, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 12, 45, now() + interval '30 days', now() - interval '2 hours'),
    (s_a_2, user_a, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 14, 48, now() + interval '30 days', now() - interval '1 day'),
    (s_a_3, user_a, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 11, 42, now() + interval '30 days', now() - interval '3 days'),
    (s_a_4, user_a, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 15, 50, now() + interval '30 days', now() - interval '5 days');

  INSERT INTO public.detections (
    scan_id, model_label, app_class, score, source, box_x1, box_y1, box_x2, box_y2, condition, eligibility, quantity, created_at
  ) VALUES
    -- Scan 1 detections
    (s_a_1, 'plastic', 'plastic', 0.94, 'detector', 0.12, 0.15, 0.45, 0.65, 'clean_dry', 'eligible', 1, now() - interval '2 hours'),
    (s_a_1, 'cardboard', 'cardboard', 0.88, 'detector', 0.50, 0.20, 0.88, 0.70, 'clean_dry', 'eligible', 1, now() - interval '2 hours'),
    (s_a_1, 'paper', 'paper', 0.85, 'detector', 0.20, 0.70, 0.60, 0.90, 'clean_dry', 'eligible', 1, now() - interval '2 hours'),
    -- Scan 2 detections
    (s_a_2, 'metal', 'metal', 0.91, 'detector', 0.10, 0.15, 0.48, 0.58, 'clean_dry', 'eligible', 1, now() - interval '1 day'),
    (s_a_2, 'glass', 'glass', 0.87, 'detector', 0.52, 0.18, 0.85, 0.65, 'clean_dry', 'eligible', 1, now() - interval '1 day'),
    -- Scan 3 detections
    (s_a_3, 'plastic', 'plastic', 0.96, 'detector', 0.15, 0.10, 0.50, 0.55, 'clean_dry', 'eligible', 1, now() - interval '3 days'),
    (s_a_3, 'paper', 'paper', 0.89, 'detector', 0.55, 0.12, 0.90, 0.60, 'clean_dry', 'eligible', 1, now() - interval '3 days'),
    (s_a_3, 'cardboard', 'cardboard', 0.82, 'detector', 0.25, 0.60, 0.75, 0.92, 'clean_dry', 'eligible', 1, now() - interval '3 days'),
    -- Scan 4 detections
    (s_a_4, 'metal', 'metal', 0.93, 'detector', 0.20, 0.25, 0.70, 0.75, 'clean_dry', 'eligible', 1, now() - interval '5 days');

  -- 4b. Seed Scans & Detections for test_b
  INSERT INTO public.scans (
    id, user_id, model_version, rule_set_id, rule_set_version,
    image_storage_consent, training_opt_in, image_width, image_height,
    preprocess_ms, inference_ms, retention_date, created_at
  ) VALUES
    (s_b_1, user_b, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 13, 46, now() + interval '30 days', now() - interval '1 hour'),
    (s_b_2, user_b, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 15, 49, now() + interval '30 days', now() - interval '1 day'),
    (s_b_3, user_b, 'v0-bundled', rule_id, rule_ver, true, true, 1080, 1920, 12, 44, now() + interval '30 days', now() - interval '4 days');

  INSERT INTO public.detections (
    scan_id, model_label, app_class, score, source, box_x1, box_y1, box_x2, box_y2, condition, eligibility, quantity, created_at
  ) VALUES
    (s_b_1, 'plastic', 'plastic', 0.95, 'detector', 0.15, 0.20, 0.50, 0.65, 'clean_dry', 'eligible', 1, now() - interval '1 hour'),
    (s_b_1, 'metal', 'metal', 0.89, 'detector', 0.55, 0.22, 0.88, 0.68, 'clean_dry', 'eligible', 1, now() - interval '1 hour'),
    (s_b_2, 'cardboard', 'cardboard', 0.92, 'detector', 0.18, 0.18, 0.75, 0.80, 'clean_dry', 'eligible', 1, now() - interval '1 day'),
    (s_b_3, 'glass', 'glass', 0.86, 'detector', 0.22, 0.25, 0.65, 0.72, 'clean_dry', 'eligible', 1, now() - interval '4 days');

  -- =========================================================================
  -- GROUP A: test_a is Requester ('My Requests' tab)
  -- =========================================================================

  -- A.1 Pending (Active: Waiting for collector)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    r_a_pending, user_a, null, 'pending', dist_kinta, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 5}, {"class": "cardboard", "quantity": 3}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326),
    now() - interval '1 hour', now() - interval '1 hour'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark, pickup_note)
  VALUES (r_a_pending, extensions.st_setsrid(extensions.st_makepoint(101.0901, 4.5975), 4326), '12A', 'Jalan Sultan Azlan Shah', 'Near Ipoh community hall', 'Recyclables bagged near front gate');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_pending, 'paper', 5, 'clean_dry'), (r_a_pending, 'cardboard', 3, 'clean_dry');

  -- A.2 Accepted (Active: Assigned to test_b)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_a_accepted, user_a, user_b, 'accepted', dist_kampar, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 8}, {"class": "metal", "quantity": 4}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1444, 4.3167), 4326),
    now() - interval '45 minutes', now() - interval '2 hours', now() - interval '45 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark, access_instructions)
  VALUES (r_a_accepted, extensions.st_setsrid(extensions.st_makepoint(101.1444, 4.3167), 4326), '28', 'Jalan Universiti, Bandar Barat', 'Opposite campus main gate', 'Call intercom when arrived');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_accepted, 'plastic', 8, 'clean_dry'), (r_a_accepted, 'metal', 4, 'clean_dry');

  -- A.3 In Progress (Active: Collector test_b on the way)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_a_in_prog, user_a, user_b, 'in_progress', dist_manjung, rule_id, rule_ver,
    '[{"class": "cardboard", "quantity": 6}, {"class": "glass", "quantity": 2}]'::jsonb,
    now() - interval '2 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(100.6631, 4.2045), 4326),
    now() - interval '1 hour', now() - interval '3 hours', now() - interval '30 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_a_in_prog, extensions.st_setsrid(extensions.st_makepoint(100.6631, 4.2045), 4326), '15', 'Jalan Lumut, Seri Manjung', 'Near waterfront park');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_in_prog, 'cardboard', 6, 'clean_dry'), (r_a_in_prog, 'glass', 2, 'clean_dry');

  -- A.4 Awaiting Confirmation (Active: Collector test_b submitted proof photo)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_a_review, user_a, user_b, 'awaiting_confirmation', dist_batang, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 12}, {"class": "plastic", "quantity": 5}]'::jsonb,
    now() - interval '3 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.2584, 4.1322), 4326),
    now() - interval '2 hours', now() - interval '4 hours', now() - interval '15 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_a_review, extensions.st_setsrid(extensions.st_makepoint(101.2584, 4.1322), 4326), '87', '25 Persiaran Perdana 1', 'Corner lot house');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_review, 'paper', 12, 'clean_dry'), (r_a_review, 'plastic', 5, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_a_review, user_b, sample_proof_path, now() - interval '15 minutes');

  -- A.5 Completed (Completed: Picked up, rated 5 stars)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_a_completed, user_a, user_b, 'completed', dist_kk, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 10}, {"class": "paper", "quantity": 15}]'::jsonb,
    now() - interval '1 day', now() - interval '1 hour',
    extensions.st_setsrid(extensions.st_makepoint(100.9419, 4.7735), 4326),
    now() - interval '1 day', now() - interval '2 days', now() - interval '2 hours'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_a_completed, extensions.st_setsrid(extensions.st_makepoint(100.9419, 4.7735), 4326), '5', 'Jalan Kangsar, Bandar Diraja', 'Near clock tower');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, collector_quantity, preparation_state)
  VALUES (r_a_completed, 'metal', 10, 10, 'clean_dry'), (r_a_completed, 'paper', 15, 15, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_a_completed, user_b, sample_proof_path, now() - interval '2 hours');
  INSERT INTO public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
  VALUES (r_a_completed, user_a, user_b, 5, 'Punctual and very polite collector!');

  -- A.6 Disputed (Completed: Issue reported)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_a_disputed, user_a, user_b, 'disputed', dist_larut, rule_id, rule_ver,
    '[{"class": "glass", "quantity": 6}]'::jsonb,
    now() - interval '5 hours', now() + interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(100.7410, 4.8520), 4326),
    now() - interval '4 hours', now() - interval '6 hours', now() - interval '1 hour'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_a_disputed, extensions.st_setsrid(extensions.st_makepoint(100.7410, 4.8520), 4326), '42', 'Jalan Pasar, Taiping', 'Beside fresh market');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_disputed, 'glass', 6, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_a_disputed, user_b, sample_proof_path, now() - interval '1 hour');
  INSERT INTO public.disputes (request_id, raised_by, reason)
  VALUES (r_a_disputed, user_a, 'Recyclables were only partially collected; glass crate was left behind.');

  -- A.7 Cancelled (Completed: Cancelled request)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    r_a_cancelled, user_a, null, 'cancelled', dist_hilir, rule_id, rule_ver,
    '[{"class": "trash", "quantity": 2}]'::jsonb,
    now() - interval '2 days', now() - interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(101.0217, 4.0259), 4326),
    now() - interval '2 days', now() - interval '1 day'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_a_cancelled, extensions.st_setsrid(extensions.st_makepoint(101.0217, 4.0259), 4326), '9', 'Jalan Ah Cheong, Teluk Intan', 'Leaning tower vicinity');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_a_cancelled, 'trash', 2, 'clean_dry');

  -- =========================================================================
  -- GROUP B: test_a is Collector ('Claimed Tasks' tab, requested by test_b)
  -- =========================================================================

  -- B.1 Claimed / Accepted (test_a claimed, ready to start)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_b_accepted, user_b, user_a, 'accepted', dist_kinta, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 3}, {"class": "cardboard", "quantity": 7}]'::jsonb,
    now() - interval '30 minutes', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1180, 4.6120), 4326),
    now() - interval '30 minutes', now() - interval '2 hours', now() - interval '30 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_b_accepted, extensions.st_setsrid(extensions.st_makepoint(101.1180, 4.6120), 4326), '3', 'Jalan Medan Ipoh 6', 'Behind shopping centre');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_b_accepted, 'metal', 3, 'clean_dry'), (r_b_accepted, 'cardboard', 7, 'clean_dry');

  -- B.2 In Progress (test_a currently on the route)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_b_in_prog, user_b, user_a, 'in_progress', dist_kampar, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 10}, {"class": "paper", "quantity": 8}]'::jsonb,
    now() - interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1500, 4.3200), 4326),
    now() - interval '1 hour', now() - interval '3 hours', now() - interval '20 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_b_in_prog, extensions.st_setsrid(extensions.st_makepoint(101.1500, 4.3200), 4326), '18', 'Jalan Kolej, Kampar', 'Near sports complex');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_b_in_prog, 'plastic', 10, 'clean_dry'), (r_b_in_prog, 'paper', 8, 'clean_dry');

  -- B.3 Review (test_a submitted proof to test_b)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_b_review, user_b, user_a, 'awaiting_confirmation', dist_manjung, rule_id, rule_ver,
    '[{"class": "glass", "quantity": 4}, {"class": "cardboard", "quantity": 5}]'::jsonb,
    now() - interval '2 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(100.6900, 4.2150), 4326),
    now() - interval '2 hours', now() - interval '4 hours', now() - interval '10 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_b_review, extensions.st_setsrid(extensions.st_makepoint(100.6900, 4.2150), 4326), '22', 'Jalan Teluk Muroh, Sitiawan', 'Near roundabout');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_b_review, 'glass', 4, 'clean_dry'), (r_b_review, 'cardboard', 5, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_b_review, user_a, sample_proof_path, now() - interval '10 minutes');

  -- B.4 Completed (test_a finished collection, rated 5 stars by test_b)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_b_completed, user_b, user_a, 'completed', dist_batang, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 25}]'::jsonb,
    now() - interval '1 day', now() - interval '2 hours',
    extensions.st_setsrid(extensions.st_makepoint(101.2600, 4.1800), 4326),
    now() - interval '1 day', now() - interval '2 days', now() - interval '3 hours'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_b_completed, extensions.st_setsrid(extensions.st_makepoint(101.2600, 4.1800), 4326), '11', 'Jalan Tapah Road, Tapah', 'Shop lot ground floor');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, collector_quantity, preparation_state)
  VALUES (r_b_completed, 'paper', 25, 25, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_b_completed, user_a, sample_proof_path, now() - interval '3 hours');
  INSERT INTO public.pickup_ratings (request_id, requester_id, collector_id, rating, feedback_note)
  VALUES (r_b_completed, user_b, user_a, 5, 'Super fast collection, thank you!');

  -- B.5 Disputed (test_a task disputed by test_b)
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, claimed_at, created_at, updated_at
  ) VALUES (
    r_b_disputed, user_b, user_a, 'disputed', dist_kerian, rule_id, rule_ver,
    '[{"class": "metal", "quantity": 5}, {"class": "plastic", "quantity": 6}]'::jsonb,
    now() - interval '6 hours', now() + interval '1 day',
    extensions.st_setsrid(extensions.st_makepoint(100.4900, 5.1200), 4326),
    now() - interval '5 hours', now() - interval '7 hours', now() - interval '2 hours'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (r_b_disputed, extensions.st_setsrid(extensions.st_makepoint(100.4900, 5.1200), 4326), '7', 'Jalan Parit Buntar, Parit Buntar', 'Near old bridge');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (r_b_disputed, 'metal', 5, 'clean_dry'), (r_b_disputed, 'plastic', 6, 'clean_dry');
  INSERT INTO public.pickup_proofs (request_id, uploaded_by, storage_path, captured_at)
  VALUES (r_b_disputed, user_a, sample_proof_path, now() - interval '2 hours');
  INSERT INTO public.disputes (request_id, raised_by, reason)
  VALUES (r_b_disputed, user_b, 'Collector reported unable to locate the gate entrance.');

  -- =========================================================================
  -- GROUP C: Open Marketplace Listings (For 'Collect' Map Screen)
  -- =========================================================================

  -- C.1 Open Listing in Kinta / Batu Gajah
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    m_open_1, user_b, null, 'pending', dist_kinta, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 10}, {"class": "metal", "quantity": 4}]'::jsonb,
    now() + interval '1 hour', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.0345, 4.4682), 4326),
    now() - interval '30 minutes', now() - interval '30 minutes'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (m_open_1, extensions.st_setsrid(extensions.st_makepoint(101.0345, 4.4682), 4326), '14', 'Jalan Batu Gajah, Pusing', 'Near petrol kiosk');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (m_open_1, 'plastic', 10, 'clean_dry'), (m_open_1, 'metal', 4, 'clean_dry');

  -- C.2 Open Listing in Kuala Kangsar / Sungai Siput
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    m_open_2, user_b, null, 'pending', dist_kk, rule_id, rule_ver,
    '[{"class": "cardboard", "quantity": 8}]'::jsonb,
    now() + interval '2 hours', now() + interval '2 days',
    extensions.st_setsrid(extensions.st_makepoint(101.0722, 4.8188), 4326),
    now() - interval '1 hour', now() - interval '1 hour'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (m_open_2, extensions.st_setsrid(extensions.st_makepoint(101.0722, 4.8188), 4326), '55', 'Jalan Besar, Sungai Siput', 'Near wet market');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (m_open_2, 'cardboard', 8, 'clean_dry');

  -- C.3 Open Listing in Hulu Perak / Gerik
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    m_open_3, user_b, null, 'pending', dist_hulu, rule_id, rule_ver,
    '[{"class": "paper", "quantity": 12}, {"class": "glass", "quantity": 6}]'::jsonb,
    now() + interval '3 hours', now() + interval '3 days',
    extensions.st_setsrid(extensions.st_makepoint(101.1290, 5.4260), 4326),
    now() - interval '2 hours', now() - interval '2 hours'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (m_open_3, extensions.st_setsrid(extensions.st_makepoint(101.1290, 5.4260), 4326), '101', 'Jalan Takari, Gerik', 'Near town square');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (m_open_3, 'paper', 12, 'clean_dry'), (m_open_3, 'glass', 6, 'clean_dry');

  -- C.4 Open Listing in Hilir Perak / Bagan Datuk
  INSERT INTO public.pickup_requests_public (
    id, requester_id, collector_id, status, district_id, rule_set_id, rule_set_version,
    material_summary, pickup_window_start, pickup_window_end, approximate_location, created_at, updated_at
  ) VALUES (
    m_open_4, user_b, null, 'pending', dist_hilir, rule_id, rule_ver,
    '[{"class": "plastic", "quantity": 15}]'::jsonb,
    now() + interval '4 hours', now() + interval '3 days',
    extensions.st_setsrid(extensions.st_makepoint(100.7845, 3.9912), 4326),
    now() - interval '3 hours', now() - interval '3 hours'
  );
  INSERT INTO public.pickup_request_private_details (request_id, exact_location, unit_number, street, landmark)
  VALUES (m_open_4, extensions.st_setsrid(extensions.st_makepoint(100.7845, 3.9912), 4326), '8', 'Jalan Bagan Pasir, Bagan Datuk', 'Seafood village entry');
  INSERT INTO public.pickup_waste_items (request_id, app_class, requester_quantity, preparation_state)
  VALUES (m_open_4, 'plastic', 15, 'clean_dry');

END $$;

ALTER TABLE public.profiles ENABLE TRIGGER profiles_prevent_privilege_escalation;

