const { Router } = require('express');
const router = Router();

// GET /api/settings — returns all settings as { key: value } object
router.get('/', async (req, res) => {
  try {
    const rows = await req.prisma.setting.findMany();
    const result = {};
    for (const r of rows) result[r.key] = r.value;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/settings — upserts key-value pairs (admin only)
router.put('/', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const entries = Object.entries(req.body);
    await req.prisma.$transaction(
      entries.map(([key, value]) =>
        req.prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );
    const rows = await req.prisma.setting.findMany();
    const result = {};
    for (const r of rows) result[r.key] = r.value;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
