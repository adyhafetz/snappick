import { describe, expect, it } from 'vitest';
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
