// Adds demo activity through the app's own functions, signed in as the two test accounts:
//   * open pickup requests (the pins on the Collect map), 5 from test B and 3 from test A, around Ipoh
//   * the collector's proof photo for the demo pickup that test B is collecting (so it is awaiting confirmation)
// Run scripts/seed/demo_account.sql first (scripts/seed/demo_account.sql).
//
//   E2E_CONFIRM_REMOTE=yes SUPABASE_URL=... SUPABASE_ANON_KEY=... PROOF_JPEG=path/to/photo.jpg \
//   TEST_USER_A_EMAIL=... TEST_USER_A_PASSWORD=... TEST_USER_B_EMAIL=... TEST_USER_B_PASSWORD=... \
//   node seed-demo.mjs [seed|clean]
//
// "clean" cancels every open request of the two test accounts.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = process.env;
for (const k of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'TEST_USER_A_EMAIL', 'TEST_USER_A_PASSWORD', 'TEST_USER_B_EMAIL', 'TEST_USER_B_PASSWORD']) {
  if (!env[k]) throw new Error(`Set ${k}.`);
}
if (env.E2E_CONFIRM_REMOTE !== 'yes') throw new Error('This writes demo data to the remote project. Set E2E_CONFIRM_REMOTE=yes to continue.');
const mode = process.argv[2] ?? 'seed';

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
async function login(email, password) {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, opts);
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, id: data.user.id };
}
const A = await login(env.TEST_USER_A_EMAIL, env.TEST_USER_A_PASSWORD);
const B = await login(env.TEST_USER_B_EMAIL, env.TEST_USER_B_PASSWORD);

const item = (cls, quantity) => ({ id: `${cls}-${quantity}`, class: cls, source: 'user_added', condition: 'clean_dry', quantity, eligibility: 'eligible' });
const window = (days) => {
  const s = new Date(Date.now() + days * 86400000);
  s.setHours(9, 0, 0, 0);
  const e = new Date(s);
  e.setHours(12, 0, 0, 0);
  return { p_pickup_window_start: s.toISOString(), p_pickup_window_end: e.toISOString() };
};
const request = (lat, lng, street, unit, items, days = 1) => ({
  p_lat: lat, p_lng: lng, p_unit_number: unit, p_street: street, p_landmark: null, p_access_instructions: null, p_pickup_note: null,
  ...window(days), p_items: items, p_restricted_item_confirmation: true,
});

const PINS = {
  B: [
    request(4.6102, 101.0765, 'Jalan Tambun', '3', [item('plastic', 10), item('paper', 6)]),
    request(4.5851, 101.1003, 'Jalan Gopeng', '18', [item('cardboard', 8)]),
    request(4.6240, 101.0540, 'Jalan Kuala Kangsar', '41', [item('metal', 5), item('glass', 4)], 2),
    request(4.5712, 101.0705, 'Jalan Lahat', '9', [item('plastic', 14)]),
    request(4.6335, 101.1120, 'Jalan Ampang', '27', [item('paper', 12), item('cardboard', 5)], 2),
  ],
  A: [
    request(4.5975, 101.0901, 'Jalan Sultan Azlan Shah', '12A', [item('glass', 7), item('plastic', 3)]),
    request(4.6160, 101.0950, 'Jalan Kampar', '5', [item('paper', 9)]),
    request(4.5790, 101.0850, 'Jalan Bercham', '33', [item('metal', 6), item('cardboard', 4)], 2),
  ],
};

async function cancelOpen(who) {
  const { data, error } = await who.c.from('pickup_requests_public').select('id').eq('requester_id', who.id).eq('status', 'pending');
  if (error) throw error;
  const open = data.filter((r) => !r.id.startsWith('de000000-'));
  for (const r of open) await who.c.rpc('cancel_pickup_request', { request_id: r.id });
  return open.length;
}

if (mode === 'clean') {
  console.log(`cancelled ${await cancelOpen(A)} + ${await cancelOpen(B)} open requests`);
  process.exit(0);
}

// Replace the previous demo pins, then create the new ones.
await cancelOpen(A);
await cancelOpen(B);
let made = 0;
for (const [who, list] of [[A, PINS.A], [B, PINS.B]]) {
  for (const body of list) {
    const r = await who.c.rpc('create_pickup_request', body);
    if (r.error) console.log('create failed:', r.error.message);
    else made++;
  }
}
console.log(`created ${made} open requests`);

// Proof photo for the demo pickup that test B is collecting.
const proofId = 'de000000-0000-4000-8000-000000000302';
if (env.PROOF_JPEG) {
  const jpeg = readFileSync(env.PROOF_JPEG);
  const path = `${B.id}/${proofId}/proof.jpg`;
  const up = await B.c.storage.from('proofs').upload(path, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (up.error) console.log('proof upload failed:', up.error.message);
  else {
    const r = await B.c.rpc('submit_collection', { request_id: proofId, p_items: null, p_non_collection_reason: null, p_proof_path: path, p_captured_at: new Date().toISOString() });
    console.log(r.error ? `submit failed: ${r.error.message}` : 'proof submitted: the demo pickup is now awaiting confirmation');
  }
} else {
  console.log('PROOF_JPEG not set: the demo pickup stays in progress');
}
