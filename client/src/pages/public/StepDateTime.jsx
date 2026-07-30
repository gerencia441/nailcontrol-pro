import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react';
import {
  WEEKDAY_INITIALS,
  SLOT_REASON_COPY,
  formatDuration,
  formatTime12h,
} from './bookingFormat.js';

const pad = (n) => String(n).padStart(2, '0');
const toDateStr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

// Toda la aritmética de fechas usa Date.UTC para que la zona horaria del
// navegador no desplace el día (una visitante en Europa vería otro "hoy").
function addDaysToStr(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const nd = new Date(Date.UTC(y, m - 1, d + delta));
  return toDateStr(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate());
}

function monthLabel(year, month) {
  return new Date(Date.UTC(year, month - 1, 1))
    .toLocaleDateString('es-CO', { timeZone: 'UTC', month: 'long', year: 'numeric' });
}

export default function StepDateTime({
  config,
  date,
  time,
  onPickDate,
  onPickTime,
  availability,
  loadingAvailability,
  totalDurationMinutes,
}) {
  const today = config.today;
  const maxDate = useMemo(() => addDaysToStr(today, config.maxAdvanceDays), [today, config.maxAdvanceDays]);

  const [cursor, setCursor] = useState(() => {
    const [y, m] = (date || today).split('-').map(Number);
    return { year: y, month: m };
  });

  const cells = useMemo(() => {
    const { year, month } = cursor;
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const out = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) out.push(toDateStr(year, month, d));
    return out;
  }, [cursor]);

  const isDisabled = (dateStr) => {
    if (dateStr < today || dateStr > maxDate) return true;
    const [y, m, d] = dateStr.split('-').map(Number);
    return config.closedWeekdays.includes(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  };

  const shiftMonth = (delta) => {
    setCursor((c) => {
      const nd = new Date(Date.UTC(c.year, c.month - 1 + delta, 1));
      return { year: nd.getUTCFullYear(), month: nd.getUTCMonth() + 1 };
    });
  };

  const firstOfCursor = toDateStr(cursor.year, cursor.month, 1);
  const lastOfCursor = toDateStr(cursor.year, cursor.month, new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate());
  const canGoPrev = firstOfCursor > today;
  const canGoNext = lastOfCursor < maxDate;

  const slots = availability?.slots || [];
  const freeSlots = slots.filter((s) => s.available);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Mostramos solo los horarios donde caben tus {formatDuration(totalDurationMinutes)} de servicio.
      </p>

      {/* Calendario */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-800 capitalize">
            {monthLabel(cursor.year, cursor.month)}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canGoNext}
            aria-label="Mes siguiente"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_INITIALS.map((w, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-gray-400 py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((dateStr, i) => {
            if (!dateStr) return <div key={`empty-${i}`} />;
            const disabled = isDisabled(dateStr);
            const selected = dateStr === date;
            const isToday = dateStr === today;
            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => onPickDate(dateStr)}
                className={`h-10 rounded-xl text-sm transition-colors ${
                  selected
                    ? 'bg-blush-500 text-white font-bold'
                    : disabled
                      ? 'text-gray-300 cursor-not-allowed'
                      : `text-gray-700 hover:bg-blush-50 ${isToday ? 'font-bold text-blush-600' : ''}`
                }`}
              >
                {Number(dateStr.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bloques de horario */}
      {!date ? (
        <p className="text-sm text-gray-400 text-center py-4">Elige una fecha para ver los horarios.</p>
      ) : loadingAvailability ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-11 rounded-xl bg-white border border-gray-100 animate-pulse" />
          ))}
        </div>
      ) : availability?.closed ? (
        <div className="text-center py-6 px-4">
          <CalendarX2 size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            {SLOT_REASON_COPY[availability.reason] || 'No hay horarios disponibles esa fecha.'}
          </p>
        </div>
      ) : freeSlots.length === 0 ? (
        <div className="text-center py-6 px-4">
          <CalendarX2 size={28} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">
            Ese día ya está completo. Prueba con otra fecha.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Horarios disponibles
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map((s) => {
              const selected = s.time === time;
              return (
                <button
                  key={s.time}
                  type="button"
                  disabled={!s.available}
                  onClick={() => onPickTime(s.time)}
                  className={`min-h-[44px] px-2 rounded-xl text-sm font-medium border transition-all ${
                    selected
                      ? 'bg-blush-500 border-blush-500 text-white'
                      : s.available
                        ? 'bg-white border-gray-200 text-gray-700 hover:border-blush-300'
                        : 'bg-gray-50 border-gray-100 text-gray-300 line-through cursor-not-allowed'
                  }`}
                >
                  {formatTime12h(s.time)}
                </button>
              );
            })}
          </div>
          {time && (
            <p className="text-xs text-gray-400 mt-3">
              Termina aproximadamente a las{' '}
              {formatTime12h(slots.find((s) => s.time === time)?.endTime)}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
