const { Router } = require('express');
const router = Router();

router.get('/', async (req, res) => {
  try {
    const services = await req.prisma.service.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const service = await req.prisma.service.findUnique({
      where: { id: req.params.id },
    });
    if (!service) return res.status(404).json({ error: 'Not found' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const { name, basePrice, durationMinutes } = req.body;
    const service = await req.prisma.service.create({
      data: {
        name,
        basePrice: parseFloat(basePrice),
        durationMinutes: parseInt(durationMinutes),
      },
    });
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const { name, basePrice, durationMinutes } = req.body;
    const service = await req.prisma.service.update({
      where: { id: req.params.id },
      data: {
        name,
        basePrice: parseFloat(basePrice),
        durationMinutes: parseInt(durationMinutes),
      },
    });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    await req.prisma.service.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
