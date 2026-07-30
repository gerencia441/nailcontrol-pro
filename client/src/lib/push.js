import { api } from './api.js';

// La llave VAPID viaja en base64url y el navegador la exige como Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function isPushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

// Registra este dispositivo para recibir avisos push.
// Devuelve true si quedó suscrito. No lanza: si algo falla, la campanita dentro
// de la app sigue funcionando igual.
export async function subscribeToPush() {
  if (!isPushSupported() || Notification.permission !== 'granted') return false;

  try {
    const { publicKey, enabled } = await api.getPushPublicKey();
    if (!enabled || !publicKey) return false;

    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    // Si ya existe una suscripción con otra llave (por ejemplo tras rotarla),
    // hay que descartarla antes de crear la nueva.
    if (subscription) {
      const current = subscription.options?.applicationServerKey;
      const wanted = urlBase64ToUint8Array(publicKey);
      const sameKey =
        current &&
        new Uint8Array(current).length === wanted.length &&
        new Uint8Array(current).every((b, i) => b === wanted[i]);
      if (!sameKey) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    // Se reenvía siempre, aunque la suscripción ya existiera: el servidor hace
    // upsert y así se recupera el registro si se perdió en la base.
    await api.subscribeToPush(subscription.toJSON());
    return true;
  } catch (err) {
    console.warn('No se pudo activar el push:', err.message);
    return false;
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await api.unsubscribeFromPush(subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('No se pudo desactivar el push:', err.message);
  }
}
