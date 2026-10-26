// Reglas de "qué servicios presta cada especialista" (modelo Manicurist).
//
// Una especialista presta un servicio S si:
//   a) S está en sus servicios asignados explícitamente, o
//   b) la categoría de S está entre sus categorías Y no tiene ningún servicio
//      explícito de esa categoría.
//
// Es decir: asignar una categoría = "todos los servicios de esa categoría,
// incluidos los que se creen después". Marcar servicios concretos de esa
// categoría la acota a esos. Un servicio explícito de una categoría que NO
// tiene asignada es una excepción puntual (p. ej. un servicio de uñas a la
// especialista de cejas y pestañas).
//
// Sin categorías ni servicios explícitos no presta nada. La migración
// 20261026120000_add_service_categories asignó MANICURE y PEDICURE a las fichas
// que antes estaban vacías (que entonces significaba "presta todos").
//
// Toda comparación es "presta TODOS los servicios pedidos": una cita con varios
// servicios la atiende una sola especialista, así que no basta con que preste uno.

// Selección Prisma con lo que necesita `providesAll`.
const PROVIDER_SELECT = {
  services: { select: { serviceId: true, service: { select: { category: true } } } },
  categories: { select: { category: true } },
};

// IDs de servicio explícitos tal como vienen de Prisma.
function serviceIdsOf(manicurist) {
  return (manicurist?.services || []).map((s) => s.serviceId);
}

// ¿Esta especialista puede atender todos estos servicios?
// `services` son objetos `{ id, category }`.
function providesAll(manicurist, services) {
  const explicitIds = new Set(serviceIdsOf(manicurist));
  const narrowed = new Set((manicurist?.services || []).map((s) => s.service?.category).filter(Boolean));
  const categories = new Set((manicurist?.categories || []).map((c) => c.category));
  return services.every(
    (s) => explicitIds.has(s.id) || (categories.has(s.category) && !narrowed.has(s.category))
  );
}

// Filtro Prisma equivalente a `providesAll`, para no traer especialistas de más.
// Con `services` vacío no filtra nada.
function whereProvidesAll(services) {
  if (!services || services.length === 0) return {};
  return {
    AND: services.map((s) => ({
      OR: [
        { services: { some: { serviceId: s.id } } },
        {
          categories: { some: { category: s.category } },
          services: { none: { service: { category: s.category } } },
        },
      ],
    })),
  };
}

// Combina el filtro de servicios con el de una especialista concreta (o todas).
function candidateWhere({ manicuristId, services }) {
  const wantsAny = !manicuristId || manicuristId === 'any';
  const byService = whereProvidesAll(services);
  return wantsAny ? byService : { AND: [{ id: String(manicuristId) }, byService] };
}

module.exports = { PROVIDER_SELECT, serviceIdsOf, providesAll, whereProvidesAll, candidateWhere };
