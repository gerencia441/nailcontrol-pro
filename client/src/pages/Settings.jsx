import { Calendar, CheckCircle2 } from 'lucide-react';

export default function Settings() {
  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="page-title">Ajustes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configuración de la aplicación</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center flex-shrink-0">
            <Calendar size={19} className="text-sky-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">Google Calendar</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Las citas nuevas se sincronizan automáticamente con el calendario de la cuenta.
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-600">
              <CheckCircle2 size={15} />
              Conectado — florisabelcatalanlopez@gmail.com
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
