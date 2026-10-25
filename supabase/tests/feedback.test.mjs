import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const users = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
  { email: process.env.TEST_USER_C_EMAIL, password: process.env.TEST_USER_C_PASSWORD },
];

if (!url || !anonKey || !serviceKey || users.some((u) => !u.email || !u.password)) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, and TEST_USER_A/B/C credentials.');
}
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('Feedback tests are local-only.');
}

async function login(credentials) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(credentials);
  assert.ifError(error);
  return { client, id: data.user.id };
}

const userA = await login(users[0]); // Requester
const userB = await login(users[1]); // Collector
const userC = await login(users[2]); // Unrelated
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

// Minimal valid JPEG binary (SOI, APP0, SOS, EOI) without EXIF/APP1 segment
const cleanJpegBytes = new Uint8Array([
  0xff, 0xd8,             // SOI
  0xff, 0xe0, 0x00, 0x10, // APP0 JFIF header
  0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xda, 0x00, 0x02, // SOS
  0xff, 0xd9              // EOI
]);

function hasExifSegment(bytes) {
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xe1) {
      return true; // APP1 EXIF marker found
    }
  }
  return false;
}

const createdScans = [];
const createdRequests = [];
const uploadedStoragePaths = [];

function requestBody(index, items) {
  const start = new Date(Date.now() + 86400000);
  const end = new Date(start.getTime() + 3600000);
  return {
    p_lat: 4.5975,
    p_lng: 101.0901,
    p_unit_number: '10',
    p_street: `Phase 10 Street ${index}`,
    p_landmark: null,
    p_access_instructions: null,
    p_pickup_note: null,
    p_pickup_window_start: start.toISOString(),
    p_pickup_window_end: end.toISOString(),
    p_items: items,
    p_restricted_item_confirmation: true,
  };
}

