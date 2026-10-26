import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { subscribeToPush, isPushSupported } from './push.js';

const POLL_MS = 60_000;
const SEEN_KEY = 'onlineBookingsSeen';

// IDs por los que ya se avisó EN ESTE dispositivo. El contador de la campanita
// no depende de esto: se deriva del estado real (reservas en línea sin
// confirmar), así que se limpia solo cuando el equipo las confirma. Esta lista
// existe únicamente para no repetir la notificación del sistema.
function readSeen() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeSeen(ids) {
  try {
    // Se conservan solo los últimos para que no crezca sin control.
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* almacenamiento lleno o bloqueado: no es crítico */
  }
}

function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// En Chrome para Android (y en casi todos los navegadores móviles) el
// constructor `new Notification()` lanza "Illegal constructor": es una
// limitación de la plataforma, no un error del navegador. Ahí la notificación
// debe mostrarse desde el service worker. En escritorio el constructor sí sirve
// y se usa como respaldo.
//
// Nunca lanza: mostrar un aviso no debe romper el sondeo.
async function showSystemNotification(title, options) {
  if (!canNotify() || Notification.permission !== 'granted') return;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, options);
      return;
    }
  } catch {
    /* sigue al respaldo */
  }

  try {
    new Notification(title, options);
  } catch {
    /* navegador sin soporte: la campanita dentro de la app ya avisó */
  }
}

function formatWhen(dateStr) {
  return new Date(dateStr).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function useOnlineBookings() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [permission, setPermission] = useState(canNotify() ? Notification.permission : 'unsupported');

  const seenRef = useRef(readSeen());
  const firstLoadRef = useRef(true);

  const notify = useCallback((items) => {
    // Con varias a la vez se manda un solo aviso agrupado, no uno por cita.
    if (items.length === 1) {
      const appt = items[0];
      const services = (appt.services || []).map((s) => s.name.trim()).join(' + ');
      showSystemNotification('Nueva reserva en línea', {
        body: `${appt.client?.name?.trim() || 'Una clienta'} · ${formatWhen(appt.date)}${services ? `\n${services}` : ''}`,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: `online-booking-${appt.id}`,
      });
    } else {
      showSystemNotification(`${items.length} nuevas reservas en línea`, {
        body: 'Entra a Citas para revisarlas y confirmarlas.',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: 'online-bookings-multi',
      });
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api.getOnlinePendingAppointments();
      const list = data?.appointments || [];
      setAppointments(list);

      const unseen = list.filter((a) => !seenRef.current.includes(a.id));
      const isFirstLoad = firstLoadRef.current;

      // Se marca como visto ANTES de intentar notificar. Si mostrar el aviso
      // falla, no debe quedar reintentando (y fallando) en cada ciclo.
      if (unseen.length > 0) {
        seenRef.current = [...seenRef.current, ...unseen.map((a) => a.id)];
        writeSeen(seenRef.current);
      }
      firstLoadRef.current = false;

      // En la primera carga de la sesión no se notifica lo que ya estaba
      // pendiente de antes: solo se marca como visto para avisar de lo que
      // llegue de aquí en adelante.
      if (!isFirstLoad && unseen.length > 0) {
        notify(unseen);
      }
    } catch {
      // Silencioso: un fallo de red no debe interrumpir el trabajo en el panel.
      // El cliente api ya maneja el 401 global.
    }
  }, [notify]);

  useEffect(() => {
    if (!user) return undefined;

    load();
    const id = setInterval(load, POLL_MS);

    // Al volver a la pestaña se refresca de inmediato en lugar de esperar el
    // siguiente ciclo.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, load]);

  // Si el permiso ya estaba concedido, se (re)registra el dispositivo para push
  // en cada arranque de sesión: así se recupera la suscripción tras reinstalar
  // la app, limpiar el navegador o rotar las llaves VAPID.
  useEffect(() => {
    if (!user || !isPushSupported() || Notification.permission !== 'granted') return;
    subscribeToPush();
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!canNotify()) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    // Conceder el permiso no suscribe por sí solo: hay que registrar el
    // dispositivo en el servidor para que pueda recibir el push.
    if (result === 'granted') await subscribeToPush();
    return result;
  }, []);

  return {
    appointments,
    count: appointments.length,
    permission,
    requestPermission,
    pushSupported: isPushSupported(),
    refresh: load,
  };
}
