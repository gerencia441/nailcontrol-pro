import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Phone, Tag, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import { resolveManicuristColor } from '../lib/manicuristColors.js';

// Historial completo de una clienta. Página propia (y no un modal) para que la
// lista use el scroll normal de la página y se vea entera en celular y en web.
// El teléfono solo llega desde la API cuando quien consulta es administradora.

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

function formatApptDate(d) {
  return new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function formatApptTime(d) {
  return new Date(d).toLocaleTimeString('en-US', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase();
}

const STATUS_ICON = {
  COMPLETED: <CheckCircle size={13} className="text-emerald-500" />,
  CANCELLED: <XCircle    size={13} className="text-red-400"     />,
  PENDING:   <Clock      size={13} className="text-amber-400"   />,
};
const STATUS_LABEL = { COMPLETED: 'Completada', CANCELLED: 'Cancelada', PENDING: 'Pendiente' };

const FILTERS = [
  { value: 'ALL',       label: 'Todas' },
  { value: 'COMPLETED', label: 'Completadas' },
  { value: 'PENDING',   label: 'Pendientes' },
  { value: 'CANCELLED', label: 'Canceladas' },
];

function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 text-xs font-medium">
      <Tag size={9} />
      {tag}
    </span>
  );
}

function Stat({ label, value, tone }) {
  return (
    <div className={`text-center px-3 py-2.5 rounded-xl ${tone}`}>
      <p className="text-base font-bold leading-tight">{value}</p>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}

export default function ClientHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [client,  setClient]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('ALL');

  useEffect(() => {
    setLoading(true); setError('');
    api.getClient(id)
      .then(setClient)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Volver a la pantalla anterior (Clientas o Citas); si se entró por enlace
  // directo no hay historial de navegación y se va a Clientas.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/clients'));

  if (loading) {
    return <div className="py-16 text-center text-gray-400 text-sm">Cargando historial...</div>;
  }
  if (error || !client) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-sm text-gray-500">{error || 'No se encontró la clienta.'}</p>
        <Link to="/clients" className="text-sm font-medium text-blush-600 hover:text-blush-700">Volver a Clientas</Link>
      </div>
    );
  }

  const appointments = client.appointments || [];
  const completed = appointments.filter((a) => a.status === 'COMPLETED');
  const totalPaid = completed.reduce((s, a) => s + (a.finalPricePaid || 0), 0);
  // Viene ordenado por fecha descendente: la primera completada es la última visita.
  const lastVisit = completed[0]?.date;
  const visible = filter === 'ALL' ? appointments : appointments.filter((a) => a.status === filter);

  return (
    <div className="space-y-5">
      <button type="button" onClick={goBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors">
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Encabezado */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
        <div>
          <h1 className="page-title break-words">{client.name}</h1>
          {isAdmin && client.phone && (
            <p className="inline-flex items-center gap-1.5 text-sm text-gray-500 mt-1.5">
              <Phone size={12} className="text-gray-400" /> {client.phone}
            </p>
          )}
          {(client.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {client.tags.map((t) => <TagChip key={t} tag={t} />)}
            </div>
          )}
          {client.technicalNotes && (
            <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Notas técnicas</p>
              <p className="text-sm text-gray-600 whitespace-pre-line break-words">{client.technicalNotes}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Citas"        value={appointments.length}      tone="bg-blush-50 text-blush-600" />
          <Stat label="Completadas"  value={completed.length}         tone="bg-emerald-50 text-emerald-600" />
          <Stat label="Total pagado" value={formatCurrency(totalPaid)} tone="bg-mauve-50 text-mauve-600" />
          <Stat label="Última visita" value={lastVisit ? formatApptDate(lastVisit) : '—'} tone="bg-gray-50 text-gray-700" />
        </div>
      </div>

      {/* Historial */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="section-title">Historial de citas</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const count = f.value === 'ALL' ? appointments.length : appointments.filter((a) => a.status === f.value).length;
              return (
                <button key={f.value} type="button" onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    filter === f.value
                      ? 'bg-blush-500 border-blush-500 text-white'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-blush-300'
                  }`}>
                  {f.label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            {appointments.length === 0 ? 'Esta clienta no tiene citas registradas.' : 'No hay citas con este filtro.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((a) => {
              const svcsLabel = (a.services || []).map((s) => s.name).join(' + ') || (a.service?.name ?? '—');
              return (
                <li key={a.id}
                  className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 p-3 rounded-xl border border-gray-100 bg-white"
                  style={{ borderLeft: `4px solid ${resolveManicuristColor(a.manicurist) || '#e5e7eb'}` }}>
                  {/* Fecha y hora */}
                  <div className="flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0 sm:w-36 flex-shrink-0">
                    <p className="text-xs font-semibold text-gray-700">{formatApptDate(a.date)}</p>
                    <p className="text-xs text-gray-400">{formatApptTime(a.date)}</p>
                  </div>
                  {/* Servicios y especialista — sin truncar */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 break-words">{svcsLabel}</p>
                    {a.manicurist && (
                      <p className="text-xs text-gray-500 mt-0.5">{a.manicurist.name}</p>
                    )}
                  </div>
                  {/* Estado y precio */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      {STATUS_ICON[a.status]} {STATUS_LABEL[a.status]}
                    </span>
                    {a.status === 'COMPLETED' && a.finalPricePaid != null && (
                      <span className="text-xs font-semibold text-emerald-600">{formatCurrency(a.finalPricePaid)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
