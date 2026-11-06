import { describe, expect, it } from 'vitest';
import {
  MODEL_CHECK_INTERVAL_MS,
  MODEL_PROMPT_SNOOZE_MS,
  shouldCheckForModelUpdate,
  shouldPromptForModel,
} from './model-update-policy';

describe('shouldCheckForModelUpdate', () => {
  const now = 1_000_000_000_000;

  it('checks when it has never checked', () => {
    expect(shouldCheckForModelUpdate(null, now)).toBe(true);
  });

  it('waits for the interval to pass', () => {
    expect(shouldCheckForModelUpdate(now - 60_000, now)).toBe(false);
    expect(shouldCheckForModelUpdate(now - MODEL_CHECK_INTERVAL_MS, now)).toBe(true);
  });

  it('does not get stuck when the clock moved backwards', () => {
    expect(shouldCheckForModelUpdate(now + 5_000, now)).toBe(true);
  });
});

describe('shouldPromptForModel', () => {
  const now = 1_000_000_000_000;

  it('asks when nothing was dismissed', () => {
    expect(shouldPromptForModel('v3', null, now)).toBe(true);
  });

  it('stays quiet for the same version right after "Later"', () => {
    expect(shouldPromptForModel('v3', { version: 'v3', at: now - 1000 }, now)).toBe(false);
  });

  it('asks again after the snooze, or immediately for a different version', () => {
    expect(shouldPromptForModel('v3', { version: 'v3', at: now - MODEL_PROMPT_SNOOZE_MS }, now)).toBe(true);
    expect(shouldPromptForModel('v4', { version: 'v3', at: now - 1000 }, now)).toBe(true);
  });
});
