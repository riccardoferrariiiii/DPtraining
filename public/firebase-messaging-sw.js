self.addEventListener('push', (event) => {
  const payload = event.data && event.data.json ? event.data.json() : {};
  const notification = payload.notification || {};
  const title = notification.title || 'Nuova notifica';
  const body = notification.body || 'Hai ricevuto un aggiornamento';
  const icon = notification.icon || '/logo.svg?v=4';

  const options = {
    body,
    icon,
    data: payload.data || {},
    tag: 'kraveon-notification',
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return client.postMessage({ type: 'NAVIGATE', url });
        }
      }
      return clients.openWindow(url);
    })
  );
});
