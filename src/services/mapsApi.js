// Real Google Maps Platform Routes API client.
// Implemented as part of the Google Maps Epic (Phase 5).
// API key retrieved from AWS Secrets Manager by the Lambda; never on the client.

export async function getDrivingRoute(origin, destination) {
  throw new Error(
    'Real Maps API not yet implemented. Set VITE_USE_REAL_MAPS=false to use stub.'
  );
}
