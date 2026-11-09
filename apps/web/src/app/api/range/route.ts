import { NextResponse } from 'next/server';
import { fetchRangeStats } from '@/lib/data';
import { parseRange } from '@/lib/snapshot';

export const dynamic = 'force-dynamic';

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 60;
}

/** Aggregate figures for a date range (same hiding rule as the rest of the dashboard). */
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'));
  if (!range) return NextResponse.json({ error: 'Pick a start and an end date at least 7 days apart.' }, { status: 400 });
  try {
    return NextResponse.json(await fetchRangeStats(range));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load that range.' }, { status: 400 });
  }
}
