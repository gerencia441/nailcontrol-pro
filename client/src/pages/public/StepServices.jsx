import { Check, Clock } from 'lucide-react';
import { formatCurrency, formatDuration } from './bookingFormat.js';

export default function StepServices({ services, selectedIds, onToggle, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[92px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!services.length) {
    return (
      <p className="text-sm text-gray-500 text-center py-8">
        No hay servicios disponibles en este momento.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Elige uno o varios servicios. Sumamos la duración para buscarte un horario.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((s) => {
          const selected = selectedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              aria-pressed={selected}
              className={`text-left p-4 rounded-2xl border transition-all min-h-[44px] ${
                selected
                  ? 'border-blush-400 bg-blush-25 ring-2 ring-blush-300'
                  : 'border-gray-100 bg-white hover:border-blush-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                    selected ? 'bg-blush-500 border-blush-500' : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected && <Check size={13} className="text-white" strokeWidth={3} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-snug">{s.name.trim()}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-bold text-blush-600">
                      {formatCurrency(s.basePrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={11} />
                      {formatDuration(s.durationMinutes)}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
