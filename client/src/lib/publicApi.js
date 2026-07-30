// Cliente HTTP para el portal público de reservas.
//
// Es intencionalmente independiente de lib/api.js: ese cliente adjunta el token
// del staff y, ante un 401, borra el token y redirige a /login. En una página
// pública eso mandaría a una clienta del salón a la pantalla de acceso del
// equipo. Aquí nunca se lee el token ni se redirige, y los mensajes de error
// están escritos para la clienta, no para un desarrollador.

const BASE = '/api/public';

async function publicRequest(method, path, body) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const err = new Error('No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.');
    err.code = 'NETWORK';
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => null)
    : null;

  if (!res.ok) {
    const err = new Error(data?.error || 'No pudimos completar tu solicitud. Intenta de nuevo.');
    err.status = res.status;
    err.code = data?.code || null;
    throw err;
  }

  return data;
}

export const publicApi = {
  getConfig: () => publicRequest('GET', '/config'),
  getCatalog: () => publicRequest('GET', '/catalog'),
  getAvailability: ({ date, serviceIds, manicuristId }) => {
    const params = new URLSearchParams({
      date,
      serviceIds: serviceIds.join(','),
      manicuristId: manicuristId || 'any',
    });
    return publicRequest('GET', `/availability?${params}`);
  },
  book: (payload) => publicRequest('POST', '/appointments', payload),
};
