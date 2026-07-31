const { Router } = require('express');
const {
  bogotaDateTimeToUtc,
  bogotaDayRangeToUtc,
  bogotaNow,
  bogotaMinutesFromDayStart,
  bogotaWeekday,
  bogotaDaysBetween,
  minutesToHHMM,
} = require('../lib/bogotaTime');
const { normalizeColombianPhone } = require('../lib/phone');
const { sumServiceMinutes, overlaps, CONFLICT_WINDOW_MS } = require('../lib/scheduling');
const { INCLUDE_FULL, mapAppointment } = require('../lib/appointmentShape');
const { getBookingConfig, hitsBreak, longestOpenStretch } = require('../lib/bookingConfig');
const { candidateWhere } = require('../lib/manicuristServices');
const push = require('../lib/push');
const { createRateLimiter, createCounter, clientIp } = require('../lib/rateLimit');
const googleCal = require('../lib/googleCalendar');

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_SERVICES_PER_BOOKING = 10;
const MAX_PENDING_PER_PHONE = 2;

const TIMEZONE = 'America/Bogota';

// El wizard vuelve a consultar disponibilidad cada vez que cambia la fecha o
// los servicios, así que el límite de lectura es holgado.
const readLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

// Tope holgado sobre TODOS los POST (incluidos los que fallan validación), solo
// para frenar un martilleo evidente.
const bookingAttemptLimiter = createRateLimiter({
  windowMs: 60 * 60_000,
  max: 40,
  message: 'Recibimos demasiadas solicitudes desde tu conexión. Espera unos minutos e intenta de nuevo.',
});

// Tope estricto sobre reservas que realmente se intentan escribir. Se consume
// solo después de pasar todas las validaciones, para que a quien se equivoque
// escribiendo su teléfono no se le agote la cuota sin haber reservado nada.
const consumeBookingWrite = createCounter({ windowMs: 60 * 60_000, max: 6 });

function fail(res, status, code, error) {
  return res.status(status).json({ error, code });
}

