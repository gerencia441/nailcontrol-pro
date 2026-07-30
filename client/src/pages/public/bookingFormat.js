export const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0);

export function formatDuration(minutes) {
  const total = Number(minutes) || 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

// "2026-07-30" -> "jueves 30 de julio". Se construye con Date.UTC para que la
// zona horaria del navegador no desplace el día.
export function formatLongDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  });
}

// "14:30" -> "2:30 pm"
export function formatTime12h(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export const SLOT_REASON_COPY = {
  CLOSED_DAY: 'Ese día no atendemos. Elige otra fecha.',
  PAST: 'Esa fecha ya pasó.',
  TOO_FAR: 'Esa fecha está muy lejos. Elige una más cercana.',
  DURATION_TOO_LONG:
    'Los servicios que elegiste no alcanzan a realizarse en una sola jornada. Quita alguno para continuar.',
  NO_PROVIDER:
    'Por ahora nadie presta esa combinación de servicios. Vuelve atrás y ajusta tu selección.',
};

export const WEEKDAY_INITIALS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
