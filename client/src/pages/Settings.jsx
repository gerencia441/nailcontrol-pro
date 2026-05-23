import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, CheckCircle2, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connected, setConnected] = useState(null);
  const [calendarId, setCalendarId] = useState('');
  const [calendarIdInput, setCalendarIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (searchParams.get('google_connected') === '1') {
      setFlash({ type: 'success', message: 'Google Calendar conectado correctamente.' });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    api.getGoogleStatus()
      .then((data) => {
        setConnected(data.connected);
        setCalendarId(data.calendarId || '');
        setCalendarIdInput(data.calendarId || '');
      })
      .catch(() => setConnected(false))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    try {
      const { url } = await api.getGoogleConnectUrl();
      window.location.href = url;
    } catch {
      setFlash({ type: 'error', message: 'No se pudo iniciar la conexión. Intenta de nuevo.' });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Desconectar Google Calendar? Las citas futuras no se sincronizarán.')) return;
    setWorking(true);
    try {
      await api.disconnectGoogle();
      setConnected(false);
      setCalendarId('');
      setCalendarIdInput('');
      setFlash({ type: 'success', message: 'Google Calendar desconectado.' });
    } catch {
      setFlash({ type: 'error', message: 'Error al desconectar. Intenta de nuevo.' });
    } finally {
      setWorking(false);
    }
  };

  const handleSaveCalendarId = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveGoogleCalendarId(calendarIdInput.trim());
      setCalendarId(calendarIdInput.trim());
      setFlash({ type: 'success', message: 'Calendario guardado correctamente.' });
    } catch {
      setFlash({ type: 'error', message: 'Error al guardar el calendario.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Ajustes</h1>

      {flash && (
        <div
          className={`mb-5 rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            flash.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {flash.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {flash.message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-pink-100 p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Calendar size={20} className="text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-gray-800">Google Calendar</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Sincroniza las citas nuevas automáticamente con tu Google Calendar.
            </p>

            <div className="mt-4">
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 size={14} className="animate-spin" />
                  Verificando conexión...
                </div>
              ) : connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle2 size={15} />
                      Conectado
                    </span>
                    <Button variant="secondary" size="sm" onClick={handleDisconnect} disabled={working}>
                      {working ? 'Desconectando...' : 'Desconectar'}
                    </Button>
                  </div>

                  <form onSubmit={handleSaveCalendarId} className="space-y-2">
                    <Input
                      label="ID del Calendario"
                      id="calendar-id"
                      value={calendarIdInput}
                      onChange={(e) => setCalendarIdInput(e.target.value)}
                      placeholder="ejemplo@group.calendar.google.com"
                    />
                    <p className="text-xs text-gray-400">
                      Google Calendar → Configuración del calendario → ID de calendario.
                      Vacío = calendario principal.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <Button type="submit" size="sm" disabled={saving || calendarIdInput === calendarId}>
                        {saving ? 'Guardando...' : 'Guardar'}
                      </Button>
                      {calendarId && (
                        <span className="text-xs text-gray-400 truncate max-w-xs">
                          Actual: {calendarId}
                        </span>
                      )}
                    </div>
                  </form>
                </div>
              ) : (
                <Button onClick={handleConnect}>
                  <ExternalLink size={14} />
                  Conectar con Google
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-gray-400 px-1">
        Al conectar, se solicitará acceso a tu Google Calendar para crear y eliminar eventos.
      </p>
    </div>
  );
}
