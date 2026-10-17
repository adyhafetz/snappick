import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const userConfigs = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
];
const host = url ? new URL(url).hostname : '';
if (!['127.0.0.1', 'localhost'].includes(host)) {
  throw new Error('Pickup integration tests are local-only. Start Supabase locally and set SUPABASE_URL to http://127.0.0.1:54321.');
}
if (!anonKey || userConfigs.some((user) => !user.email || !user.password)) {
  throw new Error('Set SUPABASE_ANON_KEY and both TEST_USER_A/TEST_USER_B email and password variables.');
}

async function signIn(credentials) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(credentials);
  assert.ifError(error);
  assert.ok(data.user?.id);
  return { client, user: data.user };
}

const first = await signIn(userConfigs[0]);
const second = await signIn(userConfigs[1]);
const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const boundaryData = JSON.parse(await readFile(new URL('../seed/perak_districts.geojson', import.meta.url), 'utf8'));
const firstRing = boundaryData.features[0].geometry.coordinates[0][0];
const boundaryLng = (firstRing[0][0] + firstRing[1][0]) / 2;
const boundaryLat = (firstRing[0][1] + firstRing[1][1]) / 2;
const privateNote = `phase7-private-note-${Date.now()}`;

function item(className = 'paper', condition = 'clean_dry', source = 'detector', quantity = 1, id = 'box-1') {
  return { id, class: className, source, condition, quantity, eligibility: className === 'paper' ? 'eligible' : 'not_eligible' };
}

function requestBody(overrides = {}) {
  const start = new Date(Date.now() + 86400000);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  return {
    p_lat: 4.5975,
    p_lng: 101.0901,
    p_unit_number: '12A',
    p_street: 'Jalan Sample',
    p_landmark: null,
    p_access_instructions: null,
    p_pickup_note: privateNote,
    p_pickup_window_start: start.toISOString(),
    p_pickup_window_end: end.toISOString(),
    p_items: [item(), item('glass', 'broken_unsafe', 'user_added', 2, 'manual-1')],
    p_restricted_item_confirmation: true,
    ...overrides,
  };
}

function assertSafeError(error, privateText = privateNote) {
  assert.ok(error, 'RPC should reject invalid input');
  const message = `${error.message ?? ''} ${error.details ?? ''}`;
  assert.ok(!message.includes(privateText), 'RPC error must not echo a private note');
  assert.ok(!message.includes('4.5975') && !message.includes('101.0901'), 'RPC error must not echo exact coordinates');
}

