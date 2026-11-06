/**
 * When the app should look for a new detector model on its own, and when it should
 * ask the user about one. Pure functions so they are easy to test.
 */
export const MODEL_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // look for updates at most every 6 hours
export const MODEL_PROMPT_SNOOZE_MS = 24 * 60 * 60 * 1000; // after "Later", do not ask about the same version for 24 hours

export interface DismissedModelPrompt {
  version: string;
  at: number;
}

export function shouldCheckForModelUpdate(
  lastCheckedAt: number | null,
  now: number,
  intervalMs: number = MODEL_CHECK_INTERVAL_MS
): boolean {
  if (lastCheckedAt == null || !Number.isFinite(lastCheckedAt)) return true;
  // A clock that moved backwards should not block checking forever.
  if (lastCheckedAt > now) return true;
  return now - lastCheckedAt >= intervalMs;
}

export function shouldPromptForModel(
  version: string,
  dismissed: DismissedModelPrompt | null,
  now: number,
  snoozeMs: number = MODEL_PROMPT_SNOOZE_MS
): boolean {
  if (!dismissed || dismissed.version !== version) return true;
  if (dismissed.at > now) return true;
  return now - dismissed.at >= snoozeMs;
}
