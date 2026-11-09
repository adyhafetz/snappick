export type Period = '30d' | '90d' | 'all' | 'custom';
export const PERIODS: { id: Exclude<Period, 'custom'>; label: string }[] = [
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'all', label: 'All time' },
];

export interface PeriodRow {
  period: Period;
  district_key: string;
  requested: number | null;
  completed: number | null;
  unclaimed: number | null;
  households: number;
  items_recycled: number | null;
  median_claim_hours: number | null;
  suppressed: boolean;
}
export interface MonthlyRow {
  district_key: string;
  month: string;
  requested: number | null;
  completed: number | null;
  unclaimed: number | null;
  households: number;
  suppressed: boolean;
}
export interface MaterialRow { period: Period; district_key: string; app_class: string; items: number }
export interface HotspotRow {
  period: Period;
  cell_id: string;
  district_key: string;
  lon: number;
  lat: number;
  requests: number;
  completed: number;
  unclaimed: number;
}
export interface DistrictShape { district_key: string; name: string; geojson: GeoJSON.Geometry }
export interface Meta { refreshed_at: string; has_pilot_data: boolean; snapshot_hash: string }

/** A chosen date range, as YYYY-MM-DD (Malaysia time). */
export interface DateRange { from: string; to: string }

export const MIN_RANGE_DAYS = 7;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a clean range, or null when it is missing, malformed or shorter than a week. The database checks it again. */
export function parseRange(from: unknown, to: unknown): DateRange | null {
  if (typeof from !== 'string' || typeof to !== 'string' || !ISO.test(from) || !ISO.test(to)) return null;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || (b - a) / 86400000 < MIN_RANGE_DAYS - 1) return null;
  return { from, to };
}

function shortDate(iso: string, withYear: boolean): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
}

/** Human text for the chosen period, e.g. "All time" or "1 Oct to 31 Oct 2026". */
export function periodText(period: Period, range?: DateRange | null): string {
  if (period === 'custom' && range) {
    const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
    return `${shortDate(range.from, !sameYear)} to ${shortDate(range.to, true)}`;
  }
  return PERIODS.find((p) => p.id === period)?.label ?? 'All time';
}

export interface Snapshot {
  /** Set when the figures for the 'custom' period were loaded for this range. */
  range?: DateRange;
  meta: Meta | null;
  period: PeriodRow[];
  monthly: MonthlyRow[];
  materials: MaterialRow[];
  hotspots: HotspotRow[];
  districts: DistrictShape[];
}

export const STATE = 'state';
