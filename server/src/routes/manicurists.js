const { Router } = require('express');
const router = Router();

const INCLUDE_SERVICES = { services: { select: { serviceId: true } } };

// Aplana la junction a un array de ids, que es lo que consume el cliente.
// Lista vacía = presta todos los servicios (ver lib/manicuristServices.js).
function mapManicurist(m) {
  return { ...m, services: undefined, serviceIds: (m.services || []).map((s) => s.serviceId) };
}

// Normaliza el payload. `undefined` significa "no tocar la asignación"; un array
// (aunque sea vacío) sí la reemplaza.
function parseServiceIds(raw) {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.map((id) => String(id || '').trim()).filter(Boolean))];
}

// Descarta ids de servicios que ya no existen: una asignación a un servicio
// borrado haría fallar el connect entero.
async function existingServiceIds(prisma, ids) {
  if (!ids || ids.length === 0) return [];
  const found = await prisma.service.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  return found.map((s) => s.id);
}

router.get('/', async (req, res) => {
  try {
    const manicurists = await req.prisma.manicurist.findMany({
      orderBy: { name: 'asc' },
      include: INCLUDE_SERVICES,
    });
    res.json(manicurists.map(mapManicurist));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const manicurist = await req.prisma.manicurist.findUnique({
      where: { id: req.params.id },
      include: INCLUDE_SERVICES,
    });
    if (!manicurist) return res.status(404).json({ error: 'Not found' });
    res.json(mapManicurist(manicurist));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, commissionPercentage, color } = req.body;
    const serviceIds = await existingServiceIds(req.prisma, parseServiceIds(req.body.serviceIds));

    const manicurist = await req.prisma.manicurist.create({
      data: {
        name,
        phone,
        commissionPercentage: parseFloat(commissionPercentage),
        color: color || null,
        services: { create: serviceIds.map((serviceId) => ({ serviceId })) },
      },
      include: INCLUDE_SERVICES,
    });
    res.status(201).json(mapManicurist(manicurist));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, phone, commissionPercentage, color } = req.body;
    const requested = parseServiceIds(req.body.serviceIds);
    const serviceIds = requested === undefined ? undefined : await existingServiceIds(req.prisma, requested);

    const manicurist = await req.prisma.manicurist.update({
      where: { id: req.params.id },
      data: {
        name,
        phone,
        commissionPercentage: parseFloat(commissionPercentage),
        ...(color !== undefined && { color: color || null }),
        // Reemplazo completo: la UI siempre manda el conjunto entero.
        ...(serviceIds !== undefined && {
          services: {
            deleteMany: {},
            create: serviceIds.map((serviceId) => ({ serviceId })),
          },
        }),
      },
      include: INCLUDE_SERVICES,
    });
    res.json(mapManicurist(manicurist));
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
