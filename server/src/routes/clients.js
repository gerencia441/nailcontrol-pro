const { Router } = require('express');
const { normalizeColombianPhone } = require('../lib/phone');
const { isAdminViewer, clientForViewer } = require('../lib/appointmentShape');
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
    // Solo la administradora puede buscar por teléfono: si no, una especialista
    // podría averiguar a quién pertenece un número aunque no se le muestre.
    const byPhone = isAdminViewer(req.user) ? [{ phone: { contains: search } }] : [];
    const clients = await req.prisma.client.findMany({
      where: search
        ? { OR: [{ name: { contains: search } }, ...byPhone] }
        : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(clients.map((c) => clientForViewer(parseTags(c), req.user)));
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
            // Proyección mínima: el historial no necesita el teléfono ni el %
            // de comisión de la especialista.
            manicurist: { select: { id: true, name: true, color: true } },
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
    res.json(clientForViewer(parsed, req.user));
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
    res.status(201).json(clientForViewer(parseTags(client), req.user));
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

    // Una especialista no ve ni edita el teléfono: se conserva el guardado.
    const canEditPhone = isAdminViewer(req.user);

    let normalizedPhone;
    if (!canEditPhone) {
      normalizedPhone = undefined;
    } else if (phone && String(phone).trim()) {
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
    res.json(clientForViewer(parseTags(client), req.user));
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
