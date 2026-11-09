import { describe, expect, it } from 'vitest';
import { buildInsights } from './insights';
import { districtSummaries, keyNumbers, materialsFor, monthlySeries } from './selectors';
import type { PeriodRow, Snapshot } from './snapshot';

const row = (district_key: string, o: Partial<PeriodRow> = {}): PeriodRow => ({
  period: 'all', district_key, requested: 20, completed: 15, unclaimed: 5, households: 8, items_recycled: 100, median_claim_hours: 10, suppressed: false, ...o,
});

const snap: Snapshot = {
  meta: { refreshed_at: '2026-11-06T00:00:00Z', has_pilot_data: true, snapshot_hash: 'x' },
  period: [
    row('state', { requested: 40, completed: 30, unclaimed: 10, households: 20, items_recycled: 200 }),
    row('kinta'),
    row('selama', { requested: null, completed: null, unclaimed: null, items_recycled: null, median_claim_hours: null, households: 0, suppressed: true }),
  ],
  monthly: [
    { district_key: 'state', month: '2026-09-01', requested: 10, completed: 8, unclaimed: 2, households: 6, suppressed: false },
    { district_key: 'state', month: '2026-10-01', requested: null, completed: null, unclaimed: null, households: 0, suppressed: true },
  ],
  materials: [
    { period: 'all', district_key: 'state', app_class: 'paper', items: 50 },
    { period: 'all', district_key: 'state', app_class: 'plastic', items: 150 },
  ],
  hotspots: [],
  districts: [
    { district_key: 'kinta', name: 'Kinta', geojson: { type: 'Point', coordinates: [0, 0] } },
    { district_key: 'selama', name: 'Selama', geojson: { type: 'Point', coordinates: [0, 0] } },
  ],
};

describe('selectors', () => {
  it('computes key numbers and hides suppressed districts', () => {
    expect(keyNumbers(snap, 'all', 'state').rate).toBeCloseTo(0.75);
    const hidden = keyNumbers(snap, 'all', 'selama');
    expect(hidden.suppressed).toBe(true);
    expect(hidden.completed).toBe(0);
  });
  it('sorts materials by items with shares', () => {
    const m = materialsFor(snap, 'all', 'state');
    expect(m[0]).toMatchObject({ name: 'plastic', items: 150 });
    expect(m[0].share).toBeCloseTo(0.75);
  });
  it('puts suppressed districts last', () => {
    expect(districtSummaries(snap, 'all').map((d) => d.key)).toEqual(['kinta', 'selama']);
  });
  it('keeps suppressed months as gaps', () => {
    const s = monthlySeries(snap, 'all', 'state');
    expect(s.map((x) => x.completed)).toEqual([8, null]);
  });
  it('limits the monthly series to the period', () => {
    expect(monthlySeries(snap, '30d', 'state', new Date('2026-10-15T00:00:00Z')).map((x) => x.month)).toEqual(['2026-09-01', '2026-10-01']);
    // The window starts at the first of the month that contains the cut-off date.
    expect(monthlySeries(snap, '30d', 'state', new Date('2026-11-20T00:00:00Z')).map((x) => x.month)).toEqual(['2026-10-01']);
  });
});

describe('insights', () => {
  it('cites figures and flags hidden districts', () => {
    const text = buildInsights(snap, 'all', 'state').map((i) => i.text).join(' ');
    expect(text).toContain('20 households');
    expect(text).toContain('Plastic');
    expect(text).toContain('Selama');
  });
  it('says so when a district is hidden', () => {
    expect(buildInsights(snap, 'all', 'selama')[0].text).toContain('fewer than 5');
  });
});
