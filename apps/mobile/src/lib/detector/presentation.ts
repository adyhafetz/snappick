import { BUNDLED_RULE_SET, evaluateEligibility, type RuleSet } from './rules';
import type { Condition, RuleDecision } from './types';

export type MaterialPresentation = {
  label: string;
  color: string;
  classification: 'recyclable' | 'not_recyclable' | 'unsure';
};

const CLASSIFICATION_COLORS = {
  recyclable: '#15803d',
  not_recyclable: '#b42318',
  unsure: '#64748b',
} as const;

export function materialPresentation(label: string, uncertain: boolean, confirmed: boolean, ruleSet: RuleSet = BUNDLED_RULE_SET): MaterialPresentation {
  if (uncertain && !confirmed) return { label, color: CLASSIFICATION_COLORS.unsure, classification: 'unsure' };
  const rule = ruleSet.classes[label];
  const classification = rule?.material ?? 'unsure';
  return { label, color: CLASSIFICATION_COLORS[classification], classification };
}

export function pickupDecision(label: string, condition: Condition, uncertain: boolean, confirmed: boolean, ruleSet: RuleSet = BUNDLED_RULE_SET): RuleDecision {
  if (uncertain && !confirmed) {
    return { eligibility: 'needs_confirmation', reason: 'Confirm the detected label before pickup eligibility can be checked.' };
  }
  return evaluateEligibility(label, condition, ruleSet);
}
