// OJO: INCLUDE_FULL trae las filas completas de `client` y `manicurist`, por lo
// que una cita mapeada contiene datos sensibles (manicurist.commissionPercentage,
// manicurist.phone, client.technicalNotes). Es apto para uso interno y para
// googleCalendar, pero NUNCA debe devolverse tal cual en una ruta pública.
const INCLUDE_FULL = {
  // Las alergias de la clienta viajan con la cita para mostrarlas al abrirla.
  client: {
    include: {
      notes: { where: { type: 'ALLERGY' }, orderBy: { createdAt: 'desc' }, select: { id: true, text: true } },
    },
  },
  manicurist: true,
  services: {
    include: { service: true },
  },
  // Partes del pago (una por forma de pago) y cambios de forma de pago.
  finances: {
    where: { type: 'INCOME' },
    select: { id: true, amount: true, paymentMethod: true },
    orderBy: { createdAt: 'asc' },
  },
  paymentLogs: { orderBy: { createdAt: 'desc' } },
};

function mapAppointment(appointment) {
  const services = appointment.services?.map((item) => item.service) || [];
  return {
    ...appointment,
    services,
    service: services[0] || null,
  };
}

// Los datos de contacto de la clienta (teléfono) solo los ve la
// administradora. Se aplica a toda respuesta de la API con datos de clientas;
// googleCalendar recibe la cita sin filtrar.
function isAdminViewer(user) {
  return user?.role === 'ADMIN';
}

function clientForViewer(client, user) {
  if (!client || isAdminViewer(user)) return client;
  const { phone, ...rest } = client;
  return rest;
}

function appointmentForViewer(appointment, user) {
  if (!appointment || isAdminViewer(user)) return appointment;
  return { ...appointment, client: clientForViewer(appointment.client, user) };
}

module.exports = { INCLUDE_FULL, mapAppointment, isAdminViewer, clientForViewer, appointmentForViewer };
