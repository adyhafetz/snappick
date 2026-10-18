import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../supabase/tests/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const requesterCredentials = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };
let claimUsers;
try { claimUsers = JSON.parse(process.env.CLAIM_RACE_USERS_JSON ?? '[]'); } catch { claimUsers = []; }
if (!url || !anonKey || !requesterCredentials.email || !requesterCredentials.password || !Array.isArray(claimUsers) || claimUsers.length !== 10) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_A_EMAIL/PASSWORD, and CLAIM_RACE_USERS_JSON to an array of exactly 10 {email,password} test accounts.');
}
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) {
  throw new Error('Claim race is local-only. Use http://127.0.0.1:54321.');
}

function client() {
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(credentials) {
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  assert.ifError(error);
  return supabase;
}

const requester = await signIn(requesterCredentials);
const collectors = await Promise.all(claimUsers.map(signIn));
const now = new Date();
const start = new Date(now.getTime() + 86400000);
start.setHours(9, 0, 0, 0);
const end = new Date(start);
end.setHours(12, 0, 0, 0);
let requestId;
try {
  const { data, error } = await requester.rpc('create_pickup_request', {
    p_lat: 4.5975, p_lng: 101.0901, p_unit_number: 'race-test', p_street: 'race-test',
    p_landmark: null, p_access_instructions: null, p_pickup_note: null,
    p_pickup_window_start: start.toISOString(), p_pickup_window_end: end.toISOString(),
    p_items: [{ id: `race-${crypto.randomUUID()}`, class: 'paper', source: 'user_added', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' }],
    p_restricted_item_confirmation: true,
  });
  assert.ifError(error);
  requestId = (Array.isArray(data) ? data[0] : data)?.id;
  assert.ok(requestId, 'fixture request is created through the real Phase 7 RPC');

  const attempts = await Promise.all(collectors.map((supabase) => supabase.rpc('claim_pickup_request', { request_id: requestId })));
  const winners = attempts.filter((attempt) => !attempt.error);
  assert.equal(winners.length, 1, `expected one real RPC winner; got ${winners.length}`);
  assert.ok(attempts.filter((attempt) => attempt.error).every((attempt) => /already_claimed|unavailable/i.test(attempt.error.message)));
  const winner = attempts.findIndex((attempt) => !attempt.error);
  const released = await collectors[winner].rpc('release_pickup_request', { request_id: requestId });
  assert.ifError(released.error);
  const cancelled = await requester.rpc('cancel_pickup_request', { request_id: requestId });
  assert.ifError(cancelled.error);
  console.log('PASS: ten authenticated clients raced the production claim_pickup_request RPC; exactly one won. Fixture released and cancelled.');
} finally {
  await Promise.all([requester.auth.signOut(), ...collectors.map((supabase) => supabase.auth.signOut())]);
}
