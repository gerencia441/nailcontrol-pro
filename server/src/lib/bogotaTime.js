const BOGOTA_UTC_OFFSET_HOURS = 5;

function parseDateParts(value) {
  const match = String(value || '').match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  };
}

function bogotaDateTimeToUtc(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    return new Date(value);
  }

  return new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour + BOGOTA_UTC_OFFSET_HOURS,
      parts.minute,
      parts.second,
      0
    )
  );
}

function bogotaDayRangeToUtc(value) {
  const parts = parseDateParts(value);

  if (!parts) {
    const start = new Date(value);
    start.setUTCHours(5, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  const start = bogotaDateTimeToUtc(
    `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T00:00`
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

// Fecha "YYYY-MM-DD" y minutos desde medianoche del momento actual en Bogotá.
// Se deriva del offset fijo, nunca de la zona horaria del servidor.
function bogotaNow(reference = new Date()) {
  const shifted = new Date(reference.getTime() - BOGOTA_UTC_OFFSET_HOURS * 3600000);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;

  return {
    dateStr,
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

// Minutos de un instante UTC relativo a las 00:00 Bogotá de `dateStr`.
// Puede ser negativo (cita de la noche anterior) o mayor a 1440.
function bogotaMinutesFromDayStart(dateStr, utcDate) {
  const { start } = bogotaDayRangeToUtc(dateStr);
  return (new Date(utcDate).getTime() - start.getTime()) / 60000;
}

// Día de la semana (0 = domingo) de "YYYY-MM-DD".
// Usa Date.UTC para que la zona horaria del servidor no lo desplace un día.
function bogotaWeekday(dateStr) {
  const parts = parseDateParts(dateStr);
  if (!parts) return null;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

function bogotaDaysBetween(fromStr, toStr) {
  const a = parseDateParts(fromStr);
  const b = parseDateParts(toStr);
  if (!a || !b) return null;
  const from = Date.UTC(a.year, a.month - 1, a.day);
  const to = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((to - from) / 86400000);
}

function minutesToHHMM(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

module.exports = {
  bogotaDateTimeToUtc,
  bogotaDayRangeToUtc,
  bogotaNow,
  bogotaMinutesFromDayStart,
  bogotaWeekday,
  bogotaDaysBetween,
  minutesToHHMM,
};
