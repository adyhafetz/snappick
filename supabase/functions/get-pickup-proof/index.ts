import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!bearer || !url || !anon || !service) return json({ error: 'Sign in to view proof.' }, 401);
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await auth.auth.getUser(bearer);
  const input = await request.json().catch(() => null) as { request_id?: unknown } | null;
  if (!userData.user || typeof input?.request_id !== 'string') return json({ error: 'Proof is unavailable.' }, 403);
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row } = await admin.from('pickup_proofs').select('storage_path,request_id').eq('request_id', input.request_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!row) return json({ error: 'Proof is unavailable.' }, 404);
  const { data: participant } = await admin.from('pickup_requests_public').select('requester_id,collector_id').eq('id', row.request_id).maybeSingle();
  if (!participant || ![participant.requester_id, participant.collector_id].includes(userData.user.id)) return json({ error: 'Proof is unavailable.' }, 403);
  const { data: signed, error } = await admin.storage.from('proofs').createSignedUrl(row.storage_path, 300);
  if (error || !signed?.signedUrl) return json({ error: 'Proof is unavailable.' }, 503);
  return json({ signed_url: signed.signedUrl, expires_in: 300 });
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }
