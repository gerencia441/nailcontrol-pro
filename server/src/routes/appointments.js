const { Router } = require('express');
const router = Router();

const INCLUDE_FULL = {
  client: true,
  service: true,
  manicurist: true,
};

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

    if (status) {
      where.status = status;
    }

    const appointments = await req.prisma.appointment.findMany({
      where,
      include: INCLUDE_FULL,
      orderBy: { date: 'asc' },
    });
    res.json(appointments);
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
        data: {
          name: newClient.name,
          phone: newClient.phone,
          tags: [],
        },
      });
      resolvedClientId = created.id;
    }

    const appointment = await req.prisma.appointment.create({
      data: {
        clientId: resolvedClientId,
        manicuristId,
        serviceId,
        date: new Date(date),
      },
      include: INCLUDE_FULL,
    });
    res.status(201).json(appointment);
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
        include: { client: true, service: true },
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

      const finance = await tx.finance.create({
        data: {
          type: 'INCOME',
          amount: parseFloat(finalPricePaid),
          description: `${appt.service.name} — ${appt.client.name}`,
          date: new Date(),
          paymentMethod,
        },
      });

      return { appointment: updated, finance };
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
    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.appointment.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
