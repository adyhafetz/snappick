export type RouteInfo = {
  coordinates: [number, number][];
  distanceKm: number;
  durationMins: number;
  distanceFormatted: string;
  durationFormatted: string;
  isDrivingRoute: boolean;
};

/**
 * Calculates straight line distance (Haversine formula) in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function formatDuration(durationMins: number): string {
  if (durationMins < 1) return '< 1 min';
  if (durationMins >= 60) {
    const hours = Math.floor(durationMins / 60);
    const mins = Math.round(durationMins % 60);
    return mins > 0 ? `${hours} hr ${mins} min` : `${hours} hr`;
  }
  return `${Math.round(durationMins)} min`;
}

/**
 * Fetches driving route from OSRM, with automatic straight-line fallback.
 */
export async function fetchDrivingRoute(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number,
  signal?: AbortSignal
): Promise<RouteInfo> {
  const straightDist = calculateHaversineDistance(startLat, startLng, destLat, destLng);
  // Default estimate assuming ~35 km/h driving speed in urban Perak
  const fallbackMins = Math.max(1, (straightDist / 35) * 60);

  const fallback: RouteInfo = {
    coordinates: [
      [startLng, startLat],
      [destLng, destLat],
    ],
    distanceKm: Math.round(straightDist * 10) / 10,
    durationMins: Math.round(fallbackMins),
    distanceFormatted: formatDistance(straightDist),
    durationFormatted: formatDuration(fallbackMins),
    isDrivingRoute: false,
  };

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return fallback;
    const json = (await res.json()) as {
      code?: string;
      routes?: {
        distance: number;
        duration: number;
        geometry: { coordinates: [number, number][] };
      }[];
    };
    if (json.code !== 'Ok' || !json.routes?.[0]?.geometry?.coordinates) {
      return fallback;
    }

    const route = json.routes[0];
    const distKm = route.distance / 1000;
    const durMins = route.duration / 60;

    return {
      coordinates: route.geometry.coordinates,
      distanceKm: Math.round(distKm * 10) / 10,
      durationMins: Math.round(durMins),
      distanceFormatted: formatDistance(distKm),
      durationFormatted: formatDuration(durMins),
      isDrivingRoute: true,
    };
  } catch {
    return fallback;
  }
}