try {
  const unauthenticated = await anonymous.rpc('create_pickup_request', requestBody());
  assertSafeError(unauthenticated.error);

  const restricted = await first.client.rpc('create_pickup_request', requestBody({ p_restricted_item_confirmation: false }));
  assertSafeError(restricted.error);
  assert.match(restricted.error.message.toLowerCase(), /restricted_item_confirmation_required/);

  const invalidClass = await first.client.rpc('create_pickup_request', requestBody({ p_items: [item('battery')] }));
  assertSafeError(invalidClass.error);
  assert.match(invalidClass.error.message.toLowerCase(), /invalid_pickup_item/);

  const invalidQuantity = await first.client.rpc('create_pickup_request', requestBody({
    p_items: [item('paper', 'clean_dry', 'user_added', 0, 'zero-quantity')],
  }));
  assertSafeError(invalidQuantity.error);
  assert.match(invalidQuantity.error.message.toLowerCase(), /invalid_pickup_item/);

  const noEligible = await first.client.rpc('create_pickup_request', requestBody({ p_items: [item('trash', 'clean_dry')] }));
  assertSafeError(noEligible.error);
  assert.match(noEligible.error.message.toLowerCase(), /no_eligible_items/);

  const invalid = await first.client.rpc('create_pickup_request', requestBody({ p_lat: 91 }));
  assertSafeError(invalid.error);
  assert.match(invalid.error.message.toLowerCase(), /invalid_coordinates/);

  for (const [name, latitude, longitude] of [['Kuala Lumpur', 3.139, 101.6869], ['Penang', 5.4141, 100.3288]]) {
    const outside = await first.client.rpc('create_pickup_request', requestBody({ p_lat: latitude, p_lng: longitude }));
    assertSafeError(outside.error);
    assert.match(outside.error.message.toLowerCase(), /outside_supported_service_area/, `${name} must be rejected server-side`);
  }

  const boundary = await first.client.rpc('resolve_pickup_area', { lat: boundaryLat, lng: boundaryLng });
  assert.ifError(boundary.error);
  assert.ok(Array.isArray(boundary.data) && boundary.data.length === 1, 'ST_Covers resolves a point on a district boundary');

  const createdResult = await first.client.rpc('create_pickup_request', requestBody());
  assert.ifError(createdResult.error);
  const created = Array.isArray(createdResult.data) ? createdResult.data[0] : createdResult.data;
  assert.ok(created?.id);
  assert.equal(created.status, 'pending');
  assert.ok(created.rule_set_id);
  assert.ok(created.rule_set_version >= 1);
  assert.deepEqual(created.material_summary, [{ class: 'paper', quantity: 1 }]);

  const { data: publicRows, error: publicError } = await first.client
    .from('pickup_requests_public')
    .select('id,status,rule_set_id,rule_set_version,material_summary,approximate_location,pickup_window_start,pickup_window_end')
    .eq('id', created.id)
    .single();
  assert.ifError(publicError);
  assert.equal(publicRows.status, 'pending');
  assert.equal(publicRows.rule_set_id, created.rule_set_id);
  assert.equal(publicRows.rule_set_version, created.rule_set_version);
  const snapped = publicRows.approximate_location.coordinates;
  assert.ok(Math.abs(snapped[0] * 100 - Math.round(snapped[0] * 100)) < 1e-7);
  assert.ok(Math.abs(snapped[1] * 100 - Math.round(snapped[1] * 100)) < 1e-7);
  assert.notDeepEqual(snapped, [requestBody().p_lng, requestBody().p_lat]);
  assert.ok(!('requester_id' in publicRows) && !('pickup_note' in publicRows));

  const { data: privateRows, error: privateError } = await first.client
    .from('pickup_request_private_details')
    .select('request_id,exact_location,unit_number,street,pickup_note')
    .eq('request_id', created.id);
  assert.ifError(privateError);
  assert.equal(privateRows.length, 1);
  assert.deepEqual(privateRows[0].exact_location.coordinates, [requestBody().p_lng, requestBody().p_lat]);
  assert.equal(privateRows[0].pickup_note, privateNote);

  const { data: wasteRows, error: wasteError } = await first.client
    .from('pickup_waste_items')
    .select('review_item_id,app_class,requester_quantity,accepted,preparation_state,source,eligibility')
    .eq('request_id', created.id)
    .order('review_item_id');
  assert.ifError(wasteError);
  assert.equal(wasteRows.length, 2, 'one checklist row is preserved for each reviewed item');
  assert.equal(wasteRows.find((row) => row.review_item_id === 'manual-1').requester_quantity, 2);
  assert.equal(wasteRows.find((row) => row.review_item_id === 'manual-1').accepted, false);

  const { data: otherPrivate, error: otherPrivateError } = await second.client
    .from('pickup_request_private_details')
    .select('request_id')
    .eq('request_id', created.id);
  assert.ifError(otherPrivateError);
  assert.deepEqual(otherPrivate, []);
  const { data: otherRequests, error: otherRequestsError } = await second.client
    .from('my_pickup_requests')
    .select('id')
    .eq('id', created.id);
  assert.ifError(otherRequestsError);
  assert.deepEqual(otherRequests, []);
  const { data: otherPublic, error: otherPublicError } = await second.client
    .from('pickup_requests_public')
    .select('id')
    .eq('id', created.id);
  assert.ifError(otherPublicError);
  assert.deepEqual(otherPublic, []);
  const { data: ownRequests, error: ownRequestsError } = await first.client
    .from('my_pickup_requests')
    .select('id,status')
    .eq('id', created.id);
  assert.ifError(ownRequestsError);
  assert.deepEqual(ownRequests, [{ id: created.id, status: 'pending' }]);

  const directPublicWrite = await first.client.from('pickup_requests_public').insert({ status: 'pending' });
  assert.ok(directPublicWrite.error, 'direct public request writes are denied');
  const directPrivateWrite = await first.client.from('pickup_request_private_details').insert({ request_id: created.id });
  assert.ok(directPrivateWrite.error, 'direct private detail writes are denied');

  const otherCancel = await second.client.rpc('cancel_pickup_request', { request_id: created.id });
  assertSafeError(otherCancel.error);
  assert.match(otherCancel.error.message.toLowerCase(), /request_not_cancellable/);
  const cancelled = await first.client.rpc('cancel_pickup_request', { request_id: created.id });
  assert.ifError(cancelled.error);
  const cancelledRow = Array.isArray(cancelled.data) ? cancelled.data[0] : cancelled.data;
  assert.equal(cancelledRow.status, 'cancelled');
  const repeatCancel = await first.client.rpc('cancel_pickup_request', { request_id: created.id });
  assertSafeError(repeatCancel.error);
  console.log('Pickup RPC/privacy integration passed: auth, geofence, eligibility, confirmation, grid snap, private details, requester isolation, direct-write denial, and cancellation.');
} finally {
  await Promise.all([first.client.auth.signOut(), second.client.auth.signOut()]);
}
