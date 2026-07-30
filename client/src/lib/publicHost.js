// Detección del portal público de reservas.
//
// El mismo despliegue sirve el dominio administrativo y el subdominio de
// reservas (citas.florcatalan.com), así que la distinción se hace en el cliente
// con el hostname.

const BOOKING_HOSTNAMES = ['citas.florcatalan.com'];

export function isBookingHost() {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname.toLowerCase();

  if (BOOKING_HOSTNAMES.includes(host)) return true;

  // Cubre cualquier subdominio "citas.*", incluido citas.localhost:5174, que
  // Chrome resuelve sin tocar el archivo hosts.
  if (host === 'citas.localhost' || host.startsWith('citas.')) return true;

  // Escape para pruebas locales: ?portal
  return new URLSearchParams(window.location.search).has('portal');
}
