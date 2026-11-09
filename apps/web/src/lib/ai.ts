import 'server-only';
import { buildFacts } from './facts';
import type { Insight, InsightGroup } from './insights';
import { askLlm, llmConfigured } from './llm';
import type { Period, Snapshot } from './snapshot';

const GROUPS: InsightGroup[] = ['Quick wins', 'Service coverage', 'Policy and enforcement context'];

const SYSTEM = `You write short, formal recommendations for Perak state decision makers about household recycling.
Use ONLY the facts given. Every recommendation must cite at least one number from the facts, exactly as written. Never invent numbers, causes or legal claims. 4 to 6 items.
Reply as JSON: {"items":[{"group":"Quick wins"|"Service coverage"|"Policy and enforcement context","text":"..."}]}. Each text is one or two sentences.`;

// One model call per snapshot, period and district, however many reports are previewed.
const cache = new Map<string, Insight[] | null>();

/**
 * Optional: asks a language model to rewrite the rule-based suggestions for decision makers.
 * It only receives the published aggregates (see buildFacts). Returns null when AI is not configured
 * or anything looks wrong, in which case the rule-based text is used and labelled as such.
 */
export async function polishInsights(s: Snapshot, period: Period, key: string, base: Insight[]): Promise<Insight[] | null> {
  if (!llmConfigured() || base.length === 0) return null;
  const id = `${s.meta?.snapshot_hash ?? 'none'}|${period}|${s.range ? `${s.range.from}:${s.range.to}` : ''}|${key}`;
  if (cache.has(id)) return cache.get(id) ?? null;
  const text = await askLlm({
    system: SYSTEM,
    user: `Facts:\n${JSON.stringify(buildFacts(s, period, key))}\n\nDraft suggestions to improve:\n${base.map((b) => `- ${b.text}`).join('\n')}`,
    maxTokens: 700,
    json: true,
  });
  let result: Insight[] | null = null;
  try {
    const parsed = JSON.parse(text ?? '') as { items?: { group?: string; text?: string }[] };
    const items = (parsed.items ?? []).filter(
      (i): i is Insight => typeof i.text === 'string' && i.text.length > 10 && i.text.length < 500 && GROUPS.includes(i.group as InsightGroup),
    );
    result = items.length >= 3 ? items.slice(0, 6) : null;
  } catch {
    result = null;
  }
  if (result) {
    // Only successful answers are kept, so a temporary failure is retried next time.
    if (cache.size > 200) cache.clear();
    cache.set(id, result);
  }
  return result;
}
