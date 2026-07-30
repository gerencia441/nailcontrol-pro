import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, Globe, X, CalendarDays, Send } from 'lucide-react';
import { api } from '../lib/api.js';

function formatWhen(dateStr) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = d
    .toLocaleTimeString('en-US', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
  return `${day} · ${time}`;
}

export default function NotificationBell({ count, appointments, permission, onRequestPermission }) {
  const [open, setOpen] = useState(false);
  const [testState, setTestState] = useState(null); // null | 'sending' | 'sent' | 'none' | 'error'
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  const sendTest = async () => {
    setTestState('sending');
    try {
      const res = await api.sendTestPush();
      setTestState(res?.sent > 0 ? 'sent' : 'none');
    } catch {
      setTestState('error');
    }
    setTimeout(() => setTestState(null), 6000);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const goToAppointments = (dateStr) => {
    setOpen(false);
    // Appointments lee ?date= para abrir el día de la cita.
    const d = new Date(dateStr);
    const bogota = new Date(d.getTime() - 5 * 3600000);
    const pad = (n) => String(n).padStart(2, '0');
    const iso = `${bogota.getUTCFullYear()}-${pad(bogota.getUTCMonth() + 1)}-${pad(bogota.getUTCDate())}`;
    navigate(`/appointments?date=${iso}`);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `${count} reservas en línea por confirmar` : 'Avisos'}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
      >
        {count > 0 ? <BellRing size={19} className="text-blush-600" /> : <Bell size={19} />}
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-blush-500 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] bg-white rounded-2xl shadow-modal border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Reservas en línea</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100"
            >
              <X size={15} />
            </button>
          </div>

          {permission === 'default' && (
            <button
              type="button"
              onClick={onRequestPermission}
              className="w-full text-left px-4 py-3 bg-blush-25 border-b border-blush-100 hover:bg-blush-50 transition-colors"
            >
              <p className="text-xs font-semibold text-blush-700">Activar notificaciones</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Recibe un aviso en este dispositivo, incluso con la app cerrada.
              </p>
            </button>
          )}

          {permission === 'denied' && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
              <p className="text-xs font-semibold text-amber-800">Notificaciones bloqueadas</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Actívalas desde los ajustes del navegador para este sitio.
              </p>
            </div>
          )}

          {permission === 'granted' && (
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-500">
                {testState === 'sent'
                  ? '¡Enviado! Debe llegarte en un momento.'
                  : testState === 'none'
                    ? 'Este dispositivo aún no está registrado. Recarga la app.'
                    : testState === 'error'
                      ? 'No se pudo enviar la prueba.'
                      : 'Notificaciones activas en este dispositivo.'}
              </p>
              <button
                type="button"
                onClick={sendTest}
                disabled={testState === 'sending'}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blush-600 hover:text-blush-700 disabled:opacity-50 flex-shrink-0"
              >
                <Send size={11} />
                {testState === 'sending' ? 'Enviando…' : 'Probar'}
              </button>
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
            {count === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No hay reservas en línea por confirmar.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {appointments.map((appt) => (
                  <li key={appt.id}>
                    <button
                      type="button"
                      onClick={() => goToAppointments(appt.date)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 w-7 h-7 rounded-lg bg-blush-50 flex items-center justify-center flex-shrink-0">
                          <Globe size={13} className="text-blush-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">
                            {appt.client?.name?.trim() || 'Clienta'}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">{formatWhen(appt.date)}</p>
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {(appt.services || []).map((s) => s.name.trim()).join(' + ') || 'Sin servicios'}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            con {appt.manicurist?.name?.trim() || '—'}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {count > 0 && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/appointments');
              }}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 border-t border-gray-100 text-xs font-semibold text-blush-600 hover:bg-blush-25 transition-colors"
            >
              <CalendarDays size={13} />
              Ver todas en Citas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
