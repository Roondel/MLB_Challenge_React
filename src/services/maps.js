// Feature-flagged Maps API entry point.
// VITE_USE_REAL_MAPS=false (default) → stub (no API calls, no quota used)
// VITE_USE_REAL_MAPS=true            → real Google Maps API (when implemented)

const useRealMaps = import.meta.env.VITE_USE_REAL_MAPS === 'true';

let mapsModule;

if (useRealMaps) {
  mapsModule = await import('./mapsApi.js');
} else {
  mapsModule = await import('./mapsApiStub.js');
}

export const { getDrivingRoute } = mapsModule;
