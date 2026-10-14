import type { Condition, RuleDecision } from './types';

export const DETECTOR_LABELS = ['metal', 'trash', 'glass', 'paper', 'cardboard', 'plastic', 'biological'] as const;
export type DetectorLabel = typeof DETECTOR_LABELS[number];
export type MaterialClass = { material: 'recyclable' | 'not_recyclable'; conditionRules: Record<Condition, { eligibility: RuleDecision['eligibility']; reason: string }> };
export type RuleSet = { id: string; version: number; label: string; classes: Record<string, MaterialClass> };

export const BUNDLED_RULE_SET = {
  id: 'perak_general',
  version: 2,
  label: 'General Perak guidance',
  classes: {
    metal: { material: 'recyclable', conditionRules: { clean_dry: { eligibility: 'needs_confirmation', reason: 'Confirm local metal acceptance and remove unsafe parts.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Only clean and dry items should be offered.' }, broken_unsafe: { eligibility: 'restricted', reason: 'Do not offer sharp or unsafe metal.' }, unknown: { eligibility: 'needs_confirmation', reason: 'Confirm the item is safe and accepted locally.' } } },
    trash: { material: 'not_recyclable', conditionRules: { clean_dry: { eligibility: 'not_eligible', reason: 'General waste is not accepted for recycling pickup.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'General waste is not accepted for recycling pickup.' }, broken_unsafe: { eligibility: 'not_eligible', reason: 'General waste is not accepted for recycling pickup.' }, unknown: { eligibility: 'not_eligible', reason: 'General waste is not accepted for recycling pickup.' } } },
    glass: { material: 'recyclable', conditionRules: { clean_dry: { eligibility: 'needs_confirmation', reason: 'Confirm local glass acceptance; only offer intact glass.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Only clean and dry items should be offered.' }, broken_unsafe: { eligibility: 'restricted', reason: 'Broken glass is unsafe; do not place it in community pickup.' }, unknown: { eligibility: 'needs_confirmation', reason: 'Confirm the glass is intact and accepted locally.' } } },
    paper: { material: 'recyclable', conditionRules: { clean_dry: { eligibility: 'eligible', reason: 'Clean, dry paper may be offered under general Perak guidance.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Wet or contaminated paper is not eligible.' }, broken_unsafe: { eligibility: 'not_eligible', reason: 'Separate any unsafe contamination before pickup.' }, unknown: { eligibility: 'needs_confirmation', reason: 'Check that the paper is clean and dry.' } } },
    cardboard: { material: 'recyclable', conditionRules: { clean_dry: { eligibility: 'eligible', reason: 'Clean, dry cardboard may be offered under general Perak guidance.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Wet or contaminated cardboard is not eligible.' }, broken_unsafe: { eligibility: 'not_eligible', reason: 'Separate any unsafe contamination before pickup.' }, unknown: { eligibility: 'needs_confirmation', reason: 'Check that the cardboard is clean and dry.' } } },
    plastic: { material: 'recyclable', conditionRules: { clean_dry: { eligibility: 'needs_confirmation', reason: 'Plastic acceptance varies by item and local collection rules.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Only clean and dry items should be offered.' }, broken_unsafe: { eligibility: 'restricted', reason: 'Do not offer sharp or unsafe plastic.' }, unknown: { eligibility: 'needs_confirmation', reason: 'Confirm item type, condition, and local acceptance.' } } },
    biological: { material: 'not_recyclable', conditionRules: { clean_dry: { eligibility: 'not_eligible', reason: 'Biological waste is not accepted for this recycling pickup.' }, contaminated_wet: { eligibility: 'not_eligible', reason: 'Biological waste is not accepted for this recycling pickup.' }, broken_unsafe: { eligibility: 'not_eligible', reason: 'Biological waste is not accepted for this recycling pickup.' }, unknown: { eligibility: 'not_eligible', reason: 'Biological waste is not accepted for this recycling pickup.' } } },
  },
} satisfies RuleSet;

export const MANUAL_SAFETY_LABELS = {
  batteries: 'Batteries', bulbs: 'Bulbs', e_waste: 'E-waste', chemicals: 'Chemicals', sharp_objects: 'Sharp objects', other_hazards: 'Other hazards',
} as const;
export type ManualSafetyKey = keyof typeof MANUAL_SAFETY_LABELS;
export const CONDITIONS: readonly Condition[] = ['clean_dry', 'contaminated_wet', 'broken_unsafe', 'unknown'];

export function evaluateEligibility(label: string, condition: Condition, ruleSet: RuleSet = BUNDLED_RULE_SET): RuleDecision {
  const entry = ruleSet.classes[label];
  if (!entry) return { eligibility: 'not_eligible', reason: 'This label is not in the active rule set.' };
  return entry.conditionRules[condition] ?? { eligibility: 'needs_confirmation', reason: 'No specific local rule is available; confirm with the collection provider.' };
}

export function isEligible(label: string, condition: Condition, ruleSet?: RuleSet): boolean { return evaluateEligibility(label, condition, ruleSet).eligibility === 'eligible'; }

