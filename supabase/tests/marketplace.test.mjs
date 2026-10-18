import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const credentials = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
];
if (!url || !anonKey || !serviceKey || credentials.some((user) => !user.email || !user.password)) {
  throw new Error('Set local Supabase URL/anon/service keys and both TEST_USER_A/TEST_USER_B account pairs.');
}
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Marketplace integration tests are local-only.');

async function signIn(user) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(user);
  assert.ifError(error);
  return { client, id: data.user.id };
}
const [requester, collector] = await Promise.all(credentials.map(signIn));
const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const requests = [];
let marketplaceChannel;

function body(index) {
  const start = new Date(Date.now() + 86400000);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start); end.setHours(12, 0, 0, 0);
  return {
    p_lat: 4.5975, p_lng: 101.0901, p_unit_number: 'test', p_street: `Test street ${index}`,
    p_landmark: null, p_access_instructions: null, p_pickup_note: null,
    p_pickup_window_start: start.toISOString(), p_pickup_window_end: end.toISOString(),
    p_items: [{ id: `phase8-${Date.now()}-${index}`, class: 'paper', source: 'user_added', condition: 'clean_dry', quantity: 1, eligibility: 'eligible' }],
    p_restricted_item_confirmation: true,
  };
}
async function create(index) {
  const { data, error } = await requester.client.rpc('create_pickup_request', body(index));
  assert.ifError(error);
  const row = Array.isArray(data) ? data[0] : data;
  requests.push(row.id);
  return row.id;
}
async function claim(client, id) { return client.rpc('claim_pickup_request', { request_id: id }); }

