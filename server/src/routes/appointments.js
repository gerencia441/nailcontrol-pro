const { Router } = require('express');
const router = Router();
const { getOwnerConfig, createEvent, deleteEvent } = require('../lib/googleCalendar');

const INCLUDE_FULL = {
  client: true,
  manicurist: true,
  AppointmentService: { include: { Service: true } },
};

function flatten(appt) {
  if (!appt) return appt;
  const { AppointmentService, ...rest } = appt;
  return { ...rest, service: AppointmentService?.[0]?.Service ?? null };
}

router.get('/', async (req, res) => {
  try {
    const { date, status } = req.query;
    const where = {};

    if (date) {
      const day = new Date(date);
      day.setUTCHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      where.date = { gte: day, lt: nextDay };
    }

    if (status) where.status = status;

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { date: 'asc' },
    });
    res.json(appointments.map(flatten));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { clientId, newClient, manicuristId, serviceId, date } = req.body;

    let resolvedClientId = clientId;

    if (newClient) {
      const created = await req.prisma.client.create({
        data: { name: newClient.name, phone: newClient.phone, tags: '[]' },
      });
      resolvedClientId = created.id;
    }

    const appointment = await req.prisma.appointment.create({
      data: {
        clientId: resolvedClientId,
        manicuristId,
        date: new Date(date),
        ...(serviceId && { AppointmentService: { create: { serviceId } } }),
      },
      include: INCLUDE_FULL,
    });

    const flat = flatten(appointment);

    // Sync to Google Calendar if connected
    const { refreshToken, calendarId } = await getOwnerConfig(req.prisma);
    if (refreshToken) {
      try {
        const googleEventId = await createEvent(refreshToken, calendarId, flat);
        await req.prisma.appointment.update({
          where: { id: appointment.id },
          data: { googleEventId },
        });
        flat.googleEventId = googleEventId;
      } catch (gcErr) {
        console.warn('Google Calendar sync failed (create):', gcErr.message);
      }
    }

    res.status(201).json(flat);
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
        include: { client: true, AppointmentService: { include: { Service: true } } },
      });

      if (!appt) throw new Error('Appointment not found');

      const updated = await tx.appointment.update({
        where: { id: req.params.id },
        data: {
          status: 'COMPLETED',
          finalPricePaid: parseFloat(finalPricePaid),
          paymentMethod,
        },
        include: INCLUDE_FULL,
      });

      const serviceName = appt.AppointmentService?.[0]?.Service?.name ?? 'Servicio';
      await tx.finance.create({
        data: {
          type: 'INCOME',
          amount: parseFloat(finalPricePaid),
          description: `${serviceName} — ${appt.client.name}`,
          date: new Date(),
          paymentMethod,
        },
      });

      return { appointment: flatten(updated) };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, date } = req.body;
    const appointment = await req.prisma.appointment.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(date && { date: new Date(date) }),
      },
      include: INCLUDE_FULL,
    });
    const flat = flatten(appointment);

    // If cancelling, remove the Google Calendar event
    if (status === 'CANCELLED' && flat.googleEventId) {
      const { refreshToken, calendarId } = await getOwnerConfig(req.prisma);
      if (refreshToken) {
        try {
          await deleteEvent(refreshToken, calendarId, flat.googleEventId);
          await req.prisma.appointment.update({
            where: { id: flat.id },
            data: { googleEventId: null },
          });
          flat.googleEventId = null;
        } catch (gcErr) {
          console.warn('Google Calendar sync failed (delete):', gcErr.message);
        }
      }
    }

    res.json(flat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const appt = await req.prisma.appointment.findUnique({
      where: { id: req.params.id },
      select: { googleEventId: true },
    });

    await req.prisma.appointment.delete({ where: { id: req.params.id } });

    // Clean up Google Calendar event
    if (appt?.googleEventId) {
      const { refreshToken, calendarId } = await getOwnerConfig(req.prisma);
      if (refreshToken) {
        deleteEvent(refreshToken, calendarId, appt.googleEventId).catch((err) =>
          console.warn('Google Calendar sync failed (delete on remove):', err.message)
        );
      }
    }

    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
