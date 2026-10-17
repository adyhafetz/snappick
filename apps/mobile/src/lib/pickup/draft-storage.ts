import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PickupDraft } from './pickup';

const PICKUP_DRAFT_KEY = 'snappick:pickup-review-draft';

export async function savePickupDraft(draft: PickupDraft): Promise<void> {
  await AsyncStorage.setItem(PICKUP_DRAFT_KEY, JSON.stringify(draft));
}

export async function loadPickupDraft(): Promise<PickupDraft | null> {
  const value = await AsyncStorage.getItem(PICKUP_DRAFT_KEY);
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || !Array.isArray(parsed.items) || !Array.isArray(parsed.restrictedItems)
      || typeof parsed.restrictedItemsConfirmed !== 'boolean' || !isRecord(parsed.ruleSet)) return null;
    return parsed as unknown as PickupDraft;
  } catch {
    return null;
  }
}

export async function clearPickupDraft(): Promise<void> {
  await AsyncStorage.removeItem(PICKUP_DRAFT_KEY);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
