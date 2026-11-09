import { NextResponse } from 'next/server';
import { polishInsights } from '@/lib/ai';
import { fetchSnapshot } from '@/lib/data';
import { buildInsights, type Insight } from '@/lib/insights';
import type { Period } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

// One model call per snapshot, period and district, however many visitors ask.
const cache = new Map<string, Insight[] | null>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get('period');
  const period: Period = p === '30d' || p === '90d' ? p : 'all';
  const d = url.searchParams.get('district') ?? 'state';
  const district = /^[a-z0-9-]{1,40}$/.test(d) ? d : 'state';
  try {
    const snapshot = await fetchSnapshot();
    const base = buildInsights(snapshot, period, district);
    const id = `${snapshot.meta?.snapshot_hash ?? 'none'}|${period}|${district}`;
    if (!cache.has(id)) {
      if (cache.size > 200) cache.clear();
      cache.set(id, await polishInsights(snapshot, period, district, base));
    }
    const ai = cache.get(id) ?? null;
    return NextResponse.json({ insights: ai ?? base, ai: ai !== null });
  } catch {
    return NextResponse.json({ error: 'Could not load suggestions.' }, { status: 503 });
  }
}
