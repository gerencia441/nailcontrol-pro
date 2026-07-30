// Limitador de tasa en memoria, sin dependencias externas.
//
// Limitaciones conocidas y aceptadas: es por instancia y se reinicia en cada
// redespliegue. Es una defensa de "mejor esfuerzo" contra ráfagas accidentales
// o scripts triviales. El control duradero real contra abuso es el tope de
// solicitudes pendientes por teléfono, que vive en la base de datos.

function clientIp(req) {
  // Requiere app.set('trust proxy', ...) para que req.ip sea confiable detrás
  // del proxy de Railway.
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

function createCounter({ windowMs, max }) {
  const hits = new Map();

  // Registra un intento y dice si excede el tope.
  // Devuelve { allowed, retryAfter }.
  return function consume(key) {
    const now = Date.now();

    // Guarda cruda contra crecimiento sin límite si alguien rota claves.
    if (hits.size > 5000) hits.clear();

    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }

    entry.count += 1;

    if (entry.count > max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }

    return { allowed: true, retryAfter: 0 };
  };
}

function createRateLimiter({
  windowMs,
  max,
  keyFn = clientIp,
  message = 'Demasiadas solicitudes. Espera unos minutos e intenta de nuevo.',
  code = 'RATE_LIMITED',
}) {
  const consume = createCounter({ windowMs, max });

  return function rateLimit(req, res, next) {
    const { allowed, retryAfter } = consume(keyFn(req));
    if (!allowed) {
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ error: message, code });
    }
    return next();
  };
}

module.exports = { createRateLimiter, createCounter, clientIp };
