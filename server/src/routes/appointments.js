const { Router } = require('express');
const { bogotaDateTimeToUtc, bogotaDayRangeToUtc } = require('../lib/bogotaTime');
const { normalizeColombianPhone } = require('../lib/phone');
const { findSchedulingConflict } = require('../lib/scheduling');
const { INCLUDE_FULL, mapAppointment, appointmentForViewer } = require('../lib/appointmentShape');
const { PROVIDER_SELECT, providesAll } = require('../lib/manicuristServices');
const { allocatePaid, singleCategory } = require('../lib/serviceCategories');
const { parsePayments, appointmentMethodOf, partsOf, balanceWarning, AMOUNT_EPSILON } = require('../lib/payments');
const { commissionTotals } = require('../lib/commissions');
const googleCal = require('../lib/googleCalendar');
const router = Router();

// Devuelve un mensaje de error si la especialista no presta todos los servicios
// pedidos, o null si la combinación es válida. La UI ya filtra el desplegable;
// esto cierra la puerta a peticiones directas y a datos que cambiaron entre
// medias (p. ej. se le quitó un servicio después de abrir el formulario).
async function serviceMismatchError(prisma, manicuristId, serviceIds) {
  if (!manicuristId || !serviceIds || serviceIds.length === 0) return null;
  const [manicurist, services] = await Promise.all([
    prisma.manicurist.findUnique({
      where: { id: manicuristId },
      select: { name: true, ...PROVIDER_SELECT },
    }),
    prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, category: true },
    }),
  ]);
  if (!manicurist) return 'La especialista seleccionada no existe.';
  if (providesAll(manicurist, services)) return null;
  return `${manicurist.name} no presta alguno de los servicios seleccionados.`;
}

