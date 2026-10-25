import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueScanUpload,
  flushOfflineUploadQueue,
  loadUploadQueue,
} from './upload-queue';
import * as uploadModule from './upload';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}));

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
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
      upsert: vi.fn(async () => ({ error: null })),
    })),
  },
}));

describe('Offline Upload Queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('enqueues a scan upload item', async () => {
    const item = await enqueueScanUpload({
      scanId: 'scan-123',
      userId: 'user-abc',
      imageUri: 'file:///photo.jpg',
      imageWidth: 1000,
      imageHeight: 1000,
    });

    expect(item.scanId).toBe('scan-123');
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(0);

    const queue = await loadUploadQueue();
    expect(queue.length).toBe(1);
    expect(queue[0]?.scanId).toBe('scan-123');
  });

  it('prevents duplicate enqueueing for the same scanId', async () => {
    await enqueueScanUpload({
      scanId: 'scan-123',
      userId: 'user-abc',
      imageUri: 'file:///photo.jpg',
      imageWidth: 1000,
      imageHeight: 1000,
    });

    const duplicate = await enqueueScanUpload({
      scanId: 'scan-123',
      userId: 'user-abc',
      imageUri: 'file:///photo.jpg',
      imageWidth: 1000,
      imageHeight: 1000,
    });

    const queue = await loadUploadQueue();
    expect(queue.length).toBe(1);
    expect(duplicate.scanId).toBe('scan-123');
  });

  it('flushes pending queue items successfully when online', async () => {
    vi.spyOn(uploadModule, 'prepareScanImage').mockResolvedValueOnce({
      uri: 'file:///resized.jpg',
      width: 800,
      height: 800,
      base64: 'mock-base64',
      bytes: new Uint8Array([1, 2, 3]),
    });

    vi.spyOn(uploadModule, 'uploadScanImage').mockResolvedValueOnce('user-abc/scan-123.jpg');

    await enqueueScanUpload({
      scanId: 'scan-123',
      userId: 'user-abc',
      imageUri: 'file:///photo.jpg',
      imageWidth: 1000,
      imageHeight: 1000,
    });

    const result = await flushOfflineUploadQueue();
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    // Completed items should be pruned
    const queue = await loadUploadQueue();
    expect(queue.length).toBe(0);
  });

  it('retains item and records error when upload fails (e.g. offline/airplane mode)', async () => {
    vi.spyOn(uploadModule, 'prepareScanImage').mockRejectedValueOnce(
      new Error('Network request failed: device offline')
    );

    await enqueueScanUpload({
      scanId: 'scan-offline',
      userId: 'user-abc',
      imageUri: 'file:///photo.jpg',
      imageWidth: 1000,
      imageHeight: 1000,
    });

    const result = await flushOfflineUploadQueue();
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);

    // Item should still be in queue with updated attempts and error
    const queue = await loadUploadQueue();
    expect(queue.length).toBe(1);
    expect(queue[0]?.scanId).toBe('scan-offline');
    expect(queue[0]?.attempts).toBe(1);
    expect(queue[0]?.status).toBe('failed');
    expect(queue[0]?.lastError).toContain('device offline');
  });
});
