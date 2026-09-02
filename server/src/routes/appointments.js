const { Router } = require('express');
const { bogotaDateTimeToUtc, bogotaDayRangeToUtc } = require('../lib/bogotaTime');
const { normalizeColombianPhone } = require('../lib/phone');
const { findSchedulingConflict } = require('../lib/scheduling');
const { INCLUDE_FULL, mapAppointment } = require('../lib/appointmentShape');
const { providesAll } = require('../lib/manicuristServices');
const googleCal = require('../lib/googleCalendar');
const router = Router();

// Devuelve un mensaje de error si la manicurista no presta todos los servicios
// pedidos, o null si la combinación es válida. La UI ya filtra el desplegable;
// esto cierra la puerta a peticiones directas y a datos que cambiaron entre
// medias (p. ej. se le quitó un servicio después de abrir el formulario).
async function serviceMismatchError(prisma, manicuristId, serviceIds) {
  if (!manicuristId || !serviceIds || serviceIds.length === 0) return null;
  const manicurist = await prisma.manicurist.findUnique({
    where: { id: manicuristId },
    select: { name: true, services: { select: { serviceId: true } } },
  });
  if (!manicurist) return 'La manicurista seleccionada no existe.';
  if (providesAll(manicurist, serviceIds)) return null;
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
    res.json(appointments.map(mapAppointment));
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

    res.json({ count: appointments.length, appointments: appointments.map(mapAppointment) });
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
        error: 'No se puede agendar: la manicurista ya tiene una cita programada en ese horario.',
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
        return res.status(201).json(mapAppointment(updated));
      }
    } catch (e) {
      console.error('Google sync create error', e.message);
    }

    res.status(201).json(mapAppointment(appointment));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de teléfono.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/complete', async (req, res) => {
  try {
    const { finalPricePaid, paymentMethod } = req.body;

    const result = await req.prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id: req.params.id },
        include: {
          client: true,
          manicurist: true,
          services: { include: { service: true } },
        },
      });

      if (!appt) throw new Error('Appointment not found');

      const services = appt.services.map((item) => item.service);
      const serviceTotal = services.reduce((sum, service) => sum + service.basePrice, 0);
      const paid =
        finalPricePaid === undefined || finalPricePaid === ''
          ? serviceTotal
          : parseFloat(finalPricePaid);
      const serviceNames = services.map((service) => service.name).join(' + ');

      const updated = await tx.appointment.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          finalPricePaid: paid,
          paymentMethod,
          // Se congela junto al precio: a partir de aquí los cierres de esta
          // cita ya no dependen del % que tenga la ficha en el futuro.
          commissionPercentage: appt.manicurist?.commissionPercentage ?? null,
        },
        include: INCLUDE_FULL,
      });

      const finance = await tx.finance.create({
        data: {
          type: 'INCOME',
          amount: paid,
          description: `${serviceNames} - ${appt.client.name}`,
          // El ingreso se fecha con la fecha de la cita (no el momento de
          // marcar "completada") para que el cierre del día lo agrupe en el
          // mismo día que la cita y el total general coincida con la suma de
          // los servicios del día.
          date: appt.date,
          paymentMethod,
          manicuristColor: appt.manicurist?.color || null,
          manicuristId: appt.manicurist?.id || null,
          // Guardar el % de comisión vigente para que cambios futuros no
          // alteren el cálculo de comisiones históricas.
          commissionPercentage: appt.manicurist?.commissionPercentage ?? null,
        },
      });

      return { appointment: mapAppointment(updated), finance };
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

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, date, manicuristId, serviceIds, confirmed } = req.body;
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
          error: 'No se puede agendar: la manicurista ya tiene una cita programada en ese horario.',
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

    res.json(mapAppointment(appointment));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
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
