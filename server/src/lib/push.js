const webpush = require('web-push');

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

const isConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (isConfigured) {
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:admin@florcatalan.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} else {
  console.warn(
    'Web Push desactivado: falta VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY. ' +
      'La campanita dentro de la app sigue funcionando.'
  );
}

function getPublicKey() {
  return isConfigured ? VAPID_PUBLIC_KEY : null;
}

// Guarda (o actualiza) la suscripción de un dispositivo.
async function saveSubscription(prisma, { userId, subscription, userAgent }) {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    const err = new Error('Suscripción inválida.');
    err.httpStatus = 400;
    throw err;
  }

  // El mismo endpoint puede reasignarse a otro usuario si dos personas usan el
  // mismo dispositivo, así que se actualiza el dueño en ese caso.
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth, userAgent: userAgent?.slice(0, 255) || null },
    create: {
      userId,
      endpoint,
      p256dh,
      auth,
      userAgent: userAgent?.slice(0, 255) || null,
    },
  });
}

async function removeSubscription(prisma, endpoint) {
  if (!endpoint) return;
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// Envía a todos los dispositivos de los usuarios indicados.
// Nunca lanza: un fallo de push no debe tumbar la operación que lo originó.
async function sendToUsers(prisma, userIds, payload) {
  if (!isConfigured) return { sent: 0, removed: 0, skipped: true };

  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return { sent: 0, removed: 0 };

  let subs = [];
  try {
    subs = await prisma.pushSubscription.findMany({ where: { userId: { in: ids } } });
  } catch (err) {
    console.error('Push: no se pudieron leer las suscripciones:', err.message);
    return { sent: 0, removed: 0 };
  }

  const body = JSON.stringify(payload);
  const expired = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 3600, urgency: 'high' }
        );
        sent += 1;
      } catch (err) {
        // 404/410 = la suscripción ya no existe en el servicio de push
        // (app desinstalada, permiso revocado, navegador limpiado).
        if (err.statusCode === 404 || err.statusCode === 410) {
          expired.push(sub.endpoint);
        } else {
          console.error('Push: fallo al enviar', err.statusCode || '', err.message);
        }
      }
    })
  );

  if (expired.length > 0) {
    try {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
    } catch (err) {
      console.error('Push: no se pudieron limpiar suscripciones vencidas:', err.message);
    }
  }

  return { sent, removed: expired.length };
}

// Destinatarios de un aviso de reserva en línea: todas las administradoras y la
// usuaria vinculada a la manicurista asignada.
async function findBookingRecipients(prisma, manicuristId) {
  try {
    const users = await prisma.user.findMany({
      where: { OR: [{ role: 'ADMIN' }, ...(manicuristId ? [{ manicuristId }] : [])] },
      select: { id: true },
    });
    return users.map((u) => u.id);
  } catch (err) {
    console.error('Push: no se pudieron resolver destinatarios:', err.message);
    return [];
  }
}

module.exports = {
  isConfigured,
  getPublicKey,
  saveSubscription,
  removeSubscription,
  sendToUsers,
  findBookingRecipients,
};
