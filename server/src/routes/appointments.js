const { Router } = require('express');
const { bogotaDateTimeToUtc, bogotaDayRangeToUtc } = require('../lib/bogotaTime');
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
        date: bogotaDateTimeToUtc(date),
        services: {
          create: resolvedServiceIds.map((id) => ({
            service: { connect: { id } },
          })),
        },
      },
      include: INCLUDE_FULL,
    });
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
          date: new Date(),
          paymentMethod,
        },
      });

      return { appointment: mapAppointment(updated), finance };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { status, date, manicuristId, serviceIds } = req.body;
    const data = {
      ...(status && { status }),
      ...(date && { date: bogotaDateTimeToUtc(date) }),
      ...(manicuristId && { manicuristId }),
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
    res.json(mapAppointment(appointment));
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
