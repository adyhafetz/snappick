import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  MAX_SESSION_ATTEMPTS,
  flushPendingScanSessions,
  loadPendingSessions,
  queuePendingScanSession,
} from './pending-sessions';
import type { PersistScanParams, PersistScanResult } from './persistence';
import { loadUploadQueue } from './upload-queue';

vi.mock('expo-image-manipulator', () => ({ manipulateAsync: vi.fn(), SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn(async (key: string) => store[key] ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: vi.fn(async (key: string) => {
        delete store[key];
      }),
      clear: vi.fn(async () => {
        store = {};
      }),
    },
  };
});
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ upsert: vi.fn(async () => ({ error: null })), update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })) },
}));

function params(scanId: string, userId = 'user-a'): PersistScanParams {
  return {
    scanId,
    userId,
    modelVersion: 'v2',
    imageStorageConsent: true,
    trainingOptIn: true,
    imageWidth: 800,
    imageHeight: 600,
    preprocessMs: 10,
    inferenceMs: 20,
    detections: [],
  };
}

const saved = (shouldUpload: boolean) =>
  ({ gating: { shouldUpload } }) as unknown as PersistScanResult;

describe('pending scan sessions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps one entry per scan', async () => {
    await queuePendingScanSession(params('s1'), 'file:///a.jpg');
    await queuePendingScanSession(params('s1'), 'file:///a.jpg');
    expect(await loadPendingSessions()).toHaveLength(1);
  });

  it('saves queued scans when back online and queues the photo upload', async () => {
    await queuePendingScanSession(params('s1'), 'file:///a.jpg');
    const persist = vi.fn(async () => saved(true));
    const result = await flushPendingScanSessions('user-a', persist);
    expect(result.saved).toBe(1);
    expect(await loadPendingSessions()).toHaveLength(0);
    expect((await loadUploadQueue()).map((q) => q.scanId)).toEqual(['s1']);
  });

  it('does not queue a photo upload when the scan is not selected for upload', async () => {
    await queuePendingScanSession(params('s2'), 'file:///b.jpg');
    await flushPendingScanSessions('user-a', vi.fn(async () => saved(false)));
    expect(await loadUploadQueue()).toHaveLength(0);
  });

  it('keeps a scan that still cannot be saved and counts the attempt', async () => {
    await queuePendingScanSession(params('s3'), 'file:///c.jpg');
    const result = await flushPendingScanSessions('user-a', vi.fn(async () => { throw new Error('offline'); }));
    expect(result.failed).toBe(1);
    const [item] = await loadPendingSessions();
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBe('offline');
  });

  it('drops a scan after too many failed attempts', async () => {
    await queuePendingScanSession(params('s4'), 'file:///d.jpg');
    const fail = vi.fn(async () => { throw new Error('rejected'); });
    let last = { dropped: 0 };
    for (let i = 0; i < MAX_SESSION_ATTEMPTS; i++) last = await flushPendingScanSessions('user-a', fail);
    expect(last.dropped).toBe(1);
    expect(await loadPendingSessions()).toHaveLength(0);
  });

  it("never saves another account's scan under the signed-in user", async () => {
    await queuePendingScanSession(params('s5', 'user-b'), 'file:///e.jpg');
    const persist = vi.fn(async () => saved(true));
    const result = await flushPendingScanSessions('user-a', persist);
    expect(persist).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(await loadPendingSessions()).toHaveLength(1);
  });

  it('does nothing while signed out', async () => {
    await queuePendingScanSession(params('s6'), 'file:///f.jpg');
    const persist = vi.fn(async () => saved(true));
    await flushPendingScanSessions(null, persist);
    expect(persist).not.toHaveBeenCalled();
  });
});
