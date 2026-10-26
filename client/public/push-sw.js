/* Manejadores de Web Push para BeautyControl Pro.
 *
 * Este archivo se inyecta en el service worker generado por vite-plugin-pwa
 * (workbox.importScripts). Corre aunque la aplicación esté en segundo plano o
 * cerrada, que es justamente lo que el constructor `new Notification()` de la
 * página no puede hacer.
 */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'BeautyControl Pro', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'BeautyControl Pro';
  const options = {
    body: payload.body || '',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.tag || 'nailcontrol',
    // Reemplaza un aviso previo con el mismo tag en lugar de acumularlos, pero
    // sí vibra/suena de nuevo.
    renotify: Boolean(payload.tag),
    vibrate: [120, 60, 120],
    data: { url: payload.url || '/appointments' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = event.notification.data?.url || '/appointments';

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Si la app ya está abierta en alguna ventana, se enfoca y se navega ahí
      // en lugar de abrir una pestaña nueva.
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              /* algunas plataformas no permiten navigate: queda enfocada */
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) await self.clients.openWindow(target);
    })()
  );
});