router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const where = {};

    if (date) {
      const { start, end } = bogotaDayRangeToUtc(date);
      where.date = { gte: start, lt: end };
    }

    if (status) {
      where.status = status;
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { date: 'asc' },
    });
    res.json(appointments.map((a) => appointmentForViewer(mapAppointment(a), req.user)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reservas hechas por las clientas desde el portal público que siguen sin
// confirmar. Alimenta la campanita de avisos del panel.
//
// Debe declararse antes de cualquier ruta con parámetro para que no la capture.
router.get('/online-pending', async (req, res) => {
  try {
    const where = {
      source: 'PUBLIC',
      status: 'PENDING',
      confirmed: false,
      // Solo lo que aún está por venir: una reserva vieja sin confirmar ya no
      // requiere acción.
      date: { gte: new Date() },
    };

    // Las administradoras ven todas; una manicurista solo las suyas.
    if (req.user.role !== 'ADMIN') {
      if (!req.user.manicuristId) {
        return res.json({ count: 0, appointments: [] });
      }
      where.manicuristId = req.user.manicuristId;
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { date: 'asc' },
    });

    res.json({
      count: appointments.length,
      appointments: appointments.map((a) => appointmentForViewer(mapAppointment(a), req.user)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { clientId, newClient, manicuristId, serviceId, serviceIds, date } = req.body;
    const resolvedServiceIds = [
      ...new Set(Array.isArray(serviceIds) ? serviceIds.filter(Boolean) : [serviceId].filter(Boolean)),
    ];

    if (resolvedServiceIds.length === 0) {
      return res.status(400).json({ error: 'At least one service is required' });
    }

    const mismatch = await serviceMismatchError(req.prisma, manicuristId, resolvedServiceIds);
    if (mismatch) {
      return res.status(400).json({ error: mismatch });
    }

    const services = await req.prisma.service.findMany({
      where: { id: { in: resolvedServiceIds } },
      select: { durationMinutes: true },
    });
    const totalDurationMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 60), 0) || 60;
    const start = bogotaDateTimeToUtc(date);
    const end = new Date(start.getTime() + totalDurationMinutes * 60000);

    const conflict = await findSchedulingConflict(req.prisma, { manicuristId, start, end });
    if (conflict) {
      return res.status(400).json({
        error: 'No se puede agendar: la especialista ya tiene una cita programada en ese horario.',
      });
    }

    let resolvedClientId = clientId;

    if (newClient) {
      if (!newClient.phone || !String(newClient.phone).trim()) {
        return res.status(400).json({ error: 'El teléfono es obligatorio.' });
      }

      let normalizedPhone;
      try {
        normalizedPhone = normalizeColombianPhone(newClient.phone);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      const created = await req.prisma.client.create({
        data: {
          name: newClient.name,
          phone: normalizedPhone,
          tags: '[]',
        },
      });
      resolvedClientId = created.id;
    }

    const appointment = await req.prisma.appointment.create({
      data: {
        clientId: resolvedClientId,
        manicuristId,
        date: bogotaDateTimeToUtc(date),
        services: {
          create: resolvedServiceIds.map((id) => ({
            service: { connect: { id } },
          })),
        },
      },
      include: INCLUDE_FULL,
    });
    // Try to create calendar event if user connected
    try {
      const mapped = mapAppointment(appointment);
      const eventId = await googleCal.createEvent(req.prisma, req.user.id, mapped);
      if (eventId) {
        const updated = await req.prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId: eventId },
          include: INCLUDE_FULL,
        });
        return res.status(201).json(appointmentForViewer(mapAppointment(updated), req.user));
      }
    } catch (e) {
      console.error('Google sync create error', e.message);
    }

    res.status(201).json(appointmentForViewer(mapAppointment(appointment), req.user));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de teléfono.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Error con código HTTP para cortar una transacción con un 4xx.
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

router.patch('/:id/complete', async (req, res) => {
  try {
    const { finalPricePaid } = req.body;

    const result = await req.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
          manicurist: true,
          services: { include: { service: true } },
        },
      });

      if (!appt) throw new HttpError(404, 'Appointment not found');
      // Completarla de nuevo duplicaría el ingreso. Para corregir la forma de
      // pago está PATCH /:id/payment.
      if (appt.status === 'COMPLETED') throw new HttpError(400, 'Esta cita ya está completada.');

      const services = appt.services.map((item) => item.service);
      const serviceTotal = services.reduce((sum, service) => sum + service.basePrice, 0);
      const paid =
        finalPricePaid === undefined || finalPricePaid === ''
          ? serviceTotal
          : parseFloat(finalPricePaid);
      const serviceNames = services.map((service) => service.name).join(' + ');

      // Una o varias formas de pago (pago dividido): un ingreso por cada una.
      const payment = parsePayments(req.body, paid);
      if (payment.error) throw new HttpError(400, payment.error);

      // Congela categoría y parte del cobro de cada servicio para el reporte
      // por categoría (ver AppointmentService en schema.prisma).
      const amounts = allocatePaid(services, paid);
      await Promise.all(
        appt.services.map((item, i) =>
          tx.appointmentService.update({
            where: {
              appointmentId_serviceId: { appointmentId: item.appointmentId, serviceId: item.serviceId },
            },
            data: { category: item.service.category, amount: amounts[i] },
          })
        )
      );

      const finances = [];
      for (const part of payment.parts) {
        finances.push(await tx.finance.create({
          data: {
            type: 'INCOME',
            amount: part.amount,
            description: `${serviceNames} - ${appt.client.name}`,
            // El ingreso se fecha con la fecha de la cita (no el momento de
            // marcar "completada") para que el cierre del día lo agrupe en el
            // mismo día que la cita y el total general coincida con la suma de
            // los servicios del día.
            date: appt.date,
            paymentMethod: part.method,
            manicuristColor: appt.manicurist?.color || null,
            manicuristId: appt.manicurist?.id || null,
            // Guardar el % de comisión vigente para que cambios futuros no
            // alteren el cálculo de comisiones históricas.
            commissionPercentage: appt.manicurist?.commissionPercentage ?? null,
            serviceCategory: singleCategory(services),
            appointmentId: appt.id,
          },
        }));
      }

      const updated = await tx.appointment.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          finalPricePaid: paid,
          paymentMethod: appointmentMethodOf(payment.parts),
          // Se congela junto al precio: a partir de aquí los cierres de esta
          // cita ya no dependen del % que tenga la ficha en el futuro.
          commissionPercentage: appt.manicurist?.commissionPercentage ?? null,
        },
        include: INCLUDE_FULL,
      });

      return { appointment: mapAppointment(updated), finance: finances[0], finances };
    });

    // After completing the appointment, synchronize calendar event
    try {
      const apptFull = await req.prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: INCLUDE_FULL,
      });
      if (apptFull) {
        const mapped = mapAppointment(apptFull);
        if (apptFull.googleEventId) {
          await googleCal.updateEvent(req.prisma, req.user.id, mapped);
        } else {
          const eventId = await googleCal.createEvent(req.prisma, req.user.id, mapped);
          if (eventId) {
            await req.prisma.appointment.update({
              where: { id: apptFull.id },
              data: { googleEventId: eventId },
            });
          }
        }
      }
    } catch (e) {
      console.error('Google sync complete error', e.message);
    }

    res.json({ ...result, appointment: appointmentForViewer(result.appointment, req.user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Correcciones de citas completadas ───────────────────────────────────────
// Una cita completada tiene uno o varios ingresos enlazados (uno por forma de
// pago, Finance.appointmentId). Corregirla = borrar esos ingresos y recrearlos
// con lo nuevo, dentro de una transacción, dejando constancia en
// AppointmentPaymentLog. Comisiones pendientes, cierres, saldos y balance por
// categoría suman esos registros, así que se recalculan solos.

const COMPLETED_INCLUDE = {
  manicurist: true,
  services: { include: { service: true } },
  finances: { where: { type: 'INCOME' }, orderBy: { createdAt: 'asc' } },
};

// Sin ingreso enlazado (citas antiguas que la migración no pudo enlazar con
// seguridad) no se sabe qué registro corregir.
function unlinkedIncomeError(appt) {
  const total = Number(appt.finalPricePaid) || 0;
  const linkedTotal = appt.finances.reduce((sum, f) => sum + f.amount, 0);
  if (appt.finances.length === 0 || Math.abs(linkedTotal - total) > AMOUNT_EPSILON) {
    return 'No se encontró el ingreso de esta cita en Finanzas (cita antigua). Corrígelo desde Finanzas.';
  }
  return null;
}

// Lo que se guarda en el historial antes y después de cada cambio.
function snapshotOf(amount, manicurist, parts) {
  return { amount, manicuristId: manicurist?.id || null, manicuristName: manicurist?.name || null, payments: parts };
}

function samePayments(a, b) {
  return a.length === b.length &&
    b.every((p) => a.some((q) => q.method === p.method && Math.abs(q.amount - p.amount) < AMOUNT_EPSILON));
}

async function authorNameOf(prisma, user) {
  const name = user.manicuristId
    ? (await prisma.manicurist.findUnique({ where: { id: user.manicuristId }, select: { name: true } }))?.name
    : null;
  return (name || user.username || 'Usuario').trim();
}

// Reparto del nuevo total entre los servicios de la cita para el balance por
// categoría. Si ya estaba congelado se escala en proporción (respeta el reparto
// original aunque luego cambien los precios base); si no, se reparte por
// precio base como al completar.
function rescaledShares(appt, total) {
  const items = appt.services;
  const oldTotal = Number(appt.finalPricePaid) || 0;
  const frozen = items.length > 0 && items.every((s) => s.amount != null && s.category);
  if (frozen && oldTotal > 0) {
    return items.map((s) => ({ category: s.category, amount: s.amount * (total / oldTotal) }));
  }
  const amounts = allocatePaid(items.map((s) => s.service), total);
  return items.map((s, i) => ({ category: s.category || s.service.category, amount: amounts[i] }));
}

// Reescribe ingresos, cita e historial. `manicurist` es la especialista final
// (la misma u otra); al cambiarla, la cita y sus ingresos toman su % actual.
async function rewriteCompleted(prisma, { appt, total, manicurist, parts, reason, user }) {
  const manicuristChanged = manicurist.id !== appt.manicuristId;
  const totalChanged = Math.abs(total - (Number(appt.finalPricePaid) || 0)) >= AMOUNT_EPSILON;
  const base = appt.finances[0];
  const commissionPercentage = manicuristChanged ? manicurist.commissionPercentage : base.commissionPercentage;
  const previous = snapshotOf(Number(appt.finalPricePaid) || 0, appt.manicurist, partsOf(appt.finances));
  const next = snapshotOf(total, manicurist, parts);
  const changedByName = await authorNameOf(prisma, user);
  const shares = totalChanged ? rescaledShares(appt, total) : null;

  await prisma.$transaction([
    prisma.finance.deleteMany({ where: { id: { in: appt.finances.map((f) => f.id) } } }),
    // Se conservan descripción, fecha y categoría del ingreso original.
    ...parts.map((part) =>
      prisma.finance.create({
        data: {
          type: 'INCOME',
          amount: part.amount,
          description: base.description,
          date: base.date,
          paymentMethod: part.method,
          manicuristColor: manicuristChanged ? manicurist.color || null : base.manicuristColor,
          manicuristId: manicuristChanged ? manicurist.id : base.manicuristId,
          commissionPercentage,
          serviceCategory: base.serviceCategory,
          appointmentId: appt.id,
        },
      })
    ),
    ...(shares
      ? appt.services.map((item, i) =>
          prisma.appointmentService.update({
            where: { appointmentId_serviceId: { appointmentId: item.appointmentId, serviceId: item.serviceId } },
            data: shares[i],
          })
        )
      : []),
    prisma.appointment.update({
      where: { id: appt.id },
      data: {
        paymentMethod: appointmentMethodOf(parts),
        ...(totalChanged && { finalPricePaid: total }),
        ...(manicuristChanged && { manicuristId: manicurist.id, commissionPercentage }),
      },
    }),
    prisma.appointmentPaymentLog.create({
      data: {
        appointmentId: appt.id,
        changedByUserId: user.id || null,
        changedByName,
        previous: JSON.stringify(previous),
        next: JSON.stringify(next),
        reason: reason || null,
      },
    }),
  ]);

  return { previous, next };
}

const formatPesos = (v) => `$${Math.round(Math.abs(v)).toLocaleString('es-CO')}`;

// Especialistas que, tras la corrección, quedan habiendo cobrado más comisión
// de la que ganaron (ya se le pagó la de esta cita y ahora se le quitó).
async function overpaidCommissionWarnings(prisma, manicurists) {
  if (manicurists.length === 0) return [];
  const totals = await commissionTotals(prisma, manicurists);
  return manicurists
    .filter((m) => totals[m.id].pending < -AMOUNT_EPSILON)
    .map((m) =>
      `A ${m.name} ya se le había pagado esta comisión: su saldo de comisiones queda en −${formatPesos(totals[m.id].pending)}, ` +
      'que se descuenta de su próximo pago.'
    );
}

async function loadCompletedOrFail(prisma, id) {
  const appt = await prisma.appointment.findUnique({ where: { id }, include: COMPLETED_INCLUDE });
  if (!appt) throw new HttpError(404, 'Appointment not found');
  if (appt.status !== 'COMPLETED') throw new HttpError(400, 'Solo se pueden corregir citas completadas.');
  const unlinked = unlinkedIncomeError(appt);
  if (unlinked) throw new HttpError(409, unlinked);
  return appt;
}

async function respondCorrected(req, res, apptId, warnings) {
  const updated = await req.prisma.appointment.findUnique({ where: { id: apptId }, include: INCLUDE_FULL });
  const list = warnings.filter(Boolean);
  res.json({
    appointment: appointmentForViewer(mapAppointment(updated), req.user),
    warning: list.length ? list.join('\n\n') : null,
  });
}

// Corrige la forma de pago de una cita ya completada (p. ej. se cerró como
// Bancolombia pero la transferencia falló y pagó en efectivo), o la divide en
// varias. El monto total no cambia. Pueden hacerlo la administradora y la
// especialista que atendió la cita.
router.patch('/:id/payment', async (req, res) => {
  try {
    const appt = await req.prisma.appointment.findUnique({ where: { id: req.params.id }, select: { manicuristId: true } });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });
    const isAdmin = req.user.role === 'ADMIN';
    const isOwn = Boolean(req.user.manicuristId) && req.user.manicuristId === appt.manicuristId;
    if (!isAdmin && !isOwn) {
      return res.status(403).json({ error: 'Solo la administradora o la especialista de la cita pueden cambiar la forma de pago.' });
    }

    const full = await loadCompletedOrFail(req.prisma, req.params.id);
    const total = Number(full.finalPricePaid) || 0;
    const payment = parsePayments(req.body, total);
    if (payment.error) return res.status(400).json({ error: payment.error });
    if (samePayments(partsOf(full.finances), payment.parts)) {
      return res.status(400).json({ error: 'La forma de pago no cambió.' });
    }

    const { previous, next } = await rewriteCompleted(req.prisma, {
      appt: full, total, manicurist: full.manicurist, parts: payment.parts, reason: null, user: req.user,
    });
    await respondCorrected(req, res, full.id, [
      isAdmin ? await balanceWarning(req.prisma, full.date, previous.payments, next.payments) : null,
    ]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Corrección completa de una cita cerrada: monto cobrado, especialista que la
// atendió y forma de pago. Solo la administradora. Cambiar monto o especialista
// exige un motivo. Al cambiar de especialista la comisión pasa a la nueva con
// su % actual; si la anterior ya la había cobrado, queda con saldo negativo.
router.patch('/:id/correct', async (req, res) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo la administradora puede corregir una cita.' });
  }
  try {
    const appt = await loadCompletedOrFail(req.prisma, req.params.id);
    const oldTotal = Number(appt.finalPricePaid) || 0;

    const rawTotal = req.body.finalPricePaid;
    const total = rawTotal === undefined || rawTotal === '' ? oldTotal : Number(rawTotal);
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ error: 'El monto cobrado debe ser mayor que 0.' });
    }
    const totalChanged = Math.abs(total - oldTotal) >= AMOUNT_EPSILON;

    let manicurist = appt.manicurist;
    if (req.body.manicuristId && req.body.manicuristId !== appt.manicuristId) {
      const mismatch = await serviceMismatchError(req.prisma, req.body.manicuristId, appt.services.map((s) => s.serviceId));
      if (mismatch) return res.status(400).json({ error: mismatch });
      manicurist = await req.prisma.manicurist.findUnique({ where: { id: req.body.manicuristId } });
    }
    const manicuristChanged = manicurist.id !== appt.manicuristId;

    // Sin `payments` solo se admite si el pago era de una sola forma: el nuevo
    // total va completo a esa forma. Con pago dividido hay que repartirlo.
    const previousParts = partsOf(appt.finances);
    let paymentsBody = req.body;
    if (!Array.isArray(req.body.payments)) {
      if (previousParts.length > 1 && totalChanged) {
        return res.status(400).json({ error: 'El pago estaba dividido: indica cómo queda repartido el nuevo monto.' });
      }
      paymentsBody = {
        payments: previousParts.length === 1 ? [{ method: previousParts[0].method, amount: total }] : previousParts,
      };
    }
    const payment = parsePayments(paymentsBody, total);
    if (payment.error) return res.status(400).json({ error: payment.error });

    const paymentsChanged = !samePayments(previousParts, payment.parts);
    if (!totalChanged && !manicuristChanged && !paymentsChanged) {
      return res.status(400).json({ error: 'No hay cambios que guardar.' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if ((totalChanged || manicuristChanged) && !reason) {
      return res.status(400).json({ error: 'Indica el motivo de la corrección.' });
    }

    const { previous, next } = await rewriteCompleted(req.prisma, {
      appt, total, manicurist, parts: payment.parts, reason, user: req.user,
    });

    // El evento de Calendar muestra la especialista.
    if (manicuristChanged && appt.googleEventId) {
      try {
        const full = await req.prisma.appointment.findUnique({ where: { id: appt.id }, include: INCLUDE_FULL });
        await googleCal.updateEvent(req.prisma, req.user.id, mapAppointment(full));
      } catch (e) {
        console.error('Google sync correct error', e.message);
      }
    }

    // Quien pierde comisión con el cambio: la especialista anterior, o la misma
    // si bajó el monto.
    const losers = manicuristChanged ? [appt.manicurist] : total < oldTotal ? [manicurist] : [];
    await respondCorrected(req, res, appt.id, [
      await balanceWarning(req.prisma, appt.date, previous.payments, next.payments),
      ...(await overpaidCommissionWarnings(req.prisma, losers)),
    ]);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, date, manicuristId, serviceIds, confirmed } = req.body;

    // Completar una cita tiene que pasar por PATCH /:id/complete, que además crea
    // el ingreso y congela el % de comisión. Permitirlo aquí dejaba la cita como
    // COMPLETED sin registro de ingreso: así ocurrió con las dos citas del
    // 2026-08-10 que hubo que reconstruir a mano.
    if (status === 'COMPLETED') {
      return res.status(400).json({
        error: 'Para completar una cita usa la acción "Completar", que registra el cobro. No se puede marcar como completada desde la edición.',
      });
    }

    const needsConflictCheck = date !== undefined || manicuristId !== undefined || serviceIds !== undefined;
    // Nota: un "des-cancelar" (status CANCELLED -> PENDING sin tocar fecha/manicurista/servicios)
    // no dispara este check. No hay flujo de UI para eso hoy; se acepta el hueco.

    const data = {
      ...(status && { status }),
      ...(date && { date: bogotaDateTimeToUtc(date) }),
      ...(manicuristId && { manicuristId }),
      ...(confirmed !== undefined && { confirmed }),
    };

    let resolvedServiceIds = null;
    let existing = null;

    if (serviceIds !== undefined || needsConflictCheck) {
      existing = await req.prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: { services: { include: { service: true } } },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (existing.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Completed appointments cannot be edited' });
      }
    }

    if (serviceIds !== undefined) {
      resolvedServiceIds = [...new Set((Array.isArray(serviceIds) ? serviceIds : []).filter(Boolean))];

      if (resolvedServiceIds.length === 0) {
        return res.status(400).json({ error: 'At least one service is required' });
      }

      data.services = {
        deleteMany: {},
        create: resolvedServiceIds.map((id) => ({
          service: { connect: { id } },
        })),
      };
    }

    if (needsConflictCheck) {
      const finalManicuristId = manicuristId || existing.manicuristId;

      // Solo cuando cambia la manicurista o los servicios: mover una cita de
      // hora no debe bloquearse por una combinación que ya estaba guardada.
      if (manicuristId !== undefined || serviceIds !== undefined) {
        const finalServiceIds = resolvedServiceIds || existing.services.map((s) => s.serviceId);
        const mismatch = await serviceMismatchError(req.prisma, finalManicuristId, finalServiceIds);
        if (mismatch) {
          return res.status(400).json({ error: mismatch });
        }
      }

      const finalStart = date ? bogotaDateTimeToUtc(date) : new Date(existing.date);

      const finalTotalMinutes = resolvedServiceIds
        ? (
            await req.prisma.service.findMany({
              where: { id: { in: resolvedServiceIds } },
              select: { durationMinutes: true },
            })
          ).reduce((sum, s) => sum + (s.durationMinutes || 60), 0) || 60
        : existing.services.reduce((sum, s) => sum + (s.service.durationMinutes || 60), 0) || 60;

      const finalEnd = new Date(finalStart.getTime() + finalTotalMinutes * 60000);

      const conflict = await findSchedulingConflict(req.prisma, {
        manicuristId: finalManicuristId,
        start: finalStart,
        end: finalEnd,
        excludeId: req.params.id,
      });
      if (conflict) {
        return res.status(400).json({
          error: 'No se puede agendar: la especialista ya tiene una cita programada en ese horario.',
        });
      }
    }

    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data,
      include: INCLUDE_FULL,
    });

    // Sync changes to calendar (create or update event)
    try {
      const mapped = mapAppointment(appointment);
      if (appointment.googleEventId) {
        await googleCal.updateEvent(req.prisma, req.user.id, mapped);
      } else {
        const eventId = await googleCal.createEvent(req.prisma, req.user.id, mapped);
        if (eventId) {
          await req.prisma.appointment.update({ where: { id: appointment.id }, data: { googleEventId: eventId } });
        }
      }
    } catch (e) {
      console.error('Google sync update error', e.message);
    }

    res.json(appointmentForViewer(mapAppointment(appointment), req.user));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    // Una cita completada ya generó su registro de ingreso, y ese ingreso NO se
    // borra en cascada. Borrar la cita dejaría el ingreso sin nadie a quien
    // atribuirlo: así se produjeron los huérfanos de mayo-julio de 2026.
    const existing = await req.prisma.appointment.findUnique({ where: { id: req.params.id } });
    if (existing?.status === 'COMPLETED') {
      return res.status(400).json({
        error: 'No se puede eliminar una cita completada porque su ingreso quedaría sin especialista. Elimina primero el registro de ingreso desde Finanzas.',
      });
    }

    // Try to delete linked google event first
    try {
      const appt = await req.prisma.appointment.findUnique({ where: { id: req.params.id } });
      if (appt?.googleEventId) {
        await googleCal.deleteEvent(req.prisma, req.user.id, appt.googleEventId);
      }
    } catch (e) {
      console.error('Google sync delete error', e.message);
    }

    await req.prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
