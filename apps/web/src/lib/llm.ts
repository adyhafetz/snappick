import 'server-only';

export interface LlmRequest {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  json?: boolean;
}

/**
 * Preferred: the `dashboard-ai` Supabase edge function, which holds the project's OPENAI_API_KEY secret
 * (the same one SnapBot in the mobile app uses). It is called with a shared secret, DASHBOARD_AI_SECRET.
 * Fallback for local work: OPENAI_API_KEY in .env.local. Returns null when neither is set or the call fails,
 * so callers use their rule-based text instead.
 */
export function llmConfigured(): boolean {
  return Boolean(process.env.DASHBOARD_AI_SECRET || process.env.OPENAI_API_KEY);
}

export async function askLlm(r: LlmRequest): Promise<string | null> {
  const messages = [
    { role: 'system', content: r.system },
    { role: 'user', content: r.user },
  ];
  try {
    const gateway = process.env.DASHBOARD_AI_SECRET;
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (gateway && base) {
      const res = await fetch(`${base}/functions/v1/dashboard-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dashboard-secret': gateway },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({ messages, maxTokens: r.maxTokens, temperature: r.temperature ?? 0.3, json: r.json === true }),
      });
      if (!res.ok) return null;
      const b = (await res.json()) as { content?: string };
      return b.content?.trim() || null;
    }
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        messages,
        temperature: r.temperature ?? 0.3,
        max_tokens: r.maxTokens,
        ...(r.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
