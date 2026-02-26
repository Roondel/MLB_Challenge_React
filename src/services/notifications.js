export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function isRunningAsStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true
  );
}

export function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
  return isIos && isSafari;
}

export function showParkNotification(park, swReg) {
  const title = `You're near ${park.venueName}!`;
  const options = {
    body: `${park.teamName} — tap to check in`,
    icon: `https://www.mlbstatic.com/team-logos/${park.teamId}.svg`,
    tag: `park-nearby-${park.teamId}`,
    renotify: false,
    data: { parkUrl: `/parks/${park.teamId}` },
  };

  if (swReg?.showNotification) {
    return swReg.showNotification(title, options);
  }
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, options);
  }
}
