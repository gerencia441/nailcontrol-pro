// Configuración del portal público de reservas.
//
// Se guarda en la tabla genérica `Setting` (clave/valor), así que no requiere
// migración: las claves aparecen la primera vez que un admin guarda desde
// Configuración, y hasta entonces aplican los valores por defecto de abajo.
//
// IMPORTANTE: `PUT /api/settings` hace upsert de cualquier clave sin validar,
// así que TODA la seguridad vive en parseBookingConfig (fallback + clamping).
// Un valor mal escrito no debe tumbar el portal público.

const BOOKING_DEFAULTS = {
  booking_open_time: '08:00',
  booking_close_time: '20:00',
  booking_slot_minutes: '30',
  booking_min_notice_minutes: '120',
  booking_max_advance_days: '30',
  booking_closed_weekdays: '0', // 0 = domingo (índices de Date.getDay())
};

const BOOKING_SETTING_KEYS = Object.keys(BOOKING_DEFAULTS);

const ALLOWED_SLOT_MINUTES = [10, 15, 20, 30, 60];

function parseTimeToMinutes(value, fallback) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || '').trim());
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function parseIntInRange(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseClosedWeekdays(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const days = raw
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return [...new Set(days)].sort((a, b) => a - b);
}

function minutesToHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseBookingConfig(map = {}) {
  const defaultOpen = parseTimeToMinutes(BOOKING_DEFAULTS.booking_open_time, 480);
  const defaultClose = parseTimeToMinutes(BOOKING_DEFAULTS.booking_close_time, 1200);

  const slotMinutesRaw = parseIntInRange(
    map.booking_slot_minutes ?? BOOKING_DEFAULTS.booking_slot_minutes,
    30,
    5,
    120
  );
  const slotMinutes = ALLOWED_SLOT_MINUTES.includes(slotMinutesRaw) ? slotMinutesRaw : 30;

  let openMinutes = parseTimeToMinutes(map.booking_open_time, defaultOpen);
  let closeMinutes = parseTimeToMinutes(map.booking_close_time, defaultClose);

  // Si la configuración quedó incoherente, se vuelve a los valores por defecto
  // en lugar de dejar el portal sin bloques.
  if (openMinutes >= closeMinutes) {
    openMinutes = defaultOpen;
    closeMinutes = defaultClose;
  }

  // Alinear la apertura a un múltiplo del intervalo para que los bloques
  // queden en horas limpias (08:00, 08:30, ...).
  openMinutes = Math.ceil(openMinutes / slotMinutes) * slotMinutes;

  const closedWeekdays = parseClosedWeekdays(
    map.booking_closed_weekdays ?? BOOKING_DEFAULTS.booking_closed_weekdays
  );

  return {
    openMinutes,
    closeMinutes,
    slotMinutes,
    minNoticeMinutes: parseIntInRange(
      map.booking_min_notice_minutes ?? BOOKING_DEFAULTS.booking_min_notice_minutes,
      120,
      0,
      10080
    ),
    maxAdvanceDays: parseIntInRange(
      map.booking_max_advance_days ?? BOOKING_DEFAULTS.booking_max_advance_days,
      30,
      1,
      180
    ),
    // Si alguien cierra los 7 días el portal quedaría inservible; se ignora.
    closedWeekdays: closedWeekdays.length >= 7 ? [] : closedWeekdays,
    openTime: minutesToHHMM(openMinutes),
    closeTime: minutesToHHMM(closeMinutes),
  };
}

async function getBookingConfig(db) {
  try {
    const rows = await db.setting.findMany({ where: { key: { in: BOOKING_SETTING_KEYS } } });
    return parseBookingConfig(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  } catch (err) {
    console.error('No se pudo leer la configuración de reservas, usando valores por defecto:', err.message);
    return parseBookingConfig({});
  }
}

module.exports = {
  BOOKING_DEFAULTS,
  BOOKING_SETTING_KEYS,
  parseBookingConfig,
  getBookingConfig,
};
