import { Calendar, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ajustes</h1>

      <div className="bg-white rounded-2xl border border-pink-100 p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Calendar size={20} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">Google Calendar</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Las citas nuevas se sincronizan automáticamente con el calendario de la cuenta.
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-emerald-600">
              <CheckCircle2 size={15} />
              Conectado — florisabelcatalanlopez@gmail.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
