import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const users = [
  { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD },
  { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD },
];

if (!url || !anonKey || users.some((u) => !u.email || !u.password)) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY, TEST_USER_A_EMAIL, TEST_USER_A_PASSWORD, TEST_USER_B_EMAIL, and TEST_USER_B_PASSWORD.');
}

async function signedIn(user) {
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword(user);
  assert.ifError(error);
  assert.ok(data.user?.id, 'test user must have an id');
  return { client, user: data.user };
}

const a = await signedIn(users[0]);
const b = await signedIn(users[1]);
let scanId;
try {
  const { data: profileA, error: profileError } = await a.client.from('profiles').select('id').eq('id', a.user.id).single();
  assert.ifError(profileError);
  assert.equal(profileA.id, a.user.id, 'a can read own profile');

  const { data: profileB, error: otherProfileError } = await a.client.from('profiles').select('id').eq('id', b.user.id);
  assert.ifError(otherProfileError);
  assert.deepEqual(profileB, [], 'a cannot read b profile');

  const { data: scan, error: scanError } = await a.client.from('scans').insert({
    user_id: a.user.id,
    model_version: 'test',
    retention_date: new Date(Date.now() + 3600000).toISOString(),
    image_width: 640,
    image_height: 640,
  }).select('id').single();
  assert.ifError(scanError);
  scanId = scan.id;

  const { data: otherScans, error: otherScansError } = await b.client.from('scans').select('id').eq('id', scanId);
  assert.ifError(otherScansError);
  assert.deepEqual(otherScans, [], 'b cannot read a scan');

  const anonymous = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: privateRows, error: privateError } = await anonymous.from('pickup_request_private_details').select('request_id');
  assert.ifError(privateError);
  assert.deepEqual(privateRows, [], 'anonymous cannot read private pickup details');

  console.log('RLS isolation passed: own profile/scan readable, cross-user rows and anonymous private details hidden.');
} finally {
  if (scanId) {
    const { error } = await a.client.from('scans').delete().eq('id', scanId);
    assert.ifError(error);
  }
  await Promise.all([a.client.auth.signOut(), b.client.auth.signOut()]);
}
