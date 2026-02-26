self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const parkUrl = event.notification.data?.parkUrl ?? '/';
  const absoluteUrl = new URL(parkUrl, self.location.origin).href;
  // openWindow navigates to the exact URL — works whether the app is
  // already open or not, and avoids the complexity of postMessage/BroadcastChannel.
  event.waitUntil(self.clients.openWindow(absoluteUrl));
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
