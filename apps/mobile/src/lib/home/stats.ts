import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface RecentScanItem {
  id: string;
  created_at: string;
  item_count: number;
}

export interface HomeStats {
  total_scans: number;
  verified_recyclable_items: number;
  active_requests: number;
  recent_scans: RecentScanItem[];
}

export const HOME_STATS_STORAGE_KEY = 'snappick:home-stats-cache';

export const DEFAULT_HOME_STATS: HomeStats = {
  total_scans: 0,
  verified_recyclable_items: 0,
  active_requests: 0,
  recent_scans: [],
};

/**
 * Loads cached home statistics from AsyncStorage.
 */
export async function getCachedHomeStats(): Promise<HomeStats | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_STATS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HomeStats;
  } catch {
    return null;
  }
}

/**
 * Saves home statistics to AsyncStorage for offline rendering.
 */
export async function setCachedHomeStats(stats: HomeStats): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (err) {
    console.warn('Failed to cache home stats:', err);
  }
}

/**
 * Fetches real-time home statistics from Supabase via get_home_stats RPC.
 * Automatically updates offline cache. Falls back to cached data if offline.
 */
export async function fetchHomeStats(): Promise<{ stats: HomeStats; fromCache: boolean }> {
  try {
    const { data, error } = await supabase.rpc('get_home_stats');

    if (error) {
      throw error;
    }

    if (data && typeof data === 'object') {
      const stats: HomeStats = {
        total_scans: Number(data.total_scans ?? 0),
        verified_recyclable_items: Number(data.verified_recyclable_items ?? 0),
        active_requests: Number(data.active_requests ?? 0),
        recent_scans: Array.isArray(data.recent_scans)
          ? data.recent_scans.map((s: Record<string, unknown>) => ({
              id: String(s.id ?? ''),
              created_at: String(s.created_at ?? ''),
              item_count: Number(s.item_count ?? 0),
            }))
          : [],
      };

      await setCachedHomeStats(stats);
      return { stats, fromCache: false };
    }
  } catch (err) {
    console.warn('Failed to fetch home stats from server, falling back to cache:', err);
  }

  const cached = await getCachedHomeStats();
  return {
    stats: cached ?? DEFAULT_HOME_STATS,
    fromCache: true,
  };
}

