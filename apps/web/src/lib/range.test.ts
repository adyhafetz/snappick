import { describe, expect, it } from 'vitest';
import { monthlySeries } from './selectors';
import { parseRange, periodText, type Snapshot } from './snapshot';

describe('date range', () => {
  it('accepts a week or longer and rejects bad input', () => {
    expect(parseRange('2026-10-01', '2026-10-07')).toEqual({ from: '2026-10-01', to: '2026-10-07' });
    expect(parseRange('2026-10-01', '2026-10-06')).toBeNull(); // only 6 days
    expect(parseRange('2026-10-10', '2026-10-01')).toBeNull();
    expect(parseRange('10/01/2026', '2026-10-30')).toBeNull();
    expect(parseRange(undefined, '2026-10-30')).toBeNull();
    expect(parseRange('2026-13-45', '2026-14-45')).toBeNull();
  });
  it('words the period', () => {
    expect(periodText('all')).toBe('All time');
    expect(periodText('custom', { from: '2026-10-01', to: '2026-10-31' })).toBe('1 Oct to 31 Oct 2026');
    expect(periodText('custom', { from: '2025-12-20', to: '2026-01-10' })).toBe('20 Dec 2025 to 10 Jan 2026');
  });
  it('limits the monthly series to the chosen months', () => {
    const m = (month: string) => ({ district_key: 'state', month, requested: 5, completed: 4, unclaimed: 1, households: 5, suppressed: false });
    const s: Snapshot = { range: { from: '2026-09-15', to: '2026-10-20' }, meta: null, period: [], monthly: [m('2026-08-01'), m('2026-09-01'), m('2026-10-01'), m('2026-11-01')], materials: [], hotspots: [], districts: [] };
    expect(monthlySeries(s, 'custom', 'state').map((x) => x.month)).toEqual(['2026-09-01', '2026-10-01']);
  });
});
