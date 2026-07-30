import { CheckCircle2, Calendar, Clock, User } from 'lucide-react';
import {
  formatCurrency,
  formatDuration,
  formatLongDate,
  formatTime12h,
} from './bookingFormat.js';

export default function BookingSuccess({ result, onReset }) {
  return (
    <div className="px-5 py-8 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={32} className="text-emerald-500" />
      </div>

      <h2 className="font-display text-2xl text-gray-900 mb-2">¡Solicitud recibida!</h2>
      <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">{result.message}</p>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 text-left max-w-sm mx-auto space-y-3">
        <div className="flex items-center gap-3">
          <Calendar size={15} className="text-blush-400 flex-shrink-0" />
          <span className="text-sm text-gray-800 capitalize">{formatLongDate(result.date)}</span>
        </div>
        <div className="flex items-center gap-3">
          <Clock size={15} className="text-blush-400 flex-shrink-0" />
          <span className="text-sm text-gray-800">
            {formatTime12h(result.time)} — {formatTime12h(result.endTime)}
            <span className="text-gray-400"> · {formatDuration(result.totalDurationMinutes)}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <User size={15} className="text-blush-400 flex-shrink-0" />
          <span className="text-sm text-gray-800">{result.manicurist.name.trim()}</span>
        </div>

        <div className="border-t border-gray-50 pt-3">
          <ul className="space-y-1">
            {result.services.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-gray-700 min-w-0">{s.name.trim()}</span>
                <span className="text-gray-400 flex-shrink-0">{formatCurrency(s.basePrice)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-gray-50">
            <span className="text-sm font-semibold text-gray-700">Estimado</span>
            <span className="text-sm font-bold text-blush-600">
              {formatCurrency(result.estimatedTotal)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-5 max-w-sm mx-auto">
        Guardamos tu reserva a nombre de <strong className="font-semibold">{result.client.name}</strong>{' '}
        ({result.client.phone}).
      </p>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 text-sm font-semibold text-blush-600 hover:text-blush-700 underline underline-offset-4"
      >
        Agendar otra cita
      </button>
    </div>
  );
}
