// Feature-flagged Maps API entry point.
// VITE_USE_REAL_MAPS=false (default) → stub (no API calls, no quota used)
// VITE_USE_REAL_MAPS=true            → real Google Maps API

const useRealMaps = import.meta.env.VITE_USE_REAL_MAPS === 'true';

// The dynamic import must happen inside an async function, not at module
// top-level — top-level await isn't supported by Vite's production build
// target (chrome87/safari14/etc.), even though it works fine in dev mode's
// native-ESM dev server. This was caught by CI's production build, not the
// dev server, since the two use different transform pipelines.
export async function getRouteMatrix(origins, destinations) {
  const mapsModule = useRealMaps
    ? await import('./mapsApi.js')
    : await import('./mapsApiStub.js');
  return mapsModule.getRouteMatrix(origins, destinations);
}
