import { type Period, type Snapshot, STATE } from './snapshot';

export interface KeyNumbers {
  suppressed: boolean;
  requested: number;
  completed: number;
  unclaimed: number;
  households: number;
  items: number;
  rate: number | null;
  medianHours: number | null;
}

const EMPTY: KeyNumbers = { suppressed: true, requested: 0, completed: 0, unclaimed: 0, households: 0, items: 0, rate: null, medianHours: null };

export function keyNumbers(s: Snapshot, period: Period, key: string): KeyNumbers {
  const row = s.period.find((r) => r.period === period && r.district_key === key);
  if (!row || row.suppressed) return { ...EMPTY };
  const requested = row.requested ?? 0;
  const completed = row.completed ?? 0;
  return {
    suppressed: false,
    requested,
    completed,
    unclaimed: row.unclaimed ?? 0,
    households: row.households,
    items: row.items_recycled ?? 0,
    rate: requested > 0 ? completed / requested : null,
    medianHours: row.median_claim_hours,
  };
}

export function districtName(s: Snapshot, key: string): string {
  if (key === STATE) return 'Perak';
  return s.districts.find((d) => d.district_key === key)?.name ?? key;
}

export interface DistrictSummary extends KeyNumbers {
  key: string;
  name: string;
  unclaimedShare: number | null;
}

export function districtSummaries(s: Snapshot, period: Period): DistrictSummary[] {
  return s.districts
    .map((d) => {
      const k = keyNumbers(s, period, d.district_key);
      return {
        ...k,
        key: d.district_key,
        name: d.name,
        unclaimedShare: !k.suppressed && k.requested > 0 ? k.unclaimed / k.requested : null,
      };
    })
    .sort((a, b) => Number(a.suppressed) - Number(b.suppressed) || b.completed - a.completed || a.name.localeCompare(b.name));
}

export function materialsFor(s: Snapshot, period: Period, key: string) {
  const rows = s.materials.filter((m) => m.period === period && m.district_key === key);
  const total = rows.reduce((n, r) => n + r.items, 0);
  return rows
    .map((r) => ({ name: r.app_class, items: r.items, share: total > 0 ? r.items / total : 0 }))
    .sort((a, b) => b.items - a.items);
}

function periodStart(period: Period, now: Date): string | null {
  if (period === 'all' || period === 'custom') return null;
  const d = new Date(now.getTime() - (period === '30d' ? 30 : 90) * 86400000);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

export function monthLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function monthlySeries(s: Snapshot, period: Period, key: string, now = new Date()) {
  const start = period === 'custom' ? (s.range ? `${s.range.from.slice(0, 7)}-01` : null) : periodStart(period, now);
  const end = period === 'custom' ? (s.range?.to ?? null) : null;
  return s.monthly
    .filter((m) => m.district_key === key && (start === null || m.month >= start) && (end === null || m.month <= end))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      month: m.month,
      // The current month is still in progress, so say so instead of letting it read as a drop.
      label: m.month === now.toISOString().slice(0, 7) + '-01' ? `${monthLabel(m.month)} (so far)` : monthLabel(m.month),
      completed: m.suppressed ? null : m.completed,
      suppressed: m.suppressed,
    }));
}

export function formatPct(v: number | null): string {
  return v === null ? 'n/a' : `${Math.round(v * 100)}%`;
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { STATE };
