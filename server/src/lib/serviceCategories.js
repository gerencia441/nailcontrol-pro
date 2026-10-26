// Catálogo de categorías de servicio. Espejo en el cliente:
// client/src/lib/serviceCategories.js (etiquetas e iconos).

const SERVICE_CATEGORIES = ['MANICURE', 'PEDICURE', 'EYEBROWS', 'LASHES'];

// Subcategorías válidas por categoría. Las categorías sin entrada no admiten
// subcategoría.
const SUBCATEGORIES_BY_CATEGORY = {
  MANICURE: ['NATURAL_NAIL_OVERLAY', 'ARTIFICIAL_SYSTEMS', 'MANICURE_SERVICES'],
};

function isValidCategory(category) {
  return SERVICE_CATEGORIES.includes(category);
}

// Devuelve la subcategoría si es válida para la categoría, o null. Una
// subcategoría que no corresponde (p. ej. al pasar un servicio de manicure a
// cejas) se descarta en vez de quedar colgando.
function normalizeSubcategory(category, subcategory) {
  if (!subcategory) return null;
  return (SUBCATEGORIES_BY_CATEGORY[category] || []).includes(subcategory) ? subcategory : null;
}

// Normaliza la lista de categorías de una especialista. `undefined` significa
// "no tocar"; un array (aunque sea vacío) reemplaza la asignación.
function parseCategories(raw) {
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.filter(isValidCategory))];
}

// % de lo facturado en cada categoría que se reserva para insumos en el
// reporte por categoría. Hoy es igual para todas (el mismo 25% de
// fundDistribution.fondoInsumos); cambiar aquí cuando varíe por categoría.
const SUPPLY_FUND_RATE_BY_CATEGORY = {
  MANICURE: 0.25,
  PEDICURE: 0.25,
  EYEBROWS: 0.25,
  LASHES: 0.25,
};

// Reparte lo cobrado en una cita entre sus servicios, en proporción a su precio
// base (a partes iguales si todos valen 0). `services` son `{ category,
// basePrice }`; devuelve los importes en el mismo orden. Se usa al completar la
// cita (para congelar el resultado) y en citas antiguas sin congelar.
function allocatePaid(services, paid) {
  const total = Number(paid) || 0;
  if (services.length === 0) return [];
  const base = services.reduce((sum, s) => sum + (Number(s.basePrice) || 0), 0);
  return services.map((s) =>
    base > 0 ? total * ((Number(s.basePrice) || 0) / base) : total / services.length
  );
}

// Única categoría de una lista de servicios, o null si están mezcladas.
function singleCategory(services) {
  const cats = [...new Set(services.map((s) => s.category).filter(Boolean))];
  return cats.length === 1 ? cats[0] : null;
}

module.exports = {
  SERVICE_CATEGORIES,
  SUBCATEGORIES_BY_CATEGORY,
  SUPPLY_FUND_RATE_BY_CATEGORY,
  isValidCategory,
  normalizeSubcategory,
  parseCategories,
  allocatePaid,
  singleCategory,
};
