// Espejo en el cliente de server/src/lib/manicuristServices.js.
//
// REGLA: una especialista presta un servicio si lo tiene asignado
// explícitamente, o si tiene asignada su categoría y no tiene ningún servicio
// explícito de esa categoría (categoría sin acotar = todos sus servicios).
// Sin categorías ni servicios no presta nada.
//
// Como una cita la atiende una sola persona, el criterio es "presta TODOS los
// servicios seleccionados", no "presta alguno".
//
// `selected` son objetos de servicio ({ id, category }); `catalog` es la lista
// completa de servicios, necesaria para saber de qué categoría son los
// servicios explícitos de la especialista.

// Categorías en las que la especialista tiene servicios explícitos (acotadas).
function narrowedCategories(manicurist, catalog) {
  const own = new Set(manicurist?.serviceIds || []);
  return new Set(catalog.filter((s) => own.has(s.id)).map((s) => s.category));
}

export function providesService(manicurist, service, catalog = []) {
  if ((manicurist?.serviceIds || []).includes(service.id)) return true;
  if (!(manicurist?.categories || []).includes(service.category)) return false;
  return !narrowedCategories(manicurist, catalog).has(service.category);
}

export function providesAll(manicurist, selected = [], catalog = []) {
  return selected.every((s) => providesService(manicurist, s, catalog));
}

export function filterByServices(manicurists = [], selected = [], catalog = []) {
  if (selected.length === 0) return manicurists;
  return manicurists.filter((m) => providesAll(m, selected, catalog));
}
