import { BUNDLED_RULE_SET, evaluateEligibility } from './rules';
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

export function materialPresentation(label: string, uncertain: boolean, confirmed: boolean): MaterialPresentation {
  if (uncertain && !confirmed) return { label, color: CLASSIFICATION_COLORS.unsure, classification: 'unsure' };
  const rule = BUNDLED_RULE_SET.classes[label as keyof typeof BUNDLED_RULE_SET.classes];
  const classification = rule === 'conditional' ? 'recyclable' : rule === 'not_accepted' ? 'not_recyclable' : 'unsure';
  return { label, color: CLASSIFICATION_COLORS[classification], classification };
}

export function pickupDecision(label: string, condition: Condition, uncertain: boolean, confirmed: boolean): RuleDecision {
  if (uncertain && !confirmed) {
    return { eligibility: 'needs_confirmation', reason: 'Confirm the detected label before pickup eligibility can be checked.' };
  }
  return evaluateEligibility(label, condition);
}
