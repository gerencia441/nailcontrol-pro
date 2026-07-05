const { Router } = require('express');
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
      where: search ? { name: { contains: search } } : undefined,
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
    const client = await req.prisma.client.create({
      data: {
        name,
        birthDate: birthDate ? new Date(birthDate) : undefined,
        phone,
        tags: JSON.stringify(tags || []),
        technicalNotes,
      },
    });
    res.status(201).json(parseTags(client));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, birthDate, phone, tags, technicalNotes } = req.body;
    const client = await req.prisma.client.update({
      where: { id: req.params.id },
      data: {
        name,
        birthDate: birthDate ? new Date(birthDate) : null,
        phone,
        tags: JSON.stringify(tags || []),
        technicalNotes,
      },
    });
    res.json(parseTags(client));
  } catch (err) {
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