// "2026-08-26" + "09:00" -> "mié 26 ago, 9:00 am", para el cuerpo del aviso.
function formatBogotaLabel(dateStr, time) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const [hh, mm] = time.split(':').map(Number);
  const period = hh >= 12 ? 'pm' : 'am';
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${day}, ${hour12}:${String(mm).padStart(2, '0')} ${period}`;
}

function parseServiceIds(raw) {
  const list = Array.isArray(raw) ? raw : String(raw || '').split(',');
  return [...new Set(list.map((s) => String(s || '').trim()).filter(Boolean))];
}

// Construye, por manicurista, los intervalos ocupados expresados en minutos
// relativos a las 00:00 Bogotá de `dateStr`.
function buildBusyMap(appointments, dateStr) {
  const map = new Map();
  for (const appt of appointments) {
    const s = bogotaMinutesFromDayStart(dateStr, appt.date);
    const e = s + sumServiceMinutes(appt.services);
    if (!map.has(appt.manicuristId)) map.set(appt.manicuristId, []);
    map.get(appt.manicuristId).push({ s, e });
  }
  return map;
}

// Una sola consulta para toda la ocupación del día. Se ensancha hacia atrás
// (no hacia adelante) porque una cita que empieza después del cierre no puede
// solaparse con un bloque que termina ese mismo día.
async function fetchDayOccupancy(db, dateStr, manicuristIds) {
  const { start, end } = bogotaDayRangeToUtc(dateStr);
  return db.appointment.findMany({
    where: {
      manicuristId: { in: manicuristIds },
      status: { not: 'CANCELLED' },
      date: { gte: new Date(start.getTime() - CONFLICT_WINDOW_MS), lt: end },
    },
    select: {
      manicuristId: true,
      date: true,
      services: { select: { service: { select: { durationMinutes: true } } } },
    },
  });
}

function isFreeAt(busyMap, manicuristId, startMin, endMin) {
  const intervals = busyMap.get(manicuristId) || [];
  return !intervals.some((b) => overlaps(startMin, endMin, b.s, b.e));
}

// Valida la ventana de fechas (día cerrado, pasado, demasiado lejos).
// Devuelve un motivo o null si la fecha es válida.
function dateWindowReason(dateStr, cfg, now) {
  if (dateStr < now.dateStr) return 'PAST';
  const daysAhead = bogotaDaysBetween(now.dateStr, dateStr);
  if (daysAhead === null) return 'PAST';
  if (daysAhead > cfg.maxAdvanceDays) return 'TOO_FAR';
  if (cfg.closedWeekdays.includes(bogotaWeekday(dateStr))) return 'CLOSED_DAY';
  return null;
}

router.get('/config', readLimiter, async (req, res) => {
  try {
    const cfg = await getBookingConfig(req.prisma);
    const now = bogotaNow();
    res.json({
      timezone: TIMEZONE,
      openTime: cfg.openTime,
      closeTime: cfg.closeTime,
      breakStart: cfg.breakStart,
      breakEnd: cfg.breakEnd,
      slotMinutes: cfg.slotMinutes,
      minNoticeMinutes: cfg.minNoticeMinutes,
      maxAdvanceDays: cfg.maxAdvanceDays,
      closedWeekdays: cfg.closedWeekdays,
      // El portal debe calcular los límites del calendario con la fecha del
      // servidor, no con la del dispositivo: un visitante en otra zona horaria
      // calcularía un "hoy" distinto al de Bogotá.
      today: now.dateStr,
      nowMinutes: now.minutes,
    });
  } catch (err) {
    console.error('public/config error', err.message);
    fail(res, 500, 'SERVER_ERROR', 'No pudimos cargar la configuración. Intenta de nuevo.');
  }
});

router.get('/catalog', readLimiter, async (req, res) => {
  try {
    const [services, manicurists] = await Promise.all([
      req.prisma.service.findMany({
        select: { id: true, name: true, basePrice: true, durationMinutes: true },
        orderBy: { name: 'asc' },
      }),
      // Proyección explícita: nunca exponer commissionPercentage ni el
      // teléfono personal de las manicuristas.
      req.prisma.manicurist.findMany({
        select: { id: true, name: true, color: true, services: { select: { serviceId: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    res.json({
      services,
      // `serviceIds` permite al portal ocultar de una vez a quien no presta lo
      // que la clienta eligió. Vacío = presta todos.
      manicurists: manicurists.map((m) => ({
        id: m.id,
        name: m.name,
        color: m.color,
        serviceIds: m.services.map((s) => s.serviceId),
      })),
    });
  } catch (err) {
    console.error('public/catalog error', err.message);
    fail(res, 500, 'SERVER_ERROR', 'No pudimos cargar los servicios. Intenta de nuevo.');
  }
});

router.get('/availability', readLimiter, async (req, res) => {
  try {
    const { date, manicuristId } = req.query;
    const serviceIds = parseServiceIds(req.query.serviceIds);

    if (!DATE_RE.test(String(date || ''))) {
      return fail(res, 400, 'BAD_DATE', 'Fecha inválida.');
    }
    if (serviceIds.length === 0 || serviceIds.length > MAX_SERVICES_PER_BOOKING) {
      return fail(res, 400, 'BAD_SERVICES', 'Selecciona al menos un servicio.');
    }

    const cfg = await getBookingConfig(req.prisma);
    const now = bogotaNow();

    const services = await req.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, durationMinutes: true },
    });
    if (services.length !== serviceIds.length) {
      return fail(res, 400, 'SERVICE_NOT_FOUND', 'Alguno de los servicios ya no está disponible.');
    }
    const totalDurationMinutes = sumServiceMinutes(services);

    // Solo son candidatas las que prestan TODOS los servicios elegidos.
    const wantsAny = !manicuristId || manicuristId === 'any';
    const candidates = await req.prisma.manicurist.findMany({
      where: candidateWhere({ manicuristId, serviceIds }),
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (!wantsAny && candidates.length === 0) {
      return fail(
        res,
        404,
        'MANICURIST_NOT_FOUND',
        'La manicurista seleccionada no presta alguno de los servicios elegidos.'
      );
    }
    const base = {
      date,
      timezone: TIMEZONE,
      totalDurationMinutes,
      slotMinutes: cfg.slotMinutes,
    };

    const windowReason = dateWindowReason(date, cfg, now);
    if (windowReason) {
      return res.json({ ...base, closed: true, reason: windowReason, slots: [] });
    }
    // Nadie presta esa combinación de servicios (o no hay manicuristas dadas de
    // alta). No es un problema del día elegido, así que lleva su propio motivo.
    if (candidates.length === 0) {
      return res.json({ ...base, closed: true, reason: 'NO_PROVIDER', slots: [] });
    }

    const latestStart = cfg.closeMinutes - totalDurationMinutes;
    // Se compara contra el tramo continuo más largo, no contra la jornada
    // completa: con el almuerzo de por medio la jornada ya viene partida.
    if (totalDurationMinutes > longestOpenStretch(cfg)) {
      return res.json({ ...base, closed: true, reason: 'DURATION_TOO_LONG', slots: [] });
    }

    const occupancy = await fetchDayOccupancy(
      req.prisma,
      date,
      candidates.map((c) => c.id)
    );
    const busyMap = buildBusyMap(occupancy, date);

    const earliestStart =
      date === now.dateStr ? now.minutes + cfg.minNoticeMinutes : cfg.openMinutes;

    const slots = [];
    for (let m = cfg.openMinutes; m <= latestStart; m += cfg.slotMinutes) {
      const end = m + totalDurationMinutes;
      const available =
        m >= earliestStart &&
        // No solo se descarta el bloque que empieza en el almuerzo: también el
        // que empieza antes y terminaría dentro de él.
        !hitsBreak(cfg, m, end) &&
        candidates.some((c) => isFreeAt(busyMap, c.id, m, end));
      slots.push({ time: minutesToHHMM(m), endTime: minutesToHHMM(end), available });
    }

    res.json({ ...base, closed: false, reason: null, slots });
  } catch (err) {
    console.error('public/availability error', err.message);
    fail(res, 500, 'SERVER_ERROR', 'No pudimos calcular los horarios. Intenta de nuevo.');
  }
});

router.post('/appointments', bookingAttemptLimiter, async (req, res) => {
  try {
    const { manicuristId, date, time, clientName, phone, website } = req.body || {};

    // Honeypot: campo oculto que un humano nunca llena. Se responde con un
    // éxito falso para no darle señal al bot.
    if (website) {
      return res.status(201).json({ ok: true, message: 'Recibimos tu solicitud.' });
    }

    const name = String(clientName || '').trim();
    if (name.length < 2 || name.length > 80) {
      return fail(res, 400, 'BAD_NAME', 'Ingresa tu nombre completo.');
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizeColombianPhone(phone);
    } catch (e) {
      return fail(res, 400, 'BAD_PHONE', e.message);
    }
    if (!normalizedPhone) {
      return fail(res, 400, 'BAD_PHONE', 'El teléfono es obligatorio.');
    }

    const serviceIds = parseServiceIds(req.body?.serviceIds);
    if (serviceIds.length === 0 || serviceIds.length > MAX_SERVICES_PER_BOOKING) {
      return fail(res, 400, 'BAD_SERVICES', 'Selecciona al menos un servicio.');
    }

    if (!DATE_RE.test(String(date || ''))) {
      return fail(res, 400, 'BAD_DATE', 'Fecha inválida.');
    }
    if (!TIME_RE.test(String(time || ''))) {
      return fail(res, 400, 'BAD_TIME', 'Hora inválida.');
    }

    const cfg = await getBookingConfig(req.prisma);
    const now = bogotaNow();

    const services = await req.prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, basePrice: true, durationMinutes: true },
    });
    if (services.length !== serviceIds.length) {
      return fail(res, 400, 'SERVICE_NOT_FOUND', 'Alguno de los servicios ya no está disponible.');
    }
    const totalDurationMinutes = sumServiceMinutes(services);

    // Toda la validación se repite en el servidor: el cliente no es confiable
    // para horarios, anticipación, alineación de bloques ni conflictos.
    const windowReason = dateWindowReason(date, cfg, now);
    if (windowReason === 'CLOSED_DAY') {
      return fail(res, 400, 'CLOSED_DAY', 'Ese día no atendemos. Elige otra fecha.');
    }
    if (windowReason === 'PAST') {
      return fail(res, 400, 'PAST', 'Esa fecha ya pasó.');
    }
    if (windowReason === 'TOO_FAR') {
      return fail(res, 400, 'TOO_FAR', `Solo puedes reservar hasta ${cfg.maxAdvanceDays} días adelante.`);
    }

    const [hh, mm] = String(time).split(':').map(Number);
    const startMin = hh * 60 + mm;
    const endMin = startMin + totalDurationMinutes;

    if (startMin < cfg.openMinutes || (startMin - cfg.openMinutes) % cfg.slotMinutes !== 0) {
      return fail(res, 400, 'OFF_GRID', 'Ese horario no es válido. Elige uno de los bloques disponibles.');
    }
    if (endMin > cfg.closeMinutes) {
      return fail(res, 400, 'AFTER_HOURS', 'Los servicios seleccionados no alcanzan a terminar antes del cierre.');
    }
    if (hitsBreak(cfg, startMin, endMin)) {
      return fail(
        res,
        400,
        'BREAK_TIME',
        `Ese horario coincide con nuestra hora de almuerzo (${cfg.breakStart} a ${cfg.breakEnd}). Elige otro bloque.`
      );
    }
    if (date === now.dateStr && startMin < now.minutes + cfg.minNoticeMinutes) {
      return fail(res, 400, 'TOO_SOON', 'Necesitamos algo más de anticipación. Elige un horario más adelante.');
    }

    // Se revalida en el servidor que la manicurista preste TODOS los servicios
    // pedidos: el portal ya filtra, pero el cliente no es confiable.
    const wantsAny = !manicuristId || manicuristId === 'any';
    const candidates = await req.prisma.manicurist.findMany({
      where: candidateWhere({ manicuristId, serviceIds }),
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
    if (candidates.length === 0) {
      return fail(
        res,
        wantsAny ? 400 : 404,
        'MANICURIST_NOT_FOUND',
        wantsAny
          ? 'Por ahora no tenemos quien preste esa combinación de servicios. Elige otros servicios.'
          : 'La manicurista seleccionada no presta alguno de los servicios elegidos.'
      );
    }

    // Control duradero de abuso: evita que una misma persona acumule
    // solicitudes sin confirmar que bloquean la agenda (las citas PENDING
    // ocupan el horario para el cálculo de conflictos).
    const pending = await req.prisma.appointment.count({
      where: { client: { phone: normalizedPhone }, status: 'PENDING', date: { gte: new Date() } },
    });
    if (pending >= MAX_PENDING_PER_PHONE) {
      return fail(
        res,
        409,
        'TOO_MANY_PENDING',
        'Ya tienes solicitudes pendientes por confirmar. Te contactaremos pronto.'
      );
    }

    // Se consume la cuota de escritura recién aquí: ya pasó toda la validación,
    // así que este sí es un intento real de reservar.
    const quota = consumeBookingWrite(clientIp(req));
    if (!quota.allowed) {
      res.set('Retry-After', String(quota.retryAfter));
      return fail(
        res,
        429,
        'RATE_LIMITED',
        'Recibimos varias reservas desde tu conexión. Espera unos minutos e intenta de nuevo.'
      );
    }

    const startUtc = bogotaDateTimeToUtc(`${date}T${time}`);

    let chosen = null;

    const candidateIds = candidates.map((c) => c.id);

    const created = await req.prisma.$transaction(
      async (tx) => {
        // Serializa las reservas concurrentes bloqueando las filas de las
        // manicuristas candidatas.
        //
        // Sin esto hay una condición de carrera real (verificada: dos POST
        // simultáneos al mismo bloque creaban ambas citas con la misma
        // manicurista). MySQL usa REPEATABLE READ, así que cada transacción ve
        // un snapshot donde el bloque sigue libre.
        //
        // Esta lectura con FOR UPDATE toma un lock exclusivo de esas filas: una
        // segunda reserva sobre la misma manicurista espera hasta que la
        // primera haga commit, mientras que reservas de manicuristas distintas
        // no se estorban. Además, al ser una lectura bloqueante, el snapshot de
        // las consultas siguientes se establece DESPUÉS de obtener el lock, por
        // lo que sí ve la cita recién confirmada. El lock se libera solo en el
        // commit/rollback: no queda ventana entre verificar y crear.
        //
        // ORDER BY id fija un orden de adquisición común para evitar interbloqueos
        // cuando dos transacciones bloquean conjuntos que se solapan.
        const placeholders = candidateIds.map(() => '?').join(',');
        await tx.$queryRawUnsafe(
          `SELECT \`id\` FROM \`Manicurist\` WHERE \`id\` IN (${placeholders}) ORDER BY \`id\` FOR UPDATE`,
          ...candidateIds
        );

        const occupancy = await fetchDayOccupancy(
          tx,
          date,
          candidateIds
        );
        const busyMap = buildBusyMap(occupancy, date);

        const free = candidates.filter((c) => isFreeAt(busyMap, c.id, startMin, endMin));
        if (free.length === 0) {
          const err = new Error('Ese horario ya fue reservado hace un momento. Elige otro, por favor.');
          err.httpStatus = 409;
          err.httpCode = 'SLOT_TAKEN';
          throw err;
        }

        // "Cualquiera disponible": entre las libres en ese bloque, la que tenga
        // menos citas ese día. Empate → orden alfabético (determinista).
        const sameDayCount = (id) =>
          (busyMap.get(id) || []).filter((b) => b.s >= 0 && b.s < 1440).length;
        chosen = free.reduce((best, c) => {
          const d = sameDayCount(c.id) - sameDayCount(best.id);
          if (d < 0) return c;
          if (d > 0) return best;
          return c.name.localeCompare(best.name) < 0 ? c : best;
        }, free[0]);

        // Buscar-o-crear por teléfono. Si la clienta ya existe NO se actualiza
        // ningún dato suyo: quien conozca un número no debe poder renombrar una
        // ficha existente.
        let client = await tx.client.findUnique({ where: { phone: normalizedPhone } });
        if (!client) {
          // `tags` es LongText NOT NULL: '[]' es obligatorio.
          client = await tx.client.create({
            data: { name, phone: normalizedPhone, tags: '[]' },
          });
        }

        return tx.appointment.create({
          data: {
            clientId: client.id,
            manicuristId: chosen.id,
            date: startUtc,
            status: 'PENDING',
            confirmed: false,
            // Marca el origen para que el panel la señale como reservada por la
            // clienta y aún por confirmar.
            source: 'PUBLIC',
            services: { create: serviceIds.map((id) => ({ service: { connect: { id } } })) },
          },
          include: INCLUDE_FULL,
        });
      },
      { timeout: 15000, maxWait: 10000 }
    );

    // La sincronización con Calendar va FUERA de la transacción (una llamada de
    // red nunca debe mantener una transacción abierta) y nunca falla la reserva.
    try {
      const eventId = await googleCal.createEvent(req.prisma, null, mapAppointment(created));
      if (eventId) {
        await req.prisma.appointment.update({
          where: { id: created.id },
          data: { googleEventId: eventId },
        });
      }
    } catch (e) {
      console.error('Public booking Google sync error', e.message);
    }

    // Aviso push al equipo. También fuera de la transacción y sin bloquear la
    // respuesta: si el push falla, la reserva ya quedó guardada y la campanita
    // dentro de la app la mostrará igual.
    try {
      const recipients = await push.findBookingRecipients(req.prisma, chosen.id);
      const serviceNames = services.map((s) => s.name.trim()).join(' + ');
      await push.sendToUsers(req.prisma, recipients, {
        title: 'Nueva reserva en línea',
        body: `${name} · ${formatBogotaLabel(date, time)}\n${serviceNames} · con ${chosen.name.trim()}`,
        url: `/appointments?date=${date}`,
        tag: `online-booking-${created.id}`,
      });
    } catch (e) {
      console.error('Public booking push error', e.message);
    }

    // DTO propio: nunca devolver mapAppointment() tal cual, que incluye
    // commissionPercentage, el teléfono de la manicurista y las notas técnicas.
    // El nombre se devuelve tal como lo escribió quien reserva, no el guardado.
    res.status(201).json({
      id: created.id,
      date,
      time,
      endTime: minutesToHHMM(endMin),
      status: created.status,
      confirmed: created.confirmed,
      manicurist: { id: chosen.id, name: chosen.name, color: chosen.color },
      services: services.map((s) => ({
        id: s.id,
        name: s.name,
        basePrice: s.basePrice,
        durationMinutes: s.durationMinutes,
      })),
      totalDurationMinutes,
      estimatedTotal: services.reduce((sum, s) => sum + (s.basePrice || 0), 0),
      client: { name, phone: normalizedPhone },
      message: 'Recibimos tu solicitud. Te contactaremos para confirmar.',
    });
  } catch (err) {
    if (err.httpStatus) {
      return fail(res, err.httpStatus, err.httpCode, err.message);
    }
    // Contención de bloqueos / transacción abortada: no es un fallo del
    // servidor sino que alguien más tomó el mismo horario en ese instante.
    // Se responde como conflicto para que el portal ofrezca reintentar.
    const transient =
      err.code === 'P2034' || // write conflict / deadlock detectado por Prisma
      err.code === 'P2028' || // transacción expirada
      /deadlock|lock wait timeout/i.test(err.message || '');
    if (transient) {
      console.warn('public/appointments contención de bloqueo:', err.code || err.message);
      return fail(
        res,
        409,
        'SLOT_TAKEN',
        'Ese horario ya fue reservado hace un momento. Elige otro, por favor.'
      );
    }
    console.error('public/appointments error', err.message, 'ip=', clientIp(req));
    fail(res, 500, 'SERVER_ERROR', 'No pudimos completar tu reserva. Intenta de nuevo.');
  }
});

module.exports = router;
