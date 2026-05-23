const { Router } = require('express');
const router = Router();

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const clients = await req.prisma.client.findMany({
      where: search ? { name: { contains: search } } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json(clients);
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
          include: { service: true, manicurist: true },
          orderBy: { date: 'desc' },
        },
      },
    });
    if (!client) return res.status(404).json({ error: 'Not found' });
    res.json(client);
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
        tags: tags || [],
        technicalNotes,
      },
    });
    res.status(201).json(client);
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
        tags: tags || [],
        technicalNotes,
      },
    });
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.client.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
