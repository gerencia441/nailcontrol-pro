const { Router } = require('express');
const router = Router();

router.get('/', async (req, res) => {
  try {
    const manicurists = await req.prisma.manicurist.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(manicurists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const manicurist = await req.prisma.manicurist.findUnique({
      where: { id: req.params.id },
    });
    if (!manicurist) return res.status(404).json({ error: 'Not found' });
    res.json(manicurist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, commissionPercentage, color } = req.body;
    const manicurist = await req.prisma.manicurist.create({
      data: {
        name,
        phone,
        commissionPercentage: parseFloat(commissionPercentage),
        color: color || null,
      },
    });
    res.status(201).json(manicurist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, commissionPercentage, color } = req.body;
    const manicurist = await req.prisma.manicurist.update({
      where: { id: req.params.id },
      data: {
        name,
        phone,
        commissionPercentage: parseFloat(commissionPercentage),
        ...(color !== undefined && { color: color || null }),
      },
    });
    res.json(manicurist);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.manicurist.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
