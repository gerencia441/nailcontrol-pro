const { Router } = require('express');
const { bogotaDateTimeToUtc, bogotaDayRangeToUtc } = require('../lib/bogotaTime');
const googleCal = require('../lib/googleCalendar');
const router = Router();

const INCLUDE_FULL = {
  client: true,
  manicurist: true,
  services: {
    include: { service: true },
  },
};

function mapAppointment(appointment) {
  const services = appointment.services?.map((item) => item.service) || [];
  return {
    ...appointment,
    services,
    service: services[0] || null,
  };
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

router.post('/', async (req, res) => {
  try {
    const { clientId, newClient, manicuristId, serviceId, serviceIds, date } = req.body;
    const resolvedServiceIds = [
      ...new Set(Array.isArray(serviceIds) ? serviceIds.filter(Boolean) : [serviceId].filter(Boolean)),
    ];

    if (resolvedServiceIds.length === 0) {
      return res.status(400).json({ error: 'At least one service is required' });
    }

    let resolvedClientId = clientId;

    if (newClient) {
      const created = await req.prisma.client.create({
        data: {
          name: newClient.name,
          phone: newClient.phone || null,
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
    const data = {
      ...(status && { status }),
      ...(date && { date: bogotaDateTimeToUtc(date) }),
      ...(manicuristId && { manicuristId }),
      ...(confirmed !== undefined && { confirmed }),
    };

    if (serviceIds !== undefined) {
      const resolvedServiceIds = [...new Set((Array.isArray(serviceIds) ? serviceIds : []).filter(Boolean))];

      if (resolvedServiceIds.length === 0) {
        return res.status(400).json({ error: 'At least one service is required' });
      }

      const existing = await req.prisma.appointment.findUnique({
        where: { id: req.params.id },
        select: { status: true },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (existing.status === 'COMPLETED') {
        return res.status(400).json({ error: 'Completed appointments cannot be edited' });
      }

      data.services = {
        deleteMany: {},
        create: resolvedServiceIds.map((id) => ({
          service: { connect: { id } },
        })),
      };
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
