// Backend checks that run against the REAL (remote) Supabase project, signed in as the two test accounts.
// It creates and cancels pickup requests, so it only runs when you opt in:
//
//   E2E_CONFIRM_REMOTE=yes SUPABASE_URL=... SUPABASE_ANON_KEY=... \
//   TEST_USER_A_EMAIL=... TEST_USER_A_PASSWORD=... TEST_USER_B_EMAIL=... TEST_USER_B_PASSWORD=... \
//   node remote-e2e.mjs
//
// User A acts as the requester and user B as the collector. Run `scripts/clean_database.sql`
// afterwards if you want the leftover completed/disputed test requests removed.
import { createClient } from '@supabase/supabase-js';

const env = process.env;
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TEST_USER_A_EMAIL', 'TEST_USER_A_PASSWORD', 'TEST_USER_B_EMAIL', 'TEST_USER_B_PASSWORD']) {
  if (!env[k]) throw new Error(`Set ${k}.`);
}
if (env.E2E_CONFIRM_REMOTE !== 'yes') {
  throw new Error('This writes test data to the remote project. Set E2E_CONFIRM_REMOTE=yes to continue.');
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}

async function login(email, password) {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c: client, id: data.user.id };
}

// A real-sized JPEG (the server rejects proof files under 1 KB).
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xfe, 0x04, 0x4c, ...new Uint8Array(0x044a), 0xff, 0xda, 0, 2, 0xff, 0xd9]);

