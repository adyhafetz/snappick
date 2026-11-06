import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import { enqueueScanUpload, flushOfflineUploadQueue } from './upload-queue';
import { persistScanSession, type PersistScanParams, type PersistScanResult } from './persistence';

/**
 * A scan that could not be saved (usually no network) is kept here with everything needed to save
 * it later: detections, the user's corrections and the photo location. Without this the scan, its
 * feedback and its training image were silently lost whenever the phone was offline.
 */
export interface PendingScanSession {
  params: PersistScanParams;
  imageUri: string;
  attempts: number;
  queuedAt: string;
  lastError?: string | null;
}

const STORAGE_KEY = 'snappick:pending-scan-sessions';
export const MAX_SESSION_ATTEMPTS = 10;
export const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function loadPendingSessions(): Promise<PendingScanSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PendingScanSession[]) : [];
  } catch {
    return [];
  }
}

async function savePendingSessions(items: PendingScanSession[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn('Failed to save pending scan sessions:', error);
  }
}

/** Keeps a scan for later. One entry per scan id, so repeated failures do not duplicate it. */
export async function queuePendingScanSession(
  params: PersistScanParams,
  imageUri: string,
  lastError?: string | null
): Promise<void> {
  const items = await loadPendingSessions();
  if (items.some((item) => item.params.scanId === params.scanId)) return;
  items.push({ params, imageUri, attempts: 0, queuedAt: new Date().toISOString(), lastError: lastError ?? null });
  await savePendingSessions(items);
}

export async function flushPendingScanSessions(
  currentUserId: string | null | undefined,
  persist: (params: PersistScanParams) => Promise<PersistScanResult> = persistScanSession,
  now: number = Date.now()
): Promise<{ saved: number; failed: number; dropped: number; skipped: number }> {
  const items = await loadPendingSessions();
  const keep: PendingScanSession[] = [];
  const result = { saved: 0, failed: 0, dropped: 0, skipped: 0 };

  for (const item of items) {
    // Never save a scan under another account that signed in on this phone since.
    if (!currentUserId || item.params.userId !== currentUserId) {
      if (now - Date.parse(item.queuedAt) > MAX_SESSION_AGE_MS) result.dropped++;
      else {
        keep.push(item);
        result.skipped++;
      }
      continue;
    }

    try {
      const saved = await persist(item.params);
      if (saved.gating.shouldUpload) {
        await enqueueScanUpload({
          scanId: item.params.scanId,
          userId: item.params.userId,
          imageUri: item.imageUri,
          imageWidth: item.params.imageWidth,
          imageHeight: item.params.imageHeight,
        });
      }
      result.saved++;
    } catch (error) {
      const attempts = item.attempts + 1;
      if (attempts >= MAX_SESSION_ATTEMPTS || now - Date.parse(item.queuedAt) > MAX_SESSION_AGE_MS) {
        result.dropped++;
      } else {
        keep.push({ ...item, attempts, lastError: error instanceof Error ? error.message : String(error) });
        result.failed++;
      }
    }
  }

  await savePendingSessions(keep);
  return result;
}

/** Save scans that were taken offline, then upload their photos. Safe to call often (Home focus, app start). */
export async function syncOfflineScans(): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    await flushPendingScanSessions(data.session?.user.id);
  } catch {
    // stay queued
  }
  await flushOfflineUploadQueue();
}
