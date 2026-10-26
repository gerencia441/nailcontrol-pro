const { Router } = require('express');
const { normalizeColombianPhone } = require('../lib/phone');
const { isAdminViewer, clientForViewer } = require('../lib/appointmentShape');
const router = Router();

const NOTE_TYPES = ['ALLERGY', 'PREFERENCE', 'SERVICE', 'GENERAL'];
const MAX_NOTE_LENGTH = 2000;

// Las notas las ven todas; cada usuaria edita/borra solo las suyas y la
// administradora todas. Las migradas (authorUserId null) solo la admin.
function canEditNote(note, user) {
  return isAdminViewer(user) || (note.authorUserId != null && note.authorUserId === user?.id);
}

// Valida el body de una nota. Devuelve `{ error }` o `{ type, text }`.
function parseNote(body) {
  const text = String(body?.text ?? '').trim();
  const type = body?.type || 'GENERAL';
  if (!text) return { error: 'La nota no puede estar vacía.' };
  if (text.length > MAX_NOTE_LENGTH) return { error: `La nota no puede superar ${MAX_NOTE_LENGTH} caracteres.` };
  if (!NOTE_TYPES.includes(type)) return { error: 'Tipo de nota inválido.' };
  return { type, text };
}

// Nombre visible de quien escribe: el de su ficha de especialista si está
// vinculada, o su usuario.
async function authorNameOf(prisma, user) {
  if (user?.manicuristId) {
    const m = await prisma.manicurist.findUnique({ where: { id: user.manicuristId }, select: { name: true } });
    if (m?.name) return m.name.trim();
  }
  return user?.username || 'Usuario';
}

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
        notes: { orderBy: { createdAt: 'desc' } },
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

router.post('/:id/notes', async (req, res) => {
  try {
    const parsed = parseNote(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const client = await req.prisma.client.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!client) return res.status(404).json({ error: 'Not found' });
    const note = await req.prisma.clientNote.create({
      data: {
        clientId: client.id,
        type: parsed.type,
        text: parsed.text,
        authorUserId: req.user.id,
        authorName: await authorNameOf(req.prisma, req.user),
      },
    });
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/notes/:noteId', async (req, res) => {
  try {
    const parsed = parseNote(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const note = await req.prisma.clientNote.findFirst({
      where: { id: req.params.noteId, clientId: req.params.id },
    });
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (!canEditNote(note, req.user)) {
      return res.status(403).json({ error: 'Solo puedes editar tus propias notas.' });
    }
    const updated = await req.prisma.clientNote.update({
      where: { id: note.id },
      data: { type: parsed.type, text: parsed.text },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const note = await req.prisma.clientNote.findFirst({
      where: { id: req.params.noteId, clientId: req.params.id },
    });
    if (!note) return res.status(404).json({ error: 'Not found' });
    if (!canEditNote(note, req.user)) {
      return res.status(403).json({ error: 'Solo puedes eliminar tus propias notas.' });
    }
    await req.prisma.clientNote.delete({ where: { id: note.id } });
    res.status(204).end();
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
