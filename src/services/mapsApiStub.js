// Stub for Google Maps Platform Routes API (computeRouteMatrix).
// Returns realistic fake data matching the real API response shape.
// Used when VITE_USE_REAL_MAPS is false (dev default).

const STUB_DELAY_MS = 200; // simulate network latency

// Matches tripPlanner.js's ROAD_FACTOR/DRIVE_SPEED_MPH so stub estimates
// stay consistent with the rest of the app's drive-time math.
const ROAD_FACTOR = 1.4;
const DRIVE_SPEED_MPH = 60;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function haversineMiles(a, b) {
  const R = 3959;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/**
 * Get a full driving-distance matrix between every origin and every destination.
 * Mirrors the interface that mapsApi.js implements against the real Routes API
 * computeRouteMatrix endpoint (VITE_ROUTE_API).
 *
 * @param {Array<{lat, lng}>} origins
 * @param {Array<{lat, lng}>} destinations
 * @returns {Promise<{ matrix: Array<{ originIndex, destinationIndex, distanceMiles, durationMinutes }> }>}
 */
export async function getRouteMatrix(origins, destinations) {
  await sleep(STUB_DELAY_MS);

  const matrix = [];
  origins.forEach((origin, originIndex) => {
    destinations.forEach((destination, destinationIndex) => {
      const straightLine = haversineMiles(origin, destination);
      const distanceMiles = Math.round(straightLine * ROAD_FACTOR * 10) / 10;
      const durationMinutes = Math.round((distanceMiles / DRIVE_SPEED_MPH) * 60);
      matrix.push({ originIndex, destinationIndex, distanceMiles, durationMinutes });
    });
  });

  return { matrix };
}
