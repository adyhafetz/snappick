import { describe, expect, it } from 'vitest';
import { buildPickupWindow, dayLabel, windowStillAhead } from './window';

describe('pickup window', () => {
  const now = new Date(2026, 10, 12, 22, 30);

  it('builds tomorrow morning and afternoon in local time', () => {
    const morning = buildPickupWindow(1, 'morning', now);
    expect(new Date(morning.start).getDate()).toBe(13);
    expect(new Date(morning.start).getHours()).toBe(9);
    expect(new Date(morning.end).getHours()).toBe(12);
    const afternoon = buildPickupWindow(3, 'afternoon', now);
    expect(new Date(afternoon.start).getDate()).toBe(15);
    expect(new Date(afternoon.start).getHours()).toBe(13);
    expect(new Date(afternoon.end).getHours()).toBe(16);
  });

  it('labels days plainly', () => {
    expect(dayLabel(1)).toBe('Tomorrow');
    expect(dayLabel(2)).toBe('In 2 days');
  });

  it('knows whether an old window can be reused', () => {
    expect(windowStillAhead(new Date(2026, 10, 13, 9).toISOString(), now)).toBe(true);
    expect(windowStillAhead(new Date(2026, 10, 12, 9).toISOString(), now)).toBe(false);
    expect(windowStillAhead(null, now)).toBe(false);
  });
});