function body(over = {}) {
  const start = new Date(Date.now() + 86400000);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start);
  end.setHours(12, 0, 0, 0);
  return {
    p_lat: 4.5975, p_lng: 101.0901, p_unit_number: '12A', p_street: 'Jalan Test', p_landmark: null,
    p_access_instructions: null, p_pickup_note: 'e2e-private-note',
    p_pickup_window_start: start.toISOString(), p_pickup_window_end: end.toISOString(),
    p_items: [{ id: 'i1', class: 'plastic', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' }],
    p_restricted_item_confirmation: true,
    ...over,
  };
}
const first = (d) => (Array.isArray(d) ? d[0] : d);

const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
const A = await login(env.TEST_USER_A_EMAIL, env.TEST_USER_A_PASSWORD);
const B = await login(env.TEST_USER_B_EMAIL, env.TEST_USER_B_PASSWORD);
const created = [];

async function create(over) {
  const r = await A.c.rpc('create_pickup_request', body(over));
  if (!r.error) created.push(first(r.data).id);
  return r;
}
async function submit(id, capturedAt = new Date().toISOString(), size = 'real') {
  const path = `${B.id}/${id}/proof.jpg`;
  await B.c.storage.from('proofs').upload(path, size === 'real' ? jpeg : jpeg.slice(0, 26), { contentType: 'image/jpeg', upsert: true });
  return B.c.rpc('submit_collection', { request_id: id, p_items: null, p_non_collection_reason: null, p_proof_path: path, p_captured_at: capturedAt });
}

try {
  console.log('--- creating a request');
  check('signed-out user cannot create', !!(await anon.rpc('create_pickup_request', body())).error);
  check('restricted-item confirmation required', !!(await create({ p_restricted_item_confirmation: false })).error);
  check('unknown material rejected', !!(await create({ p_items: [{ id: 'x', class: 'battery', source: 'detector', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' }] })).error);
  check('outside Perak rejected', !!(await create({ p_lat: 3.139, p_lng: 101.6869 })).error);
  const past = new Date(Date.now() - 86400000);
  check('window in the past rejected', !!(await create({ p_pickup_window_start: past.toISOString(), p_pickup_window_end: new Date(past.getTime() + 3 * 3600000).toISOString() })).error);

  console.log('--- lifecycle and privacy');
  const r1 = await create();
  check('valid request created', !r1.error, r1.error?.message);
  const id1 = first(r1.data)?.id;
  check('direct insert on the public table is blocked', !!(await A.c.from('pickup_requests_public').insert({ status: 'pending' })).error);
  check('non-owner cannot cancel', !!(await B.c.rpc('cancel_pickup_request', { request_id: id1 })).error);
  const hidden = await B.c.from('pickup_request_private_details').select('*').eq('request_id', id1);
  check('collector cannot read the address before claiming', !hidden.error && hidden.data.length === 0);
  check('requester cannot claim their own request', !!(await A.c.rpc('claim_pickup_request', { request_id: id1 })).error);
  check('collector claims', !(await B.c.rpc('claim_pickup_request', { request_id: id1 })).error);
  check('a second claim is rejected', !!(await B.c.rpc('claim_pickup_request', { request_id: id1 })).error);
  check('requester cannot start the pickup', !!(await A.c.rpc('start_pickup', { request_id: id1 })).error);
  check('collector releases', !(await B.c.rpc('release_pickup_request', { request_id: id1 })).error);
  check('collector claims again and starts', !(await B.c.rpc('claim_pickup_request', { request_id: id1 })).error && !(await B.c.rpc('start_pickup', { request_id: id1 })).error);

  console.log('--- proof photo rules');
  const noFile = await B.c.rpc('submit_collection', { request_id: id1, p_items: null, p_non_collection_reason: null, p_proof_path: `${B.id}/${id1}/missing.jpg`, p_captured_at: new Date().toISOString() });
  check('submitting without an uploaded file is rejected', !!noFile.error, noFile.error?.message);
  check('a 26-byte fake image is rejected', !!(await submit(id1, undefined, 'fake')).error);
  check('a proof taken 20 hours ago is rejected', !!(await submit(id1, new Date(Date.now() - 20 * 3600 * 1000).toISOString())).error);
  const png = await B.c.storage.from('proofs').upload(`${B.id}/${id1}/x.png`, jpeg, { contentType: 'image/png' });
  check('only JPEG files can be uploaded as proof', !!png.error, png.error?.message);
  const ok = await submit(id1);
  check('a recent real photo is accepted', !ok.error, ok.error?.message);
  check('collector cannot confirm or rate their own job', !!(await B.c.rpc('rate_and_confirm_pickup', { p_request_id: id1, p_rating: 5, p_feedback_note: null })).error);
  check('users cannot confirm without rating', !!(await A.c.rpc('confirm_pickup', { request_id: id1 })).error);

  console.log('--- dispute');
  check('a dispute needs a reason', !!(await A.c.rpc('raise_dispute', { request_id: id1, reason: '' })).error);
  check('requester raises a dispute', !(await A.c.rpc('raise_dispute', { request_id: id1, reason: 'e2e: items not collected' })).error);
  check('a disputed pickup cannot be rated', !!(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id1, p_rating: 5, p_feedback_note: null })).error);
  check('a non-admin cannot resolve a dispute', !!(await A.c.rpc('resolve_dispute', { request_id: id1, outcome: 'rejected', note: 'x' })).error);

  console.log('--- rating');
  const id2 = first((await create()).data).id;
  await B.c.rpc('claim_pickup_request', { request_id: id2 });
  await B.c.rpc('start_pickup', { request_id: id2 });
  await submit(id2);
  check('rating 0 is rejected', !!(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id2, p_rating: 0, p_feedback_note: null })).error);
  check('rating 6 is rejected', !!(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id2, p_rating: 6, p_feedback_note: null })).error);
  check('a note over 500 characters is rejected', !!(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id2, p_rating: 3, p_feedback_note: 'x'.repeat(501) })).error);
  check('rating and confirming works', !(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id2, p_rating: 4, p_feedback_note: null })).error);
  check('a pickup cannot be rated twice', !!(await A.c.rpc('rate_and_confirm_pickup', { p_request_id: id2, p_rating: 1, p_feedback_note: null })).error);
  const ratingsAnon = await anon.from('pickup_ratings').select('*').limit(1);
  check('signed-out users cannot read ratings', !ratingsAnon.data?.length);

  console.log('--- limits');
  let made = 0, stopped = null;
  for (let i = 0; i < 8; i++) {
    const r = await create();
    if (r.error) { stopped = r.error.message; break; }
    made++;
  }
  check('open requests are capped at 5 per user', made <= 5 && /OPEN_REQUEST_LIMIT/.test(stopped ?? ''), `created ${made}, then: ${stopped}`);
} finally {
  // Cancel anything still pending so the marketplace map is not left with test pins.
  for (const id of created) await A.c.rpc('cancel_pickup_request', { request_id: id });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:\n - ' + failed.map((f) => f.name).join('\n - '));
  process.exitCode = 1;
}
