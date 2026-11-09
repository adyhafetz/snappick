// @ts-nocheck
// Language-model gateway for the public website dashboard (apps/web). It uses the same OPENAI_API_KEY secret as
// snapbot-chat, so the key never leaves Supabase. Only the dashboard's server may call it: requests must carry the
// shared secret in `x-dashboard-secret`. The caller sends published aggregate statistics only (no personal data).

const MAX_CHARS = 12000;

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const expected = Deno.env.get('DASHBOARD_AI_SECRET');
  const given = request.headers.get('x-dashboard-secret') ?? '';
  if (!expected || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return json({ error: 'Not allowed.' }, 401);
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return json({ error: 'AI is not configured.' }, 503);

  const body = await request.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const clean = messages
    .filter((m) => m && (m.role === 'system' || m.role === 'user') && typeof m.content === 'string')
    .slice(0, 4)
    .map((m) => ({ role: m.role, content: m.content }));
  if (clean.length === 0 || clean.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS) {
    return json({ error: 'Invalid request.' }, 400);
  }
  const maxTokens = Math.min(Math.max(Number(body?.maxTokens) || 300, 50), 800);
  const temperature = Math.min(Math.max(Number(body?.temperature ?? 0.3), 0), 1);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini',
        messages: clean,
        temperature,
        max_tokens: maxTokens,
        ...(body?.json === true ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) return json({ error: 'The AI service did not answer.' }, 502);
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ? json({ content }) : json({ error: 'Empty answer.' }, 502);
  } catch {
    return json({ error: 'The AI service did not answer.' }, 502);
  }
});

function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
