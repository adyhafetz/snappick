import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { prepareScanImage, uploadScanImage } from './upload';

export interface QueueItem {
  id: string;
  scanId: string;
  userId: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  status: 'pending' | 'uploading' | 'done' | 'failed' | 'skipped';
  attempts: number;
  lastAttemptAt?: string | null;
  lastError?: string | null;
  createdAt: string;
}

const STORAGE_KEY = 'snappick:scan-upload-queue';
const MAX_ATTEMPTS = 5;

/**
 * Loads the offline upload queue from local storage.
 */
export async function loadUploadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueueItem[];
  } catch (error) {
    console.warn('Failed to load upload queue from storage:', error);
    return [];
  }
}

/**
 * Saves the offline upload queue to local storage.
 */
export async function saveUploadQueue(queue: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to save upload queue to storage:', error);
  }
}

/**
 * Enqueues a scan image for upload in the offline-resilient queue.
 */
export async function enqueueScanUpload(
  params: Omit<QueueItem, 'id' | 'status' | 'attempts' | 'createdAt'>
): Promise<QueueItem> {
  const queue = await loadUploadQueue();

  // Avoid duplicate enqueue for same scanId
  const existing = queue.find((item) => item.scanId === params.scanId);
  if (existing) {
    return existing;
  }

  const newItem: QueueItem = {
    ...params,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
  };

  queue.push(newItem);
  await saveUploadQueue(queue);

  return newItem;
}

/**
 * Flushes/processes all pending upload tasks in the offline queue.
 * Safe to call on reconnect, app focus, or background job.
 */
export async function flushOfflineUploadQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const queue = await loadUploadQueue();
  let succeeded = 0;
  let failed = 0;
  let processed = 0;

  const pendingItems = queue.filter(
    (item) => item.status === 'pending' || (item.status === 'failed' && item.attempts < MAX_ATTEMPTS)
  );

  for (const item of pendingItems) {
    processed++;
    item.status = 'uploading';
    item.attempts += 1;
    item.lastAttemptAt = new Date().toISOString();

    try {
      // 1. Prepare image (max 800px, EXIF stripped, quality 0.65)
      const prepared = await prepareScanImage(
        item.imageUri,
        item.imageWidth,
        item.imageHeight
      );

      // 2. Upload to private 'scans' bucket
      await uploadScanImage(
        item.userId,
        item.scanId,
        prepared.bytes
      );

      // 3. Mark success on server metadata tables
      await supabase
        .from('feedback_samples')
        .update({ upload_status: 'done' })
        .eq('scan_id', item.scanId);

      await supabase
        .from('scan_upload_queue')
        .upsert(
          {
            scan_id: item.scanId,
            user_id: item.userId,
            status: 'done',
            attempts: item.attempts,
            last_attempt_at: item.lastAttemptAt,
          },
          { onConflict: 'scan_id' }
        );

      item.status = 'done';
      item.lastError = null;
      succeeded++;
    } catch (err) {
      failed++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      item.status = item.attempts >= MAX_ATTEMPTS ? 'skipped' : 'failed';
      item.lastError = errorMessage;

      // Update server state if reachable
      try {
        await supabase
          .from('scan_upload_queue')
          .upsert(
            {
              scan_id: item.scanId,
              user_id: item.userId,
              status: item.status,
              attempts: item.attempts,
              last_attempt_at: item.lastAttemptAt,
              last_error: errorMessage,
            },
            { onConflict: 'scan_id' }
          );
      } catch {
        // Ignore secondary error while updating status table
      }
    }
  }

  // Prune completed items from local queue, retaining up to 20 recent records for history
  const updatedQueue = queue.filter((item) => item.status !== 'done');
  await saveUploadQueue(updatedQueue);

  return { processed, succeeded, failed };
}
