import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
    const projectId = Deno.env.get('FCM_PROJECT_ID');
    const clientEmail = Deno.env.get('FCM_CLIENT_EMAIL');
    const privateKey = Deno.env.get('FCM_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    const notifySecret = Deno.env.get('NOTIFY_SECRET');
    if (!url || !serviceKey || !notifySecret || request.headers.get('x-notify-secret') !== notifySecret) {
      return json({ error: 'Notification service is unavailable.' }, 503);
    }
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.request_id !== 'string' || typeof body.status !== 'string') return json({ error: 'Invalid notification event.' }, 400);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: requestRow } = await admin.from('pickup_requests_public').select('requester_id,collector_id').eq('id', body.request_id).maybeSingle();
    if (!requestRow) return json({ sent: 0 });
    const users = [...new Set([requestRow.requester_id, requestRow.collector_id].filter((value): value is string => typeof value === 'string'))];
    const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', users);
    if (!projectId || !clientEmail || !privateKey || !tokens?.length) return json({ sent: 0, simulated: true });
    const accessToken = await mintAccessToken(clientEmail, privateKey);
    let sent = 0;
    for (const row of tokens) {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: row.token,
            notification: { title: 'Pickup update', body: `Your pickup is ${String(body.status).replaceAll('_', ' ')}.` },
            data: { request_id: body.request_id, status: body.status }
          }
        })
      });
      if (response.ok) sent += 1;
    }
    return json({ sent });
  } catch (_err) {
    return json({ error: 'Failed to process notification.' }, 500);
  }
});

async function mintAccessToken(email: string, key: string) {
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claim = encodeBase64Url(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const pem = key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binary, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(`${header}.${claim}`));
  const jwt = `${header}.${claim}.${encodeBase64UrlBytes(new Uint8Array(signature))}`;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}` });
  if (!response.ok) throw new Error('FCM authorization failed.');
  const data = await response.json() as { access_token?: string };
  if (!data.access_token) throw new Error('FCM authorization returned no token.');
  return data.access_token;
}
function encodeBase64Url(value: string) { return encodeBase64UrlBytes(new TextEncoder().encode(value)); }
function encodeBase64UrlBytes(value: Uint8Array) { let binary = ''; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } }); }
