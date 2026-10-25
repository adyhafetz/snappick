import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_HOME_STATS,
  fetchHomeStats,
  getCachedHomeStats,
  setCachedHomeStats,
  type HomeStats,
} from './stats';
import { supabase } from '@/lib/supabase';

vi.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    default: {
      getItem: vi.fn(async (key: string) => store[key] ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      clear: vi.fn(async () => {
        store = {};
      }),
    },
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe('Home Statistics Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('fetches real home stats from RPC and saves to offline cache', async () => {
    const mockData = {
      total_scans: 42,
      verified_recyclable_items: 85,
      active_requests: 2,
      recent_scans: [
        { id: 'scan-1', created_at: '2026-10-25T10:00:00Z', item_count: 3 },
      ],
    };

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: mockData,
      error: null,
    } as any);

    const { stats, fromCache } = await fetchHomeStats();
    expect(fromCache).toBe(false);
    expect(stats.total_scans).toBe(42);
    expect(stats.verified_recyclable_items).toBe(85);
    expect(stats.active_requests).toBe(2);
    expect(stats.recent_scans.length).toBe(1);
    expect(stats.recent_scans[0]?.item_count).toBe(3);

    const cached = await getCachedHomeStats();
    expect(cached).toEqual(stats);
  });

  it('falls back to cached stats if RPC fails (offline / airplane mode)', async () => {
    const cachedStats: HomeStats = {
      total_scans: 10,
      verified_recyclable_items: 20,
      active_requests: 1,
      recent_scans: [],
    };
    await setCachedHomeStats(cachedStats);

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Network disconnected' },
    } as any);

    const { stats, fromCache } = await fetchHomeStats();
    expect(fromCache).toBe(true);
    expect(stats).toEqual(cachedStats);
  });

  it('returns DEFAULT_HOME_STATS if RPC fails and no cache exists', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Network disconnected' },
    } as any);

    const { stats, fromCache } = await fetchHomeStats();
    expect(fromCache).toBe(true);
    expect(stats).toEqual(DEFAULT_HOME_STATS);
  });
});

