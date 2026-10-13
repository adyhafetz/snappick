import type { Condition, RuleDecision } from './types';

export const BUNDLED_RULE_SET = {
  id: 'perak_general',
  version: 1,
  classes: { metal: 'conditional', trash: 'not_accepted', glass: 'conditional', paper: 'conditional', cardboard: 'conditional', plastic: 'conditional', biological: 'not_accepted' },
} as const;

export function evaluateEligibility(label: string, condition: Condition): RuleDecision {
  const classDecision = BUNDLED_RULE_SET.classes[label as keyof typeof BUNDLED_RULE_SET.classes];
  if (!classDecision) return { eligibility: 'not_eligible', reason: 'This label is not in the active bundled rule set.' };
  if (classDecision === 'not_accepted') return { eligibility: 'not_eligible', reason: 'This material is not accepted for pickup.' };
  if (condition === 'clean_dry') return { eligibility: 'eligible', reason: 'Clean and dry materials can be included.' };
  return { eligibility: 'not_eligible', reason: condition === 'broken_unsafe' ? 'Unsafe items must be removed from pickup.' : 'Only clean and dry items are eligible.' };
}

export function isEligible(label: string, condition: Condition): boolean { return evaluateEligibility(label, condition).eligibility === 'eligible'; }
export type ManualSafetyKey = 'batteries' | 'bulbs' | 'e_waste' | 'chemicals' | 'sharp_objects' | 'other_hazards';
export const MANUAL_SAFETY_LABELS: Record<ManualSafetyKey, string> = {
  batteries: 'Batteries', bulbs: 'Bulbs', e_waste: 'E-waste', chemicals: 'Chemicals', sharp_objects: 'Sharp objects', other_hazards: 'Other hazards',
};

