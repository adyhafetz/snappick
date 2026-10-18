import { describe, expect, it } from 'vitest';
import { formatPickupSummary, formatPickupWindow, groupMarketplaceRequests } from './marketplace';
import { getNavigationLinks, openPickupNavigation } from './navigation';
import { BUNDLED_RULE_SET } from '../detector/rules';
import { canSubmitPickup, eligibilityChanges, evaluatePickupItems, isValidCoordinate, summarizeEligibleItems, validatePickupForm } from './pickup';

const items = [
  { id: 'box-1', className: 'paper', source: 'detector' as const, condition: 'clean_dry' as const, quantity: 1 },
  { id: 'box-2', className: 'glass', source: 'user_added' as const, condition: 'broken_unsafe' as const, quantity: 2 },
];

describe('pickup request rules', () => {
  it('rejects non-finite and out-of-range coordinates', () => {
    expect(isValidCoordinate(4.6, 101.1)).toBe(true);
    expect(isValidCoordinate(Number.NaN, 101.1)).toBe(false);
    expect(isValidCoordinate(91, 101.1)).toBe(false);
    expect(isValidCoordinate(4.6, 181)).toBe(false);
  });

  it('re-evaluates eligibility and reports only changed rows', () => {
    const before = evaluatePickupItems(items, BUNDLED_RULE_SET);
    const nextRuleSet = {
      ...BUNDLED_RULE_SET,
      id: 'ipoh_local',
      version: 3,
      classes: {
        ...BUNDLED_RULE_SET.classes,
        glass: {
          ...BUNDLED_RULE_SET.classes.glass,
          conditionRules: {
            ...BUNDLED_RULE_SET.classes.glass.conditionRules,
            broken_unsafe: { eligibility: 'not_eligible' as const, reason: 'Broken glass is not accepted.' },
          },
        },
      },
    };
    const after = evaluatePickupItems(items, nextRuleSet);
    expect(before[0]?.eligibility).toBe('eligible');
    expect(after[1]?.eligibility).toBe('not_eligible');
    expect(eligibilityChanges(before, after).map((item) => item.id)).toEqual(['box-2']);
  });

  it('summarizes eligible items only and keeps repeated rows separate during evaluation', () => {
    const evaluated = evaluatePickupItems(items, BUNDLED_RULE_SET);
    expect(evaluated.map((item) => item.id)).toEqual(['box-1', 'box-2']);
    expect(summarizeEligibleItems(evaluated)).toEqual([{ className: 'paper', quantity: 1 }]);
  });

  it('validates required private address fields without exposing their values', () => {
    expect(validatePickupForm({ unitNumber: '  ', street: '', landmark: '', accessInstructions: '', pickupNote: '' }))
      .toBe('Enter your house or unit number.');
    expect(validatePickupForm({ unitNumber: '12A', street: 'Jalan Example', landmark: '', accessInstructions: '', pickupNote: '' }))
      .toBeNull();
  });

  it('disables submission while offline and until every required gate is satisfied', () => {
    const valid = { online: true, submitting: false, addressValid: true, restrictedConfirmed: true, eligibleCount: 1, areaResolved: true };
    expect(canSubmitPickup(valid)).toBe(true);
    expect(canSubmitPickup({ ...valid, online: false })).toBe(false);
    expect(canSubmitPickup({ ...valid, eligibleCount: 0 })).toBe(false);
    expect(canSubmitPickup({ ...valid, restrictedConfirmed: false })).toBe(false);
  });
});

describe('safe pickup marketplace data', () => {
  const row = (id: string, longitude = 101.09) => ({
    id, district_name: 'Kinta', material_summary: [{ class: 'paper', quantity: 2 }],
    pickup_window_start: '2026-10-19T09:00:00.000Z', pickup_window_end: '2026-10-19T12:00:00.000Z',
    longitude, latitude: 4.59, cell_count: 2,
  });

  it('groups each server-counted grid cell into one marker', () => {
    const cells = groupMarketplaceRequests([row('one'), row('two'), row('three', 101.1)]);
    expect(cells).toHaveLength(2);
    expect(cells[0]?.coordinate).toEqual([101.09, 4.59]);
    expect(cells[0]?.count).toBe(2);
    expect(cells[0]?.requests.map((request) => request.id)).toEqual(['one', 'two']);
  });

  it('shows safe material and pickup-window summaries', () => {
    expect(formatPickupSummary(row('one').material_summary)).toBe('2 x paper');
    expect(formatPickupWindow(row('one').pickup_window_start, row('one').pickup_window_end)).not.toBe('Pickup window unavailable');
    expect(formatPickupWindow(null, null)).toBe('Pickup window unavailable');
  });
});

describe('authorized pickup navigation', () => {
  it('builds exact destinations only from the authorized details and falls back to a generic map URL', async () => {
    expect(getNavigationLinks(4.5, 101.2).android).toBe('google.navigation:q=4.5,101.2');
    const opened: string[] = [];
    const result = await openPickupNavigation(4.5, 101.2, {
      canOpenURL: async () => false,
      openURL: async (url) => { opened.push(url); },
    });
    expect(result).toBe('fallback');
    expect(opened[0]).toContain('https://www.google.com/maps/search/?api=1&query=4.5,101.2');
  });

  it('uses the Android navigation intent when available and rejects invalid coordinates', async () => {
    const opened: string[] = [];
    const result = await openPickupNavigation(4.5, 101.2, {
      canOpenURL: async () => true,
      openURL: async (url) => { opened.push(url); },
    });
    expect(result).toBe('android');
    expect(opened).toEqual(['google.navigation:q=4.5,101.2']);
    expect(() => getNavigationLinks(91, 101)).toThrow('authorized pickup destination is invalid');
  });
});
