import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const users = [{ email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD }, { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD }, { email: process.env.TEST_USER_C_EMAIL, password: process.env.TEST_USER_C_PASSWORD }];
if (!url || !anon || !service || users.some((u) => !u.email || !u.password) || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Set local Supabase URL/keys and TEST_USER_A/B/C credentials.');
async function login(credentials) { const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }); const { data, error } = await client.auth.signInWithPassword(credentials); assert.ifError(error); return { client, id: data.user.id }; }
const requester = await login(users[0]);
const collector = await login(users[1]);
const unrelatedUser = await login(users[2]);
const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const created = [];
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0xff, 0xd9]);
function body(index) { const start = new Date(Date.now() + 86400000); const end = new Date(start.getTime() + 3600000); return { p_lat: 4.5975, p_lng: 101.0901, p_unit_number: '9', p_street: `Phase 9 ${index}`, p_landmark: null, p_access_instructions: null, p_pickup_note: null, p_pickup_window_start: start.toISOString(), p_pickup_window_end: end.toISOString(), p_items: [{ id: `phase9-${Date.now()}-${index}`, class: 'paper', source: 'user_added', condition: 'clean_dry', quantity: 2, eligibility: 'eligible' }], p_restricted_item_confirmation: true }; }
async function create(index) { const { data, error } = await requester.client.rpc('create_pickup_request', body(index)); assert.ifError(error); const row = Array.isArray(data) ? data[0] : data; created.push(row.id); return row.id; }
async function prepare(id) { assert.ifError((await collector.client.rpc('claim_pickup_request', { request_id: id })).error); assert.ifError((await collector.client.rpc('start_pickup', { request_id: id })).error); const { data, error } = await collector.client.from('pickup_waste_items').select('id,requester_quantity,preparation_state').eq('request_id', id); assert.ifError(error); return data[0]; }
async function uploadProof(id) { const path = `${collector.id}/${id}/proof.jpg`; const { error } = await collector.client.storage.from('proofs').upload(path, jpeg, { contentType: 'image/jpeg', upsert: false }); assert.ifError(error); return path; }
try {
  const happy = await create(1); const item = await prepare(happy); const proof = await uploadProof(happy);
  const submitted = await collector.client.rpc('submit_collection', { request_id: happy, p_items: [{ id: item.id, quantity: 2, condition: 'clean_dry', reason: null }], p_proof_path: proof }); assert.ifError(submitted.error); assert.equal(submitted.data[0].status, 'awaiting_confirmation');
  assert.ifError((await requester.client.rpc('confirm_pickup', { request_id: happy })).error);
  assert.equal((await admin.from('pickup_requests_public').select('status').eq('id', happy).single()).data.status, 'completed');

  const zero = await create(2); const zeroItem = await prepare(zero); const zeroProof = await uploadProof(zero); const zeroSubmit = await collector.client.rpc('submit_collection', { request_id: zero, p_items: [{ id: zeroItem.id, quantity: 0, condition: 'unknown', reason: 'missing' }], p_non_collection_reason: 'missing', p_proof_path: zeroProof }); assert.ifError(zeroSubmit.error); assert.equal(zeroSubmit.data[0].status, 'not_collected'); assert.ifError((await requester.client.rpc('relist_pickup', { request_id: zero })).error);

  const disputed = await create(3); const disputedItem = await prepare(disputed); const disputedProof = await uploadProof(disputed); assert.ifError((await collector.client.rpc('submit_collection', { request_id: disputed, p_items: [{ id: disputedItem.id, quantity: 2, condition: 'clean_dry', reason: null }], p_proof_path: disputedProof })).error); assert.ifError((await requester.client.rpc('raise_dispute', { request_id: disputed, reason: 'Pickup proof disputed' })).error); assert.equal((await admin.from('pickup_requests_public').select('status').eq('id', disputed).single()).data.status, 'disputed');

  const auto = await create(4); const autoItem = await prepare(auto); const autoProof = await uploadProof(auto); assert.ifError((await collector.client.rpc('submit_collection', { request_id: auto, p_items: [{ id: autoItem.id, quantity: 2, condition: 'clean_dry', reason: null }], p_proof_path: autoProof })).error); await admin.from('pickup_requests_public').update({ confirmation_deadline: new Date(Date.now() - 1000).toISOString() }).eq('id', auto); const first = await admin.rpc('auto_complete_pickups', { p_now: new Date().toISOString() }); assert.ifError(first.error); assert.equal(first.data, 1); const second = await admin.rpc('auto_complete_pickups', { p_now: new Date().toISOString() }); assert.ifError(second.error); assert.equal(second.data, 0);
  const unrelated = await create(5); const unauthorized = await unrelatedUser.client.functions.invoke('get-pickup-proof', { body: { request_id: auto } }); assert.ok(unauthorized.error, 'unrelated user must not access proof');
  console.log('PASS: collection submission, zero-collection reason/evidence, confirmation, dispute, relist authorization, idempotent auto-complete, and unrelated proof denial.');
} finally { for (const id of created) { await admin.from('pickup_requests_public').delete().eq('id', id); } await Promise.all([requester.client.auth.signOut(), collector.client.auth.signOut(), unrelatedUser.client.auth.signOut()]); }
