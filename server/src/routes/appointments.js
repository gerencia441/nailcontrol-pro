const { Router } = require('express');
const { bogotaDateTimeToUtc, bogotaDayRangeToUtc } = require('../lib/bogotaTime');
const { normalizeColombianPhone } = require('../lib/phone');
const { findSchedulingConflict } = require('../lib/scheduling');
const { INCLUDE_FULL, mapAppointment, appointmentForViewer } = require('../lib/appointmentShape');
const { PROVIDER_SELECT, providesAll } = require('../lib/manicuristServices');
const { allocatePaid, singleCategory } = require('../lib/serviceCategories');
const { parsePayments, appointmentMethodOf, partsOf, balanceWarning } = require('../lib/payments');
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

// Corrige la forma de pago de una cita ya completada (p. ej. se cerró como
// Bancolombia pero la transferencia falló y pagó en efectivo), o la divide en
// varias. El monto total no cambia. Pueden hacerlo la administradora y la
// especialista que atendió la cita; cada cambio queda en AppointmentPaymentLog.
router.patch('/:id/payment', async (req, res) => {
  try {
    const appt = await req.prisma.appointment.findUnique({
      where: { id: req.params.id },
      include: { finances: { where: { type: 'INCOME' }, orderBy: { createdAt: 'asc' } } },
    });
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const isAdmin = req.user.role === 'ADMIN';
    const isOwn = Boolean(req.user.manicuristId) && req.user.manicuristId === appt.manicuristId;
    if (!isAdmin && !isOwn) {
      return res.status(403).json({ error: 'Solo la administradora o la especialista de la cita pueden cambiar la forma de pago.' });
    }
    if (appt.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Solo se puede cambiar la forma de pago de una cita completada.' });
    }

    // Sin ingreso enlazado (citas antiguas que la migración no pudo enlazar
    // con seguridad) no se sabe qué registro corregir.
    const incomes = appt.finances;
    const total = Number(appt.finalPricePaid) || 0;
    const linkedTotal = incomes.reduce((sum, f) => sum + f.amount, 0);
    if (incomes.length === 0 || Math.abs(linkedTotal - total) > 0.5) {
      return res.status(409).json({
        error: 'No se encontró el ingreso de esta cita en Finanzas (cita antigua). Corrígelo desde Finanzas.',
      });
    }

    const payment = parsePayments(req.body, total);
    if (payment.error) return res.status(400).json({ error: payment.error });

    const previous = partsOf(incomes);
    const same =
      previous.length === payment.parts.length &&
      payment.parts.every((p) => previous.some((q) => q.method === p.method && Math.abs(q.amount - p.amount) < 0.5));
    if (same) return res.status(400).json({ error: 'La forma de pago no cambió.' });

    const author = req.user.manicuristId
      ? (await req.prisma.manicurist.findUnique({ where: { id: req.user.manicuristId }, select: { name: true } }))?.name
      : null;
    const base = incomes[0];

    await req.prisma.$transaction([
      req.prisma.finance.deleteMany({ where: { id: { in: incomes.map((f) => f.id) } } }),
      // Se recrean copiando todo lo que no es forma de pago ni monto: fecha,
      // especialista, % de comisión congelado y categoría. Así cierres,
      // comisiones y balance por categoría no cambian.
      ...payment.parts.map((part) =>
        req.prisma.finance.create({
          data: {
            type: 'INCOME',
            amount: part.amount,
            description: base.description,
            date: base.date,
            paymentMethod: part.method,
            manicuristColor: base.manicuristColor,
            manicuristId: base.manicuristId,
            commissionPercentage: base.commissionPercentage,
            serviceCategory: base.serviceCategory,
            appointmentId: appt.id,
          },
        })
      ),
      req.prisma.appointment.update({
        where: { id: appt.id },
        data: { paymentMethod: appointmentMethodOf(payment.parts) },
      }),
      req.prisma.appointmentPaymentLog.create({
        data: {
          appointmentId: appt.id,
          changedByUserId: req.user.id || null,
          changedByName: (author || req.user.username || 'Usuario').trim(),
          previous: JSON.stringify(previous),
          next: JSON.stringify(payment.parts),
        },
      }),
    ]);

    const updated = await req.prisma.appointment.findUnique({ where: { id: appt.id }, include: INCLUDE_FULL });
    res.json({
      appointment: appointmentForViewer(mapAppointment(updated), req.user),
      warning: isAdmin ? await balanceWarning(req.prisma, appt.date, previous, payment.parts) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
