import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const bearer = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');
  if (!bearer || !url || !anonKey || !serviceKey) return json({ error: 'Sign in to view this pickup.' }, 401);

  try {
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await auth.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: 'Sign in to view this pickup.' }, 401);
    const input: unknown = await request.json().catch(() => null);
    if (!isRecord(input) || typeof input.request_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.request_id)) {
      return json({ error: 'The pickup identifier is invalid.' }, 400);
    }
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc('get_pickup_private_details_for_collector', {
      p_request_id: input.request_id,
      p_collector_user_id: authData.user.id,
    });
    if (error || !data) return json({ error: 'Pickup details are unavailable to this account.' }, 403);
    return json(data);
  } catch {
    return json({ error: 'Pickup details are temporarily unavailable.' }, 503);
  }
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