try {
  const self = await create(0);
  assert.match((await collector.client.rpc('start_pickup', { request_id: self })).error.message, /request_not_startable/i);
  const ownClaim = await claim(requester.client, self);
  assert.match(ownClaim.error.message, /cannot_claim_own_request/i);
  const unauthenticated = await claim(anonymous, self);
  assert.ok(unauthenticated.error, 'anonymous claims are denied');

  const first = await create(1);
  const channel = marketplaceChannel = collector.client.channel('pickup-marketplace')
    .on('broadcast', { event: 'refresh' }, () => {});
  const subscribed = new Promise((resolve, reject) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Realtime subscription ${status}`));
    });
  });
  await subscribed;
  assert.ifError((await claim(collector.client, first)).error);
  const claimedHidden = await collector.client.from('pending_pickup_marketplace').select('id').eq('id', first);
  assert.ifError(claimedHidden.error);
  assert.deepEqual(claimedHidden.data, [], 'claimed requests disappear from the pending map');
  assert.ifError((await collector.client.rpc('release_pickup_request', { request_id: first })).error);
  const releasedVisible = await collector.client.from('pending_pickup_marketplace').select('id').eq('id', first);
  assert.ifError(releasedVisible.error);
  assert.equal(releasedVisible.data.length, 1, 'released requests return to the pending map');
  assert.ifError((await claim(collector.client, first)).error);
  const acceptedView = await collector.client.from('my_claimed_pickups').select('id,status').eq('id', first);
  assert.deepEqual(acceptedView.data, [{ id: first, status: 'accepted' }]);
  const collectorDetails = await collector.client.functions.invoke('get-pickup-private-details', { body: { request_id: first } });
  assert.ifError(collectorDetails.error);
  assert.equal(collectorDetails.data.street, 'Test street 1');
  const requesterDetails = await requester.client.functions.invoke('get-pickup-private-details', { body: { request_id: first } });
  assert.ok(requesterDetails.error, 'requester who is not the assigned collector is denied private details');
  const anonymousDetails = await anonymous.functions.invoke('get-pickup-private-details', { body: { request_id: first } });
  assert.ok(anonymousDetails.error, 'unauthenticated callers are denied private details');
  const collectorOwnList = await collector.client.from('my_claimed_pickups').select('id').eq('id', first);
  const requesterOtherList = await requester.client.from('my_claimed_pickups').select('id').eq('id', first);
  assert.deepEqual(collectorOwnList.data, [{ id: first }]);
  assert.deepEqual(requesterOtherList.data, [], 'claimed activity contains only the signed-in collector jobs');
  const safeRows = await collector.client.from('pending_pickup_marketplace').select('*').eq('id', self);
  assert.ifError(safeRows.error);
  assert.ok(Math.abs(safeRows.data[0].longitude * 100 - Math.round(safeRows.data[0].longitude * 100)) < 1e-7);
  assert.ok(Math.abs(safeRows.data[0].latitude * 100 - Math.round(safeRows.data[0].latitude * 100)) < 1e-7);
  assert.ok(!('requester_id' in safeRows.data[0]) && !('collector_id' in safeRows.data[0]));
  assert.equal((await collector.client.from('pickup_request_private_details').select('*').eq('request_id', first)).data.length, 0);

  const start = await collector.client.rpc('start_pickup', { request_id: first });
  assert.ifError(start.error);
  assert.equal((Array.isArray(start.data) ? start.data[0] : start.data).status, 'in_progress');
  assert.match((await collector.client.rpc('release_pickup_request', { request_id: first })).error.message, /not_releasable/i);

  const capIds = await Promise.all([2, 3, 4, 5].map(create));
  assert.ifError((await claim(collector.client, capIds[0])).error);
  assert.ifError((await claim(collector.client, capIds[1])).error);
  const fourth = await claim(collector.client, capIds[2]);
  assert.match(fourth.error.message, /active_claim_limit_reached/i);
  const released = await collector.client.rpc('release_pickup_request', { request_id: capIds[0] });
  assert.ifError(released.error);
  assert.equal((Array.isArray(released.data) ? released.data[0] : released.data).status, 'pending');
  const lateRelease = await create(8);
  assert.ifError((await claim(collector.client, lateRelease)).error);
  const expiredWindowStart = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const expiredWindow = await admin.from('pickup_requests_public')
    .update({ pickup_window_start: expiredWindowStart.toISOString(), pickup_window_end: new Date(expiredWindowStart.getTime() + 60 * 60 * 1000).toISOString() })
    .eq('id', lateRelease);
  assert.ifError(expiredWindow.error);
  const lateReleaseResult = await collector.client.rpc('release_pickup_request', { request_id: lateRelease });
  assert.ifError(lateReleaseResult.error);
  assert.equal((Array.isArray(lateReleaseResult.data) ? lateReleaseResult.data[0] : lateReleaseResult.data).status, 'pending');
  assert.ifError((await claim(collector.client, capIds[2])).error);
  assert.ifError((await collector.client.rpc('release_pickup_request', { request_id: capIds[1] })).error);
  assert.ifError((await claim(collector.client, capIds[3])).error);

  const cancelled = await create(6);
  assert.ifError((await requester.client.rpc('cancel_pickup_request', { request_id: cancelled })).error);
  assert.match((await claim(collector.client, cancelled)).error.message, /request_cancelled/i);
  const expired = await create(7);
  const expireFixture = await admin.from('pickup_requests_public').update({ status: 'expired' }).eq('id', expired);
  assert.ifError(expireFixture.error);
  assert.match((await claim(collector.client, expired)).error.message, /request_expired/i);
  const unavailable = await claim(collector.client, first);
  assert.match(unavailable.error.message, /request_already_claimed/i);
  console.log('PASS: own/anonymous/duplicate claims, active claim cap, safe approximate marketplace view, release after pickup window, start and in-progress release denial.');
  console.log('PASS: safe Realtime channel subscribed; post-claim/release safe-view fetch hid then restored the request. Local broadcast delivery timing remains a manual/cloud check.');
  const marketplaceSource = await readFile(new URL('../../apps/mobile/src/components/pickup/PickupMarketplace.tsx', import.meta.url), 'utf8');
  assert.ok(!marketplaceSource.includes('pickup_request_private_details'), 'the client never subscribes to or queries private details');
  const migration = await readFile(new URL('../migrations/20261018000100_phase8_collector_marketplace.sql', import.meta.url), 'utf8');
  const broadcastFunction = migration.match(/create or replace function public\.broadcast_pickup_marketplace_refresh\(\)([\s\S]*?)\$\$;/)?.[1] ?? '';
  assert.match(broadcastFunction, /jsonb_build_object\('refresh', true\)/);
  assert.doesNotMatch(broadcastFunction, /requester_id|collector_id|latitude|longitude|address|instructions|note/i);
  console.log('PASS: expired/cancelled/already-claimed requests reject claims; client marketplace source does not reference the private details table.');
} finally {
  if (marketplaceChannel) await collector.client.removeChannel(marketplaceChannel);
  for (const id of requests) {
    await requester.client.rpc('cancel_pickup_request', { request_id: id });
    await collector.client.rpc('release_pickup_request', { request_id: id });
  }
  await Promise.all([requester.client.auth.signOut(), collector.client.auth.signOut()]);
}
