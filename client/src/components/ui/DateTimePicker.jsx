import { useRef, useEffect, useCallback } from 'react';
import { CalendarDays, ChevronUp, ChevronDown } from 'lucide-react';

const ITEM_H  = 36;
const VISIBLE = 3;
const HOURS   = ['08','09','10','11','12','13','14','15','16','17','18','19'];
const MINUTES = ['00','15','30','45'];

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

function Wheel({ items, value, onChange }) {
  const listRef  = useRef(null);
  const valueRef = useRef(value);
  const busy     = useRef(false);
  const timer    = useRef(null);

  valueRef.current = value;

  const scrollTo = useCallback((idx, smooth = true) => {
    if (!listRef.current) return;
    busy.current = true;
    listRef.current.scrollTo({ top: idx * ITEM_H, behavior: smooth ? 'smooth' : 'instant' });
    setTimeout(() => { busy.current = false; }, 350);
  }, []);

  // Snap on mount
  useEffect(() => {
    const idx = items.indexOf(value);
    if (idx >= 0) scrollTo(idx, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Touch/trackpad scroll → snap after idle
  const handleScroll = useCallback(() => {
    if (busy.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!listRef.current) return;
      const idx = Math.round(listRef.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      scrollTo(clamped);
      if (items[clamped] !== valueRef.current) onChange(items[clamped]);
    }, 100);
  }, [items, onChange, scrollTo]);

  // Mouse wheel → step one item
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const cur = items.indexOf(valueRef.current);
      const next = Math.max(0, Math.min(cur + dir, items.length - 1));
      if (items[next] !== valueRef.current) {
        scrollTo(next);
        onChange(items[next]);
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [items, onChange, scrollTo]);

  const step = (dir) => {
    const cur  = items.indexOf(valueRef.current);
    const next = Math.max(0, Math.min(cur + dir, items.length - 1));
    if (items[next] !== valueRef.current) {
      scrollTo(next);
      onChange(items[next]);
    }
  };

  const containerH = ITEM_H * VISIBLE;

  return (
    <div className="flex flex-col items-center gap-0.5 flex-1">
      {/* Up button */}
      <button
        type="button"
        onClick={() => step(-1)}
        className="p-1 text-gray-300 hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-50 disabled:opacity-30"
        disabled={items.indexOf(value) === 0}
      >
        <ChevronUp size={16} strokeWidth={2.5} />
      </button>

      {/* Scroll wheel */}
      <div className="relative w-full overflow-hidden" style={{ height: containerH }}>
        {/* selection band */}
        <div
          className="absolute inset-x-0 pointer-events-none z-10 border-y border-gray-200"
          style={{ top: '50%', transform: 'translateY(-50%)', height: ITEM_H }}
        />
        {/* fades */}
        <div className="absolute inset-x-0 top-0 h-9 pointer-events-none z-20"
             style={{ background: 'linear-gradient(to bottom, white, transparent)' }} />
        <div className="absolute inset-x-0 bottom-0 h-9 pointer-events-none z-20"
             style={{ background: 'linear-gradient(to top, white, transparent)' }} />

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="h-full overflow-y-scroll"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <div style={{ height: ITEM_H }} />
          {items.map((item) => {
            const selected = item === value;
            return (
              <div
                key={item}
                style={{ height: ITEM_H, scrollSnapAlign: 'center' }}
                className="flex items-center justify-center cursor-pointer"
                onClick={() => { scrollTo(items.indexOf(item)); onChange(item); }}
              >
                <span
                  className="transition-all duration-150 select-none tabular-nums"
                  style={{
                    fontSize:   selected ? 20 : 14,
                    fontWeight: selected ? 700 : 400,
                    color:      selected ? '#111827' : '#d1d5db',
                  }}
                >
                  {item}
                </span>
              </div>
            );
          })}
          <div style={{ height: ITEM_H }} />
        </div>
      </div>

      {/* Down button */}
      <button
        type="button"
        onClick={() => step(1)}
        className="p-1 text-gray-300 hover:text-gray-500 transition-colors rounded-lg hover:bg-gray-50 disabled:opacity-30"
        disabled={items.indexOf(value) === items.length - 1}
      >
        <ChevronDown size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
}

export default function DateTimePicker({ label, value, onChange, required }) {
  const [datePart, timePart] = value && value.includes('T')
    ? value.split('T')
    : [value || '', ''];

  const [hour, minute] = timePart && timePart.includes(':')
    ? timePart.split(':').map((p) => p.padStart(2, '0'))
    : ['09', '00'];

  const setDate   = (d) => onChange(d ? `${d}T${hour}:${minute}` : '');
  const setHour   = (h) => onChange(`${datePart || todayStr()}T${h}:${minute}`);
  const setMinute = (m) => onChange(`${datePart || todayStr()}T${hour}:${m}`);

  return (
    <div className="flex flex-col gap-3">
      {label && <label className="text-xs font-medium text-gray-600">{label}</label>}

      {/* Date */}
      <div className="relative">
        <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none" />
        <input
          type="date"
          value={datePart}
          min={todayStr()}
          onChange={(e) => setDate(e.target.value)}
          required={required}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-pink-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-300 focus:border-transparent transition"
        />
      </div>

      {datePart && (
        <p className="text-xs font-medium text-pink-500 -mt-1 pl-1 capitalize">
          {formatDateDisplay(datePart)}
        </p>
      )}

      {/* Wheels */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm px-3 py-1">
        <p className="text-xs text-gray-400 text-center mb-1">Hora</p>
        <div className="flex items-center gap-1">
          <Wheel items={HOURS}   value={hour}   onChange={setHour}   />
          <span className="text-xl font-light text-gray-300 flex-shrink-0 pb-0.5">:</span>
          <Wheel items={MINUTES} value={minute} onChange={setMinute} />
        </div>
      </div>

      {required && (
        <input tabIndex={-1} aria-hidden readOnly required value={value || ''} className="sr-only" />
      )}
    </div>
  );
}
