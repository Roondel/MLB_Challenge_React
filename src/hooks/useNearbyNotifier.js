import { useEffect, useRef } from 'react';
import { PARKS } from '../data/parks';
import {
  registerServiceWorker,
  requestNotificationPermission,
  isIosSafari,
  isRunningAsStandalone,
  showParkNotification,
} from '../services/notifications';

const THRESHOLD_MILES = 0.5;
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

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

export function useNearbyNotifier() {
  const cooldownMap = useRef({});
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const skipPermission = isIosSafari() && !isRunningAsStandalone();

    // Start watchPosition only after SW is registered — ensures every
    // notification is created via swReg.showNotification() so that
    // clicking it reliably fires the SW notificationclick event.
    Promise.all([
      registerServiceWorker(),
      skipPermission ? Promise.resolve('default') : requestNotificationPermission(),
    ]).then(([swReg]) => {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          const now = Date.now();

          for (const park of PARKS) {
            const dist = haversine(latitude, longitude, park.lat, park.lng);
            if (dist > THRESHOLD_MILES) continue;

            const lastNotified = cooldownMap.current[park.teamId] ?? 0;
            if (now - lastNotified < COOLDOWN_MS) continue;

            if (Notification.permission !== 'granted') continue;

            cooldownMap.current[park.teamId] = now;
            showParkNotification(park, swReg);
          }
        },
        null,
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
      );
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
}
