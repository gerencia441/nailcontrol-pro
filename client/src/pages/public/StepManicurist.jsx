import { Check, Sparkles, AlertCircle } from 'lucide-react';
import { resolveManicuristColor } from '../../lib/manicuristColors.js';

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Card({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left p-4 rounded-2xl border transition-all ${
        selected
          ? 'border-blush-400 bg-blush-25 ring-2 ring-blush-300'
          : 'border-gray-100 bg-white hover:border-blush-200'
      }`}
    >
      <div className="flex items-center gap-3">
        {children}
        <span
          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
            selected ? 'bg-blush-500 border-blush-500' : 'border-gray-300 bg-white'
          }`}
        >
          {selected && <Check size={13} className="text-white" strokeWidth={3} />}
        </span>
      </div>
    </button>
  );
}

export default function StepManicurist({ manicurists, value, onChange, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-[72px] rounded-2xl bg-white border border-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  // `manicurists` ya llega filtrado a quienes prestan los servicios elegidos.
  // Si no queda nadie, ofrecer "cualquiera disponible" sería mentir.
  if (manicurists.length === 0) {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 flex items-start gap-2.5">
        <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">
            Nadie presta esa combinación de servicios
          </p>
          <p className="text-sm text-amber-800 mt-1">
            Vuelve atrás y ajusta tu selección, o escríbenos y te ayudamos a organizarla.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Puedes elegir a alguien en particular o dejar que te asignemos quien esté libre.
      </p>
      <div className="space-y-3">
        <Card selected={value === 'any'} onClick={() => onChange('any')}>
          <span className="w-11 h-11 rounded-2xl bg-brand-gradient flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold text-gray-800">Cualquiera disponible</span>
            <span className="block text-xs text-gray-400 mt-0.5">
              Te asignamos quien esté libre — más opciones de horario
            </span>
          </span>
        </Card>

        {manicurists.map((m) => {
          const color = resolveManicuristColor(m);
          return (
            <Card key={m.id} selected={value === m.id} onClick={() => onChange(m.id)}>
              <span
                className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                <span className="text-sm font-bold text-gray-700">{initials(m.name)}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-800 truncate">
                  {m.name.trim()}
                </span>
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
