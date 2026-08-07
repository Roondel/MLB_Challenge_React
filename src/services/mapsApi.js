// Real Google Maps Platform Routes API client.
// Implemented as part of the Google Maps Epic (Phase 5).
// API key retrieved from AWS Secrets Manager by the Lambda; never on the client.

import { apiFetch } from './api.js';

const ROUTE_API = '/api/route';

/**
 * Get a full driving-distance matrix between every origin and every destination
 * via the mlb-route-{env} Lambda (VITE_ROUTE_API), which calls Google's
 * computeRouteMatrix.
 *
 * @param {Array<{lat, lng}>} origins
 * @param {Array<{lat, lng}>} destinations
 * @returns {Promise<{ matrix: Array<{ originIndex, destinationIndex, distanceMiles, durationMinutes }> }>}
 */
export async function getRouteMatrix(origins, destinations) {
  return apiFetch(ROUTE_API, {
    method: 'POST',
    body: JSON.stringify({ origins, destinations }),
  });
}
