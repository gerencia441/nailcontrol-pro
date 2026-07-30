// Reglas de "qué servicios presta cada manicurista".
//
// REGLA CENTRAL: una manicurista SIN servicios asignados presta TODOS. Es lo
// que permite introducir esta funcionalidad sin backfill — las fichas que ya
// existían quedan con la lista vacía y siguen siendo elegibles para cualquier
// servicio hasta que alguien las acote desde el panel.
//
// Toda comparación es "presta TODOS los servicios pedidos": una cita con varios
// servicios la atiende una sola manicurista, así que no basta con que preste uno.

// IDs de servicio de una manicurista tal como viene de Prisma
// (`services: { select: { serviceId: true } }`).
function serviceIdsOf(manicurist) {
  return (manicurist?.services || []).map((s) => s.serviceId);
}

// ¿Esta manicurista puede atender todos estos servicios?
function providesAll(manicurist, serviceIds) {
  const own = serviceIdsOf(manicurist);
  if (own.length === 0) return true; // sin restricción declarada
  return serviceIds.every((id) => own.includes(id));
}

// Filtro Prisma equivalente a `providesAll`, para no traer manicuristas de más.
// Con `serviceIds` vacío no filtra nada.
function whereProvidesAll(serviceIds) {
  if (!serviceIds || serviceIds.length === 0) return {};
  return {
    OR: [
      { services: { none: {} } },
      { AND: serviceIds.map((id) => ({ services: { some: { serviceId: id } } })) },
    ],
  };
}

// Combina el filtro de servicios con el de una manicurista concreta (o todas).
function candidateWhere({ manicuristId, serviceIds }) {
  const wantsAny = !manicuristId || manicuristId === 'any';
  const byService = whereProvidesAll(serviceIds);
  return wantsAny ? byService : { AND: [{ id: String(manicuristId) }, byService] };
}

module.exports = { serviceIdsOf, providesAll, whereProvidesAll, candidateWhere };
