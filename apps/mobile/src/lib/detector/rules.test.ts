import { describe, expect, it } from 'vitest';
import {
  BUNDLED_RULE_SET,
  CONDITIONS,
  DETECTOR_LABELS,
  MANUAL_SAFETY_LABELS,
  evaluateEligibility,
  isEligible,
  parseRuleSet,
} from './rules';

describe('Detector rules and eligibility', () => {
  it('defines the 7 detector labels and 4 conditions', () => {
    expect(DETECTOR_LABELS).toEqual(['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological']);
    for (const label of DETECTOR_LABELS) {
      for (const condition of CONDITIONS) {
        expect(evaluateEligibility(label, condition, BUNDLED_RULE_SET).reason.length).toBeGreaterThan(0);
      }
    }
    expect(evaluateEligibility('paper', 'clean_dry').eligibility).toBe('eligible');
    expect(evaluateEligibility('paper', 'contaminated_wet').eligibility).toBe('not_eligible');
    expect(evaluateEligibility('glass', 'broken_unsafe').eligibility).toBe('restricted');
    expect(isEligible('paper', 'clean_dry')).toBe(true);
    expect(isEligible('trash', 'clean_dry')).toBe(false);
  });

  it('defines manual safety labels', () => {
    expect(Object.keys(MANUAL_SAFETY_LABELS)).toEqual([
      'batteries',
      'bulbs',
      'e_waste',
      'chemicals',
      'sharp_objects',
      'other_hazards',
    ]);
  });

  it('parses valid RuleSet and rejects invalid objects', () => {
    expect(parseRuleSet(BUNDLED_RULE_SET)).toEqual(BUNDLED_RULE_SET);
    expect(parseRuleSet(null)).toBeNull();
    expect(parseRuleSet({})).toBeNull();
    expect(parseRuleSet({ id: 'test', version: 'not-a-number' })).toBeNull();
    expect(parseRuleSet({ id: 'test', version: 1, label: 'test', classes: 'invalid' })).toBeNull();
    expect(
      parseRuleSet({
        id: 'test',
        version: 1,
        label: 'test',
        classes: {
          paper: { material: 'invalid_type', conditionRules: {} },
        },
      })
    ).toBeNull();
  });
});

