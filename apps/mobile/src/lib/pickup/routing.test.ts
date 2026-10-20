import { describe, expect, it, vi } from 'vitest';
import {
  calculateHaversineDistance,
  fetchDrivingRoute,
  formatDistance,
  formatDuration,
} from './routing';

describe('routing utilities', () => {
  it('formats distances cleanly', () => {
    expect(formatDistance(0.45)).toBe('450 m');
    expect(formatDistance(3.24)).toBe('3.2 km');
    expect(formatDistance(12.89)).toBe('12.9 km');
  });

  it('formats durations cleanly', () => {
    expect(formatDuration(0.5)).toBe('< 1 min');
    expect(formatDuration(8.4)).toBe('8 min');
    expect(formatDuration(65)).toBe('1 hr 5 min');
    expect(formatDuration(120)).toBe('2 hr');
  });

  it('calculates straight line Haversine distance correctly', () => {
    // Distance between Ipoh center (4.5975, 101.0901) and Menglembu (4.5667, 101.0500) is approx ~5.6 km
    const dist = calculateHaversineDistance(4.5975, 101.0901, 4.5667, 101.05);
    expect(dist).toBeGreaterThan(4);
    expect(dist).toBeLessThan(7);
  });

  it('falls back to straight line if API fails or throws', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const route = await fetchDrivingRoute(4.5975, 101.0901, 4.5667, 101.05);
    expect(route.isDrivingRoute).toBe(false);
    expect(route.coordinates).toEqual([
      [101.0901, 4.5975],
      [101.05, 4.5667],
    ]);
    expect(route.distanceKm).toBeGreaterThan(0);

    globalThis.fetch = originalFetch;
  });

  it('parses valid OSRM response', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [
          {
            distance: 4200, // 4.2 km
            duration: 480, // 8 mins
            geometry: {
              coordinates: [
                [101.0901, 4.5975],
                [101.07, 4.58],
                [101.05, 4.5667],
              ],
            },
          },
        ],
      }),
    } as Response);

    const route = await fetchDrivingRoute(4.5975, 101.0901, 4.5667, 101.05);
    expect(route.isDrivingRoute).toBe(true);
    expect(route.distanceKm).toBe(4.2);
    expect(route.durationMins).toBe(8);
    expect(route.distanceFormatted).toBe('4.2 km');
    expect(route.durationFormatted).toBe('8 min');
    expect(route.coordinates).toHaveLength(3);

    globalThis.fetch = originalFetch;
  });
});

