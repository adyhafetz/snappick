// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface RequestPayload {
  messages: ChatMessage[];
  itemContext?: string;
}

const SNAPBOT_STRICT_SYSTEM_PROMPT = `You are SnapBot, the official intelligent AI recycling assistant for the SnapPick app.
Your role is to answer user questions about household recycling activities, waste sorting, material preparation, composting, and community waste reduction.

Strict Operating Rules:
1. Strict Safety & Hazardous Materials:
   - Batteries, electronics (e-waste), chemicals, paint, motor oil, fluorescent lightbulbs, and medical sharps are strictly hazardous waste.
   - NEVER instruct users to place hazardous waste into standard recycling bags, bins, or community pickup. Always advise taking them to certified e-waste or municipal drop-off centers.
2. Clean, Dry & Emptied:
   - Always emphasize emptying residual food/liquids, rinsing, and drying containers. Clean materials avoid mold, pests, and contamination of dry recyclables.
3. Volume Reduction:
   - Recommend flattening cardboard boxes and compressing cans/plastic bottles where practical to optimize collection space.
4. Response Length & Tone:
   - Be direct, friendly, and practical. Keep responses concise (2 to 4 sentences maximum). Use clear bullet points if listing steps.
5. Multilingual Support:
   - Seamlessly reply in the language of the user's query (English or Bahasa Melayu).
6. Privacy & Safety:
   - Never request, collect, or store personal coordinates, addresses, phone numbers, or real identities.
   - If an item's safety or composition is uncertain, advise checking with local municipal councils.`;

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  const bearer = authorization?.match(/^Bearer (.+)$/i)?.[1];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY');

  if (!bearer || !supabaseUrl || !anonKey) {
    return json({ error: 'Please sign in to chat with SnapBot.' }, 401);
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(bearer);
    if (authError || !authData.user) {
      return json({ error: 'Please sign in to chat with SnapBot.' }, 401);
    }

    const payload = (await request.json().catch(() => null)) as RequestPayload | null;
    if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
      return json({ error: 'Invalid message payload.' }, 400);
    }

    const rawMessages = payload.messages.slice(-6); // Last 6 turns for conversation flow
    const userMessages: ChatMessage[] = [];

    for (const msg of rawMessages) {
      if (typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'assistant')) {
        const trimmed = msg.content.trim().slice(0, 1000);
        if (trimmed.length > 0) {
          userMessages.push({ role: msg.role, content: trimmed });
        }
      }
    }

    if (userMessages.length === 0 || userMessages[userMessages.length - 1].role !== 'user') {
      return json({ error: 'The last message must be from the user.' }, 400);
    }

    const lastUserQuery = userMessages[userMessages.length - 1].content;
    const itemContext = typeof payload.itemContext === 'string' ? payload.itemContext.trim() : '';

    // Step 1: Compute deterministic cache key to save tokens
    const normalized = normalizeQuery(lastUserQuery);
    const cacheKey = await computeCacheKey(normalized, itemContext);

    // Step 2: Check instruction_cache for an existing response
    let adminClient: ReturnType<typeof createClient> | null = null;
    if (serviceKey) {
      adminClient = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const now = new Date().toISOString();
      const { data: cached } = await adminClient
        .from('instruction_cache')
        .select('advice')
        .eq('cache_key', cacheKey)
        .gt('expires_at', now)
        .maybeSingle();

      if (cached && cached.advice && typeof (cached.advice as { reply?: string }).reply === 'string') {
        return json({ reply: (cached.advice as { reply: string }).reply, source: 'cache' });
      }
    }

    // Step 3: Call OpenAI with strict system prompt
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

    if (!apiKey) {
      const fallbackReply = generateSafeRecyclingFallback(lastUserQuery, itemContext);
      return json({ reply: fallbackReply, source: 'fallback' });
    }

    const contextAddition = itemContext
      ? `\nItem Context: The user is specifically asking about: "${itemContext}".`
      : '';

    const apiMessages = [
      { role: 'system', content: `${SNAPBOT_STRICT_SYSTEM_PROMPT}${contextAddition}` },
      ...userMessages,
    ];

    const startTime = Date.now();
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(7500),
      body: JSON.stringify({
        model,
        messages: apiMessages,
        temperature: 0.2, // Low temperature for high consistency and cache hits
        max_tokens: 250, // Token saving constraint
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!openAiResponse.ok) {
      const fallbackReply = generateSafeRecyclingFallback(lastUserQuery, itemContext);
      return json({ reply: fallbackReply, source: 'fallback' });
    }

    const result = await openAiResponse.json();
    const assistantReply = result.choices?.[0]?.message?.content?.trim();

    if (!assistantReply) {
      const fallbackReply = generateSafeRecyclingFallback(lastUserQuery, itemContext);
      return json({ reply: fallbackReply, source: 'fallback' });
    }

    // Step 4: Write to cache with 14-day expiry to save future tokens
    if (adminClient) {
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      await adminClient.from('instruction_cache').upsert({
        cache_key: cacheKey,
        advice: { reply: assistantReply },
        source: 'llm',
        expires_at: expiresAt,
      });

      // Record token usage for auditing
      const usage = result.usage;
      if (usage) {
        await adminClient.from('llm_usage').insert({
          user_id: authData.user.id,
          cache_key: cacheKey,
          model,
          prompt_tokens: usage.prompt_tokens ?? null,
          completion_tokens: usage.completion_tokens ?? null,
          latency_ms: latencyMs,
        });
      }
    }

    return json({ reply: assistantReply, source: 'openai' });
  } catch (_err) {
    return json({
      reply: 'SnapBot is temporarily unavailable. Quick reminder: always rinse, dry, and flatten recyclables, and keep hazardous waste separate!',
      source: 'error_fallback',
    });
  }
});

function normalizeQuery(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

async function computeCacheKey(normalized: string, context: string): Promise<string> {
  const combined = `snapbot:${context ? context + ':' : ''}${normalized}`;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combined));
  const hex = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `snapbot:${hex.slice(0, 32)}`;
}

function generateSafeRecyclingFallback(query: string, itemContext: string): string {
  const lower = query.toLowerCase();

  if (lower.includes('pizza') || lower.includes('oil') || lower.includes('greas') || lower.includes('minyak')) {
    return 'Boxes soaked in cooking oil or grease cannot be recycled because grease damages paper mill fibers. Tear off clean lid portions for recycling, and dispose of greasy bottoms in regular trash.';
  }

  if (lower.includes('battery') || lower.includes('e-waste') || lower.includes('bateri') || lower.includes('bulb') || lower.includes('lampu')) {
    return '⚠️ Batteries, bulbs, and electronics are hazardous materials! They must NEVER be placed in curbside recycling or community pickup. Please drop them off at dedicated e-waste collection points.';
  }

  if (lower.includes('cap') || lower.includes('lid') || lower.includes('tutup')) {
    return 'For plastic bottles: unscrew the cap, rinse out residual liquid, squash the bottle flat, and place both in the recycling bag. Compressing saves crucial bin space!';
  }

  if (lower.includes('rinse') || lower.includes('clean') || lower.includes('basuh') || lower.includes('cuci')) {
    return 'Yes, a quick rinse is essential! Emptying and rinsing containers stops foul odors, prevents pests, and avoids contaminating clean paper batches.';
  }

  if (itemContext) {
    return `For ${itemContext}: ensure the item is emptied, rinsed clean, dried, and flattened/compacted to save collection space!`;
  }

  return 'Always ensure your recyclables are clean, dry, and flattened to save space. Keep hazardous waste like batteries and e-waste separate. What specific item can I help you sort?';
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
