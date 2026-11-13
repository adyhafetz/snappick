import { NextResponse } from 'next/server';
import { fetchRangeStats } from '@/lib/data';
import { parseRange } from '@/lib/snapshot';
import { createLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limited = createLimiter(60, 10 * 60_000);

/** Aggregate figures for a date range (same hiding rule as the rest of the dashboard). */
export async function GET(req: Request) {
  if (limited(req)) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get('from'), url.searchParams.get('to'));
  if (!range) return NextResponse.json({ error: 'Pick a start and an end date at least 7 days apart.' }, { status: 400 });
  try {
    return NextResponse.json(await fetchRangeStats(range));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load that range.' }, { status: 400 });
  }
}
