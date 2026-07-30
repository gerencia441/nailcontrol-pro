import { Calendar, Clock, User, Sparkles, Phone } from 'lucide-react';
import {
  formatCurrency,
  formatDuration,
  formatLongDate,
  formatTime12h,
} from './bookingFormat.js';

function Row({ icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 text-blush-400 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-gray-800 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

export default function StepConfirm({
  services,
  manicuristName,
  date,
  time,
  endTime,
  totalDurationMinutes,
  name,
  phone,
}) {
  const total = services.reduce((sum, s) => sum + (s.basePrice || 0), 0);

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Revisa que todo esté bien antes de enviar.</p>

      <div className="bg-white rounded-2xl border border-gray-100 px-4 divide-y divide-gray-50">
        <Row icon={<Sparkles size={16} />} label="Servicios">
          <ul className="space-y-1">
            {services.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">{s.name.trim()}</span>
                <span className="text-gray-500 flex-shrink-0">{formatCurrency(s.basePrice)}</span>
              </li>
            ))}
          </ul>
        </Row>

        <Row icon={<User size={16} />} label="Manicurista">
          {manicuristName}
        </Row>

        <Row icon={<Calendar size={16} />} label="Fecha">
          <span className="capitalize">{formatLongDate(date)}</span>
        </Row>

        <Row icon={<Clock size={16} />} label="Hora">
          {formatTime12h(time)}
          {endTime && <span className="text-gray-400"> — {formatTime12h(endTime)}</span>}
          <span className="text-gray-400"> · {formatDuration(totalDurationMinutes)}</span>
        </Row>

        <Row icon={<Phone size={16} />} label="Tus datos">
          {name}
          <span className="block text-gray-500">{phone}</span>
        </Row>
      </div>

      <div className="flex items-baseline justify-between mt-4 px-1">
        <span className="text-sm font-semibold text-gray-700">Valor estimado</span>
        <span className="text-lg font-bold text-blush-600">{formatCurrency(total)}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1 px-1">
        El valor final puede variar según el trabajo que se realice.
      </p>
    </div>
  );
}
