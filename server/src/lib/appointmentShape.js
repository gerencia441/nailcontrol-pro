// OJO: INCLUDE_FULL trae las filas completas de `client` y `manicurist`, por lo
// que una cita mapeada contiene datos sensibles (manicurist.commissionPercentage,
// manicurist.phone, client.technicalNotes). Es apto para uso interno y para
// googleCalendar, pero NUNCA debe devolverse tal cual en una ruta pública.
const INCLUDE_FULL = {
  client: true,
  manicurist: true,
  services: {
    include: { service: true },
  },
};

function mapAppointment(appointment) {
  const services = appointment.services?.map((item) => item.service) || [];
  return {
    ...appointment,
    services,
    service: services[0] || null,
  };
}

module.exports = { INCLUDE_FULL, mapAppointment };
