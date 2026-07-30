// Espejo en el cliente de server/src/lib/manicuristServices.js.
//
// REGLA: una manicurista sin servicios asignados (`serviceIds` vacío) presta
// TODOS. Así las fichas que existían antes de esta funcionalidad siguen
// apareciendo en cualquier cita hasta que alguien las acote desde el panel.
//
// Como una cita la atiende una sola persona, el criterio es "presta TODOS los
// servicios seleccionados", no "presta alguno".

export function providesAll(manicurist, serviceIds = []) {
  const own = manicurist?.serviceIds || [];
  if (own.length === 0) return true;
  return serviceIds.every((id) => own.includes(id));
}

export function filterByServices(manicurists = [], serviceIds = []) {
  if (serviceIds.length === 0) return manicurists;
  return manicurists.filter((m) => providesAll(m, serviceIds));
}
