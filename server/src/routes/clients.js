const { Router } = require('express');
const { normalizeColombianPhone } = require('../lib/phone');
const router = Router();

function parseTags(client) {
  if (!client) return client;
  try {
    return { ...client, tags: JSON.parse(client.tags || '[]') };
  } catch {
    return { ...client, tags: [] };
  }
}

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const clients = await req.prisma.client.findMany({
      where: search
        ? { OR: [{ name: { contains: search } }, { phone: { contains: search } }] }
        : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(clients.map(parseTags));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await req.prisma.client.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: {
          include: {
            services: { include: { service: true } },
            manicurist: true,
          },
          orderBy: { date: 'desc' },
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Not found' });
    const parsed = parseTags(client);
    parsed.appointments = parsed.appointments.map((a) => {
      const svcs = a.services?.map((s) => s.service) ?? [];
      const { services, ...rest } = a;
      return { ...rest, services: svcs, service: svcs[0] ?? null };
    });
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, birthDate, phone, tags, technicalNotes } = req.body;

    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ error: 'El teléfono es obligatorio.' });
    }

    let normalizedPhone;
    try {
      normalizedPhone = normalizeColombianPhone(phone);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const client = await req.prisma.client.create({
      data: {
        name,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        phone: normalizedPhone,
        tags: JSON.stringify(tags || []),
        technicalNotes,
      },
    });
    res.status(201).json(parseTags(client));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de teléfono.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, birthDate, phone, tags, technicalNotes } = req.body;

    let normalizedPhone;
    if (phone && String(phone).trim()) {
      try {
        normalizedPhone = normalizeColombianPhone(phone);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    } else {
      const existing = await req.prisma.client.findUnique({
        where: { id: req.params.id },
        select: { phone: true },
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.phone) {
        return res.status(400).json({
          error: 'No se puede quitar el teléfono: es el identificador del cliente.',
        });
      }
      normalizedPhone = null;
    }

    const client = await req.prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone: normalizedPhone,
        tags: JSON.stringify(tags || []),
        technicalNotes,
      },
    });
    res.json(parseTags(client));
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({ error: 'Ya existe un cliente con este número de teléfono.' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    await req.prisma.$transaction([
      // AppointmentService se borra en cascada al eliminar cada Appointment
      req.prisma.appointment.deleteMany({ where: { clientId: req.params.id } }),
      req.prisma.client.delete({ where: { id: req.params.id } }),
    ]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
