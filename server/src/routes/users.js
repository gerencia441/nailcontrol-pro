const { Router } = require('express');
const bcrypt = require('bcrypt');
const router = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  next();
}

router.use(adminOnly);

router.get('/', async (req, res) => {
  try {
    const users = await req.prisma.user.findMany({
      select: { id: true, username: true, role: true, manicuristId: true },
      orderBy: { username: 'asc' },
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { username, password, role, manicuristId } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username y password requeridos' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await req.prisma.user.create({
      data: {
        username,
        password: hashed,
        role: role || 'MANICURIST',
        manicuristId: manicuristId || null,
      },
      select: { id: true, username: true, role: true, manicuristId: true },
    });
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Nombre de usuario ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { username, password, role, manicuristId } = req.body;
    const data = {
      ...(username && { username }),
      ...(role && { role }),
      manicuristId: manicuristId || null,
    };
    if (password) data.password = await bcrypt.hash(password, 10);
    const user = await req.prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, username: true, role: true, manicuristId: true },
    });
    res.json(user);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'Nombre de usuario ya existe' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    await req.prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
