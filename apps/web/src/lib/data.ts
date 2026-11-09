import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { DateRange, DistrictShape, HotspotRow, MaterialRow, Meta, MonthlyRow, PeriodRow, Snapshot } from './snapshot';

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example).');
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Figures for a chosen date range, computed in the database with the same hiding rule (fewer than 5 households). */
export async function fetchRangeStats(range: DateRange): Promise<{ period: PeriodRow[]; materials: MaterialRow[] }> {
  const { data, error } = await client().rpc('get_public_range_stats', { p_from: range.from, p_to: range.to });
  if (error) throw new Error(error.message);
  const d = data as { period?: PeriodRow[]; materials?: MaterialRow[] } | null;
  return { period: d?.period ?? [], materials: d?.materials ?? [] };
}

/** Reads the published snapshot tables with the public (anon) key. No other table is ever read. With a range, the custom figures are added. */
export async function fetchSnapshot(range?: DateRange | null): Promise<Snapshot> {
  const db = client();
  const [meta, period, monthly, materials, hotspots, districts] = await Promise.all([
    db.from('public_meta').select('refreshed_at, snapshot_hash').maybeSingle(),
    db.from('public_stats_period').select('*'),
    db.from('public_stats_monthly').select('*'),
    db.from('public_stats_materials').select('*'),
    db.from('public_stats_hotspots').select('*'),
    db.rpc('get_public_districts'),
  ]);
  for (const r of [meta, period, monthly, materials, hotspots, districts]) {
    if (r.error) throw new Error(`Could not load the public statistics: ${r.error.message}`);
  }
  const extra = range ? await fetchRangeStats(range) : null;
  return {
    ...(range ? { range } : {}),
    meta: (meta.data as Meta | null) ?? null,
    period: [...((period.data ?? []) as PeriodRow[]), ...(extra?.period ?? [])],
    monthly: (monthly.data ?? []) as MonthlyRow[],
    materials: [...((materials.data ?? []) as MaterialRow[]), ...(extra?.materials ?? [])],
    hotspots: (hotspots.data ?? []) as HotspotRow[],
    districts: (districts.data ?? []) as DistrictShape[],
  };
}
