import { useState, useEffect } from 'react';

const THRESHOLD_MILES = 0.5;

function haversine(lat1, lng1, lat2, lng2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGeoProximity(targetLat, targetLng) {
  const [state, setState] = useState({ nearby: false, distanceMiles: null, loading: true, error: null });

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ nearby: false, distanceMiles: null, loading: false, error: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, targetLat, targetLng);
        setState({ nearby: dist <= THRESHOLD_MILES, distanceMiles: dist, loading: false, error: null });
      },
      () => {
        setState({ nearby: false, distanceMiles: null, loading: false, error: 'denied' });
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [targetLat, targetLng]);

  return state;
}
