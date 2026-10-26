const { Router } = require('express');
const { isValidCategory, normalizeSubcategory } = require('../lib/serviceCategories');
const router = Router();

// Valida y normaliza categoría/subcategoría del body. Devuelve `{ error }` o
// los campos a guardar. Sin categoría en el body no se toca ninguna de las dos
// (al crear queda la de por defecto del schema, MANICURE): la subcategoría
// solo se valida junto con su categoría.
function categoryFields(body) {
  const { category, subcategory } = body;
  if (category === undefined || category === null || category === '') return { data: {} };
  if (!isValidCategory(category)) return { error: 'Categoría inválida' };
  return { data: { category, subcategory: normalizeSubcategory(category, subcategory) } };
}

router.get('/', async (req, res) => {
  try {
    const services = await req.prisma.service.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
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
    const cat = categoryFields(req.body);
    if (cat.error) return res.status(400).json({ error: cat.error });
    const service = await req.prisma.service.create({
      data: {
        name,
        basePrice: parseFloat(basePrice),
        durationMinutes: parseInt(durationMinutes),
        ...cat.data,
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
    const cat = categoryFields(req.body);
    if (cat.error) return res.status(400).json({ error: cat.error });
    const service = await req.prisma.service.update({
      where: { id: req.params.id },
      data: {
        name,
        basePrice: parseFloat(basePrice),
        durationMinutes: parseInt(durationMinutes),
        ...cat.data,
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
