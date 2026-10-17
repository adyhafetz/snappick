import { evaluateEligibility, type ManualSafetyKey, type RuleSet } from '../detector/rules';
import type { Condition, Eligibility } from '../detector/types';

export type PickupItemDraft = {
  id: string;
  className: string;
  source: 'detector' | 'user_added';
  condition: Condition;
  quantity: number;
};

export type PickupDraft = {
  items: PickupItemDraft[];
  restrictedItems: ManualSafetyKey[];
  restrictedItemsConfirmed: boolean;
  ruleSet: RuleSet;
};

export type EvaluatedPickupItem = PickupItemDraft & {
  eligibility: Eligibility;
  reason: string;
};

export type PickupForm = {
  unitNumber: string;
  street: string;
  landmark: string;
  accessInstructions: string;
  pickupNote: string;
};

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export function evaluatePickupItems(items: PickupItemDraft[], ruleSet: RuleSet): EvaluatedPickupItem[] {
  return items.map((item) => ({ ...item, ...evaluateEligibility(item.className, item.condition, ruleSet) }));
}

export function eligibilityChanges(
  before: EvaluatedPickupItem[],
  after: EvaluatedPickupItem[]
): EvaluatedPickupItem[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  return after.filter((item) => {
    const oldItem = previous.get(item.id);
    return oldItem && (oldItem.eligibility !== item.eligibility || oldItem.reason !== item.reason);
  });
}

export function validatePickupForm(form: PickupForm): string | null {
  if (!form.unitNumber.trim()) return 'Enter your house or unit number.';
  if (!form.street.trim()) return 'Enter your street.';
  return null;
}

export function canSubmitPickup(input: {
  online: boolean;
  submitting: boolean;
  addressValid: boolean;
  restrictedConfirmed: boolean;
  eligibleCount: number;
  areaResolved: boolean;
}): boolean {
  return input.online && !input.submitting && input.addressValid && input.restrictedConfirmed
    && input.eligibleCount > 0 && input.areaResolved;
}

export function summarizeEligibleItems(items: EvaluatedPickupItem[]): { className: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.eligibility === 'eligible') totals.set(item.className, (totals.get(item.className) ?? 0) + item.quantity);
  }
  return [...totals.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([className, quantity]) => ({ className, quantity }));
}
