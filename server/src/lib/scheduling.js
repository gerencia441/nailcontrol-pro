const DEFAULT_SERVICE_MINUTES = 60;

// Padding generoso hacia atrás: una cita larga que empezó la noche anterior
// todavía puede solaparse con un bloque de hoy. Compartido con el cálculo de
// disponibilidad para que ambos usen exactamente la misma ventana.
const CONFLICT_WINDOW_MS = 12 * 60 * 60 * 1000;

// Acepta ambas formas: [{ durationMinutes }] y filas de la tabla junction
// [{ service: { durationMinutes } }].
function sumServiceMinutes(items) {
  const total = (items || []).reduce(
    (sum, item) =>
      sum + ((item?.durationMinutes ?? item?.service?.durationMinutes) || DEFAULT_SERVICE_MINUTES),
    0
  );
  return total || DEFAULT_SERVICE_MINUTES;
}

// Solape de rangos semi-abiertos: una cita que termina justo cuando empieza
// otra NO se considera conflicto.
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

// `db` puede ser el cliente de Prisma o un cliente de transacción (`tx`).
async function findSchedulingConflict(db, { manicuristId, start, end, excludeId }) {
  const candidates = await db.appointment.findMany({
    where: {
      manicuristId,
      status: { not: 'CANCELLED' },
      ...(excludeId && { id: { not: excludeId } }),
      date: {
        gte: new Date(start.getTime() - CONFLICT_WINDOW_MS),
        lt: new Date(end.getTime() + CONFLICT_WINDOW_MS),
      },
    },
    select: {
      id: true,
      date: true,
      services: { select: { service: { select: { durationMinutes: true } } } },
    },
  });

  return (
    candidates.find((appt) => {
      const totalMinutes = sumServiceMinutes(appt.services);
      const apptStart = new Date(appt.date);
      const apptEnd = new Date(apptStart.getTime() + totalMinutes * 60000);
      return overlaps(start, end, apptStart, apptEnd);
    }) || null
  );
}

module.exports = {
  DEFAULT_SERVICE_MINUTES,
  CONFLICT_WINDOW_MS,
  sumServiceMinutes,
  overlaps,
  findSchedulingConflict,
};
