// Stub for Google Maps Platform Directions/Routes API.
// Returns realistic fake data matching the real API response shape.
// Used when VITE_USE_REAL_MAPS is false (dev default).

const STUB_DELAY_MS = 200; // simulate network latency

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get driving directions between two points.
 * Mirrors the interface that mapsApi.js will implement.
 *
 * @param {Object} origin      - { lat, lng }
 * @param {Object} destination - { lat, lng }
 * @returns {Promise<{ distanceMiles: number, durationMinutes: number, summary: string }>}
 */
export async function getDrivingRoute(origin, destination) {
  await sleep(STUB_DELAY_MS);

  // Rough haversine estimate (same as existing tripPlanner.js logic)
  const R = 3959;
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLng = (destination.lng - origin.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const straightLine = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMiles = Math.round(straightLine * 1.3 * 10) / 10;
  const durationMinutes = Math.round((distanceMiles / 60) * 60);

  return {
    distanceMiles,
    durationMinutes,
    summary: `Stub route (${distanceMiles} mi, ${durationMinutes} min)`,
  };
}