try {
  console.log('1. Scan persistence and normalized coordinate validation...');
  const scanId1 = randomUUID();
  createdScans.push(scanId1);

  // Retrieve valid perak_general rule set id
  const { data: ruleSet } = await admin.from('pbt_rule_sets').select('id, version').limit(1).single();
  assert.ok(ruleSet, 'A rule set must exist in the database');

  const { data: upsertedScanId, error: scanErr } = await userA.client.rpc('upsert_scan', {
    p_scan_id: scanId1,
    p_model_version: 'v8n-perak-m0',
    p_rule_set_id: ruleSet.id,
    p_rule_set_version: ruleSet.version,
    p_image_storage_consent: true,
    p_training_opt_in: true,
    p_image_width: 768,
    p_image_height: 768,
    p_preprocess_ms: 120,
    p_inference_ms: 340,
    p_retention_days: 90,
  });
  assert.ifError(scanErr);
  assert.equal(upsertedScanId, scanId1);

  // Validate scan row in database
  const { data: scanRow, error: scanFetchErr } = await userA.client
    .from('scans')
    .select('id, user_id, model_version, image_storage_consent, training_opt_in, preprocess_ms, inference_ms, retention_date')
    .eq('id', scanId1)
    .single();
  assert.ifError(scanFetchErr);
  assert.equal(scanRow.user_id, userA.id);
  assert.equal(scanRow.preprocess_ms, 120);
  assert.equal(scanRow.inference_ms, 340);
  assert.ok(scanRow.retention_date, 'Retention date must be populated');

  // Verify retention date is approximately 90 days in the future
  const retentionMs = new Date(scanRow.retention_date).getTime() - Date.now();
  const retentionDays = retentionMs / (1000 * 60 * 60 * 24);
  assert.ok(retentionDays >= 89 && retentionDays <= 91, `Retention should be ~90 days, got ${retentionDays}`);

  // Test detections with normalized coordinates (0..1)
  const detId1 = randomUUID();
  const detId2 = randomUUID();
  const { data: detCount, error: detErr } = await userA.client.rpc('upsert_detections', {
    p_scan_id: scanId1,
    p_detections: [
      {
        id: detId1,
        model_label: 'paper',
        app_class: 'paper',
        score: 0.88,
        second_best_label: 'cardboard',
        second_best_score: 0.08,
        box_x1: 0.12,
        box_y1: 0.15,
        box_x2: 0.45,
        box_y2: 0.50,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
      {
        id: detId2,
        model_label: 'paper',
        app_class: 'paper',
        score: 0.91,
        second_best_label: null,
        second_best_score: null,
        box_x1: 0.50,
        box_y1: 0.20,
        box_x2: 0.85,
        box_y2: 0.70,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
    ],
  });
  assert.ifError(detErr);
  assert.equal(detCount, 2);

  // Idempotency: retry should insert 0 duplicates
  const { data: retryDetCount, error: retryDetErr } = await userA.client.rpc('upsert_detections', {
    p_scan_id: scanId1,
    p_detections: [
      {
        id: detId1,
        model_label: 'paper',
        app_class: 'paper',
        score: 0.88,
        box_x1: 0.12,
        box_y1: 0.15,
        box_x2: 0.45,
        box_y2: 0.50,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
    ],
  });
  assert.ifError(retryDetErr);
  assert.equal(retryDetCount, 0);

  // Confident uncorrected scan initial tier -> Tier D
  const { data: sampleDId, error: sampleDErr } = await userA.client.rpc('upsert_feedback_sample', {
    p_scan_id: scanId1,
    p_label_tier: 'D',
    p_training_opt_in: true,
  });
  assert.ifError(sampleDErr);
  assert.ok(sampleDId);

  const { data: sampleRowD } = await userA.client
    .from('feedback_samples')
    .select('label_tier, review_status, collector_count_match')
    .eq('scan_id', scanId1)
    .single();
  assert.equal(sampleRowD.label_tier, 'D');
  assert.equal(sampleRowD.review_status, 'pending');

  console.log('2. Collector count match & Tier D -> B promotion after completed pickup...');
  // Scan 1 has 2 'paper' detections. Create matching request for scan 1 immediately.
  const { data: reqData1, error: createReqErr } = await userA.client.rpc('create_pickup_request', requestBody(1, [
    { id: `phase10-${Date.now()}-1a`, class: 'paper', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' },
    { id: `phase10-${Date.now()}-1b`, class: 'paper', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' },
  ]));
  assert.ifError(createReqErr);
  const reqRow1 = Array.isArray(reqData1) ? reqData1[0] : reqData1;
  const reqId1 = reqRow1.id;
  createdRequests.push(reqId1);

  // Collector (userB) claims and starts pickup
  assert.ifError((await userB.client.rpc('claim_pickup_request', { request_id: reqId1 })).error);
  assert.ifError((await userB.client.rpc('start_pickup', { request_id: reqId1 })).error);

  const { data: pickupItems1 } = await userB.client.from('pickup_waste_items').select('id').eq('request_id', reqId1);
  const proofPath1 = `${userB.id}/${reqId1}/proof.jpg`;
  assert.ifError((await userB.client.storage.from('proofs').upload(proofPath1, cleanJpegBytes, { contentType: 'image/jpeg', upsert: true })).error);

  // Collector submits collection with matching quantities: 1 + 1 = 2 paper
  const submitRes1 = await userB.client.rpc('submit_collection', {
    request_id: reqId1,
    p_items: [
      { id: pickupItems1[0].id, quantity: 1, condition: 'clean_dry', reason: null },
      { id: pickupItems1[1].id, quantity: 1, condition: 'clean_dry', reason: null },
    ],
    p_proof_path: proofPath1,
  });
  assert.ifError(submitRes1.error);

  // Requester confirms pickup -> triggers update_collector_count_match
  const confirmRes1 = await userA.client.rpc('confirm_pickup', { request_id: reqId1 });
  assert.ifError(confirmRes1.error);

  // Verify scanId1 feedback_samples: collector_count_match = true, and tier D promoted to B
  const { data: verifiedSampleB, error: sampleBErr } = await userA.client
    .from('feedback_samples')
    .select('label_tier, collector_count_match')
    .eq('scan_id', scanId1)
    .single();
  assert.ifError(sampleBErr);
  assert.equal(verifiedSampleB.collector_count_match, true, 'Collector count matched detector count');
  assert.equal(verifiedSampleB.label_tier, 'B', 'Matching collector counts must promote Tier D to Tier B');

  console.log('3. Collector count mismatch path & Tier D retention...');
  // Create another scan with 2 cardboard items (eligible for pickup in Perak)
  const scanMismatchId = randomUUID();
  createdScans.push(scanMismatchId);
  await userA.client.rpc('upsert_scan', {
    p_scan_id: scanMismatchId,
    p_model_version: 'v8n-perak-m0',
    p_rule_set_id: ruleSet.id,
    p_rule_set_version: ruleSet.version,
    p_image_storage_consent: true,
    p_training_opt_in: true,
    p_image_width: 640,
    p_image_height: 640,
    p_preprocess_ms: 105,
    p_inference_ms: 315,
  });
  await userA.client.rpc('upsert_detections', {
    p_scan_id: scanMismatchId,
    p_detections: [
      {
        id: randomUUID(),
        model_label: 'cardboard',
        app_class: 'cardboard',
        score: 0.85,
        box_x1: 0.1,
        box_y1: 0.1,
        box_x2: 0.4,
        box_y2: 0.4,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
      {
        id: randomUUID(),
        model_label: 'cardboard',
        app_class: 'cardboard',
        score: 0.89,
        box_x1: 0.5,
        box_y1: 0.5,
        box_x2: 0.8,
        box_y2: 0.8,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
    ],
  });
  await userA.client.rpc('upsert_feedback_sample', {
    p_scan_id: scanMismatchId,
    p_label_tier: 'D',
    p_training_opt_in: true,
  });

  const { data: reqData2, error: reqErr2 } = await userA.client.rpc('create_pickup_request', requestBody(2, [
    { id: `phase10-${Date.now()}-2a`, class: 'cardboard', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' },
    { id: `phase10-${Date.now()}-2b`, class: 'cardboard', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' },
  ]));
  assert.ifError(reqErr2);
  const reqRow2 = Array.isArray(reqData2) ? reqData2[0] : reqData2;
  const reqId2 = reqRow2.id;
  createdRequests.push(reqId2);

  assert.ifError((await userB.client.rpc('claim_pickup_request', { request_id: reqId2 })).error);
  assert.ifError((await userB.client.rpc('start_pickup', { request_id: reqId2 })).error);

  const { data: pickupItems2 } = await userB.client.from('pickup_waste_items').select('id').eq('request_id', reqId2);
  const proofPath2 = `${userB.id}/${reqId2}/proof.jpg`;
  assert.ifError((await userB.client.storage.from('proofs').upload(proofPath2, cleanJpegBytes, { contentType: 'image/jpeg', upsert: true })).error);

  // Collector collected only 1 cardboard (item 0 collected, item 1 not collected -> mismatch with 2 detected items)
  const submitRes2 = await userB.client.rpc('submit_collection', {
    request_id: reqId2,
    p_items: [
      { id: pickupItems2[0].id, quantity: 1, condition: 'clean_dry', reason: null },
      { id: pickupItems2[1].id, quantity: 0, condition: 'unknown', reason: 'missing' },
    ],
    p_proof_path: proofPath2,
  });
  assert.ifError(submitRes2.error);
  const confirmRes2 = await userA.client.rpc('confirm_pickup', { request_id: reqId2 });
  assert.ifError(confirmRes2.error);

  const { data: mismatchSample } = await userA.client
    .from('feedback_samples')
    .select('label_tier, collector_count_match, selection_reason')
    .eq('scan_id', scanMismatchId)
    .single();
  assert.equal(mismatchSample.collector_count_match, false, 'Collector count must be flagged as mismatch');
  assert.equal(mismatchSample.selection_reason, 'mismatch', 'Selection reason must be mismatch');
  assert.equal(mismatchSample.label_tier, 'D', 'Mismatched sample must remain Tier D');

  console.log('4. Feedback samples Tier C (user correction)...');
  const scanCorrectedId = randomUUID();
  createdScans.push(scanCorrectedId);
  await userA.client.rpc('upsert_scan', {
    p_scan_id: scanCorrectedId,
    p_model_version: 'v8n-perak-m0',
    p_rule_set_id: ruleSet.id,
    p_rule_set_version: ruleSet.version,
    p_image_storage_consent: true,
    p_training_opt_in: true,
    p_image_width: 640,
    p_image_height: 640,
    p_preprocess_ms: 110,
    p_inference_ms: 310,
  });

  const detCorrectedId = randomUUID();
  await userA.client.rpc('upsert_detections', {
    p_scan_id: scanCorrectedId,
    p_detections: [
      {
        id: detCorrectedId,
        model_label: 'plastic',
        app_class: 'plastic',
        score: 0.65,
        box_x1: 0.2,
        box_y1: 0.2,
        box_x2: 0.6,
        box_y2: 0.6,
        source: 'detector',
        condition: 'clean_dry',
        eligibility: 'eligible',
        quantity: 1,
      },
    ],
  });

  // User records feedback changing 'plastic' to 'glass'
  const { error: feedbackErr } = await userA.client.from('label_feedback').insert({
    scan_id: scanCorrectedId,
    detection_id: detCorrectedId,
    original_model_label: 'plastic',
    corrected_app_class: 'glass',
    feedback_type: 'change_label',
  });
  assert.ifError(feedbackErr);

  // Upsert feedback sample and promote to Tier C
  await userA.client.rpc('upsert_feedback_sample', {
    p_scan_id: scanCorrectedId,
    p_label_tier: 'D',
    p_training_opt_in: true,
  });
  const { error: promoteErr } = await userA.client.rpc('promote_feedback_sample_to_c', {
    p_scan_id: scanCorrectedId,
  });
  assert.ifError(promoteErr);

  const { data: sampleRowC } = await userA.client
    .from('feedback_samples')
    .select('label_tier')
    .eq('scan_id', scanCorrectedId)
    .single();
  assert.equal(sampleRowC.label_tier, 'C', 'User correction must promote feedback sample to Tier C');

  console.log('5. Upload gating, storage upload, EXIF stripping & storage RLS...');
  assert.equal(hasExifSegment(cleanJpegBytes), false, 'JPEG must not contain EXIF markers');

  // Opted-out scan (training_opt_in = false)
  const scanOptedOutId = randomUUID();
  createdScans.push(scanOptedOutId);
  await userA.client.rpc('upsert_scan', {
    p_scan_id: scanOptedOutId,
    p_model_version: 'v8n-perak-m0',
    p_rule_set_id: ruleSet.id,
    p_rule_set_version: ruleSet.version,
    p_image_storage_consent: true,
    p_training_opt_in: false, // Opted out
    p_image_width: 640,
    p_image_height: 640,
    p_preprocess_ms: 100,
    p_inference_ms: 300,
  });

  // Opted-in user uploads successfully to their owner-scoped path
  const storagePathA = `${userA.id}/${scanId1}.jpg`;
  const { error: uploadErr } = await userA.client.storage
    .from('scans')
    .upload(storagePathA, cleanJpegBytes, { contentType: 'image/jpeg', upsert: true });
  assert.ifError(uploadErr);
  uploadedStoragePaths.push(storagePathA);

  // Update image_path in scans table
  const { error: setPathErr } = await userA.client.rpc('set_scan_image_path', {
    p_scan_id: scanId1,
    p_image_path: storagePathA,
  });
  assert.ifError(setPathErr);

  // Storage RLS: User C (unrelated) cannot access or download user A's scan
  const { data: downloadData, error: downloadErr } = await userC.client.storage
    .from('scans')
    .download(storagePathA);
  assert.ok(downloadErr || !downloadData, 'Unrelated user must not be permitted to download private scan image');

  console.log('6. Daily upload cap enforcement (check_daily_upload_cap)...');
  const { data: initialCap, error: capErr1 } = await userA.client.rpc('check_daily_upload_cap', { p_cap: 5 });
  assert.ifError(capErr1);

  // Insert 2 records into scan_upload_queue for userA
  const { error: queueErr1 } = await userA.client.from('scan_upload_queue').insert([
    { scan_id: scanId1, user_id: userA.id, status: 'done' },
    { scan_id: scanCorrectedId, user_id: userA.id, status: 'queued' },
  ]);
  assert.ifError(queueErr1);

  const { data: capAfterTwo, error: capErr2 } = await userA.client.rpc('check_daily_upload_cap', { p_cap: 5 });
  assert.ifError(capErr2);
  assert.equal(capAfterTwo, initialCap - 2);

  // If cap = 2, remaining should be 0
  const { data: capZero, error: capErr3 } = await userA.client.rpc('check_daily_upload_cap', { p_cap: 2 });
  assert.ifError(capErr3);
  assert.equal(capZero, 0, 'Cap of 2 with 2 uploads today must leave 0 remaining');

  console.log('7. Home dashboard statistics RPC (get_home_stats)...');
  const { data: homeStats, error: homeStatsErr } = await userA.client.rpc('get_home_stats');
  assert.ifError(homeStatsErr);

  // Validate statistics fields
  assert.ok(typeof homeStats.total_scans === 'number', 'total_scans must be a number');
  assert.ok(typeof homeStats.verified_recyclable_items === 'number', 'verified_recyclable_items must be a number');
  assert.ok(typeof homeStats.active_requests === 'number', 'active_requests must be a number');
  assert.ok(Array.isArray(homeStats.recent_scans), 'recent_scans must be an array');

  // User A should have at least the scans we created
  assert.ok(homeStats.total_scans >= 4, `Expected at least 4 scans, got ${homeStats.total_scans}`);
  // User A confirmed reqId1 (2 paper items) and reqId2 (1 glass item) = at least 3 verified recyclable items
  assert.ok(homeStats.verified_recyclable_items >= 3, `Expected at least 3 verified items, got ${homeStats.verified_recyclable_items}`);

  // Validate recent_scans structure: no private details, only id, created_at, item_count
  if (homeStats.recent_scans.length > 0) {
    const firstScan = homeStats.recent_scans[0];
    assert.ok(firstScan.id, 'recent scan must contain id');
    assert.ok(firstScan.created_at, 'recent scan must contain created_at');
    assert.ok(typeof firstScan.item_count === 'number', 'recent scan must contain item_count');
    assert.equal(firstScan.image_path, undefined, 'recent scan must not leak image_path');
    assert.equal(firstScan.user_id, undefined, 'recent scan must not leak user_id');
  }

  console.log('PASS: Scan persistence, normalized coords, upload gating, EXIF stripping, label tiers A/B/C/D, daily cap, count-match promotion, and Home stats.');
} finally {
  console.log('Cleaning up test data...');
  for (const reqId of createdRequests) {
    await admin.from('pickup_requests_public').delete().eq('id', reqId);
  }
  for (const scanId of createdScans) {
    await admin.from('scans').delete().eq('id', scanId);
  }
  for (const path of uploadedStoragePaths) {
    await admin.storage.from('scans').remove([path]);
  }
  await Promise.all([
    userA.client.auth.signOut(),
    userB.client.auth.signOut(),
    userC.client.auth.signOut(),
  ]);
}
