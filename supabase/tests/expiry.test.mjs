import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const accounts = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
];
if (!url || !anonKey || !serviceKey || accounts.some((account) => !account.email || !account.password)) {
  throw new Error('Set local Supabase URL/anon/service keys and both disposable test account pairs.');
}
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Expiry tests are local-only.');

async function signIn(credentials) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword(credentials);
  assert.ifError(error);
  return client;
}
const requester = await signIn(accounts[0]);
const collector = await signIn(accounts[1]);
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const ids = [];

async function create(index) {
  const start = new Date(Date.now() + 86400000); start.setHours(9, 0, 0, 0);
  const end = new Date(start); end.setHours(12, 0, 0, 0);
  const { data, error } = await requester.rpc('create_pickup_request', {
    p_lat: 4.5975, p_lng: 101.0901, p_unit_number: 'test', p_street: `Expiry ${index}`,
    p_landmark: null, p_access_instructions: null, p_pickup_note: null,
    p_pickup_window_start: start.toISOString(), p_pickup_window_end: end.toISOString(),
    p_items: [{ id: `expiry-${Date.now()}-${index}`, class: 'paper', source: 'user_added', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' }],
    p_restricted_item_confirmation: true,
  });
  assert.ifError(error);
  const id = (Array.isArray(data) ? data[0] : data).id;
  ids.push(id);
  return id;
}

try {
  const [oldAccepted, oldInProgress] = await Promise.all([create(1), create(2)]);
  for (const id of ids) assert.ifError((await collector.rpc('claim_pickup_request', { request_id: id })).error);
  assert.ifError((await collector.rpc('start_pickup', { request_id: oldInProgress })).error);
  const oldTime = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  assert.ifError((await admin.rpc('set_pickup_claimed_at_for_test', { request_id: oldAccepted, p_claimed_at: oldTime })).error);
  assert.ifError((await admin.rpc('set_pickup_claimed_at_for_test', { request_id: oldInProgress, p_claimed_at: oldTime })).error);
  const expired = await admin.rpc('expire_unstarted_pickup_claims', { p_now: new Date().toISOString() });
  assert.ifError(expired.error);
  assert.equal(expired.data, 1);
  const repeated = await admin.rpc('expire_unstarted_pickup_claims', { p_now: new Date().toISOString() });
  assert.ifError(repeated.error);
  assert.equal(repeated.data, 0, 'a second expiry run has no further changes');
  const acceptedState = await requester.from('my_pickup_requests').select('id,status').eq('id', oldAccepted).single();
  assert.ifError(acceptedState.error);
  assert.equal(acceptedState.data.status, 'pending');
  const activeState = await collector.from('my_claimed_pickups').select('id,status').eq('id', oldInProgress).single();
  assert.ifError(activeState.error);
  assert.equal(activeState.data.status, 'in_progress');
  console.log('PASS: deterministic old accepted claims expire; in-progress claims remain; expiry is idempotent.');
} finally {
  await Promise.all([requester.auth.signOut(), collector.auth.signOut()]);
}
