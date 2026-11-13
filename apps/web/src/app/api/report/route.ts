import { NextResponse } from 'next/server';
import { fetchSnapshot } from '@/lib/data';
import { polishInsights } from '@/lib/ai';
import { buildInsights } from '@/lib/insights';
import { buildReport } from '@/lib/report';
import { type Period, parseRange } from '@/lib/snapshot';
import { createLimiter } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Each report can call the language model and builds a PDF.
const limited = createLimiter(10, 10 * 60_000);

export async function GET(req: Request) {
  if (limited(req)) {
    return NextResponse.json({ error: 'Too many reports. Please wait a few minutes.' }, { status: 429 });
  }
  const url = new URL(req.url);
  const p = url.searchParams.get('period');
  const range = p === 'custom' ? parseRange(url.searchParams.get('from'), url.searchParams.get('to')) : null;
  const period: Period = p === '30d' || p === '90d' ? p : range ? 'custom' : 'all';
  const d = url.searchParams.get('district') ?? 'state';
  const district = /^[a-z0-9-]{1,40}$/.test(d) ? d : 'state';
  try {
    const snapshot = await fetchSnapshot(range);
    const ai = await polishInsights(snapshot, period, district, buildInsights(snapshot, period, district));
    const pdf = await buildReport(snapshot, period, district, ai);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${url.searchParams.get('inline') === '1' ? 'inline' : 'attachment'}; filename="snappick-report-${district}-${range ? `${range.from}_${range.to}` : period}.pdf"`,
        'Cache-Control': 'no-store',
        'X-Report-AI': ai ? '1' : '0',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not build the report.' }, { status: 503 });
  }
}
