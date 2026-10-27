import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, CheckCircle, XCircle, Clock, UserCheck, Trash2, Pencil, ChevronLeft, ChevronRight, Calendar, MessageCircle, BadgeCheck, Globe } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import DateTimePicker from '../components/ui/DateTimePicker.jsx';
import { StatusBadge, PaymentBadge } from '../components/ui/Badge.jsx';
import { resolveManicuristColor, apptCardStyle } from '../lib/manicuristColors.js';
import { filterByServices, providesAll } from '../lib/manicuristServices.js';
import { groupServicesByCategory } from '../lib/serviceCategories.js';
import { AllergyAlert } from '../components/ClientNotes.jsx';
import PaymentSplitEditor, { normalizeParts, partsError, paymentLabel } from '../components/PaymentSplitEditor.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { formatPhoneInput, isValidColombianPhone } from '../lib/phone.js';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

function buildWhatsAppLink(appt, services) {
  const digits = (appt.client?.phone || '').replace(/\D/g, '');
  const phone = digits.startsWith('57') ? digits : `57${digits}`;
  const dia = new Date(appt.date).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const hora = new Date(appt.date).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const svcs = services.map((s) => s.name).join(', ');
  // Todo el mensaje se codifica de una sola vez: el texto lleva «», tildes y
  // saltos de línea, y codificarlo a mano por partes es propenso a errores.
  const message =
    `Nombre: ${appt.client?.name}\n` +
    `Día: ${dia}\n` +
    `Hora: ${hora}\n` +
    `Servicio: ${svcs}\n` +
    `Especialista: ${appt.manicurist?.name}\n\n` +
    'Te estoy confirmando tu cita con estos datos. Por favor, responde «SÍ» a este mensaje ' +
    'para dejar tu espacio oficialmente confirmado.\n' +
    '(Si necesitas realizar algún cambio, me avisas por aquí).';
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

const formatDateTime = (d) => {
  const date = new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
  });
  const time = new Date(d).toLocaleTimeString('en-US', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase();
  return `${date}, ${time}`;
};

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-US', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase(); // "10:00 am" / "10:00 pm"
}

function getBogotaParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(date));
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

function toLocalDateInput(date) {
  const p = getBogotaParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

function toLocalDateTimeInput(date) {
  const p = getBogotaParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

const DAYS   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function MiniCalendar({ selected, onSelect, appointmentDates = [] }) {
  const [view, setView] = useState(() => {
    const d = new Date(selected + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const firstDay    = new Date(view.year, view.month, 1).getDay();
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const cells       = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const selDate     = new Date(selected + 'T00:00:00');
  const todayDate   = new Date();

  const prev = () => setView(v => v.month === 0  ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const next = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0  } : { ...v, month: v.month + 1 });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={15} />
        </button>
        <span className="text-sm font-semibold text-gray-700">{MONTHS[view.month]} {view.year}</span>
        <button onClick={next} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAYS.map(d => <span key={d} className="text-[10px] font-semibold text-gray-300 text-center">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const p = (n) => String(n).padStart(2, '0');
          const dateStr = `${view.year}-${p(view.month + 1)}-${p(day)}`;
          const isSel   = dateStr === selected;
          const isToday = new Date(view.year, view.month, day).toDateString() === todayDate.toDateString();
          const hasAppt = appointmentDates.includes(dateStr);
          return (
            <button
              key={day}
              onClick={() => onSelect(dateStr)}
              className={`relative h-7 w-full rounded-lg text-xs font-medium transition-all ${
                isSel    ? 'bg-brand-gradient text-white shadow-soft'
                : isToday ? 'border border-blush-300 text-blush-600'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {day}
              {hasAppt && !isSel && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blush-300" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const getApptServices  = (a) => a?.services?.length ? a.services : a?.service ? [a.service] : [];
const getServicesTotal = (s) => s.reduce((sum, sv) => sum + (Number(sv.basePrice) || 0), 0);
const getServicesDur   = (s) => s.reduce((sum, sv) => sum + (Number(sv.durationMinutes) || 0), 0);
const getServicesLabel = (s) => s.length ? s.map((sv) => sv.name).join(' + ') : 'Sin servicios';

// Cita que la clienta reservó por su cuenta en el portal y que el equipo
// todavía no ha confirmado. Al confirmarla la señalización desaparece.
const isOnlinePending = (a) =>
  a?.source === 'PUBLIC' && a?.status === 'PENDING' && !a?.confirmed;

function OnlineBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blush-50 text-blush-600 text-[10px] font-semibold flex-shrink-0"
      title="Reservada en línea por la clienta · por confirmar"
    >
      <Globe size={9} />
      En línea
    </span>
  );
}

const EMPTY_APPT    = { clientId: '', manicuristId: '', serviceIds: [], date: '', isNewClient: false, newClientName: '', newClientPhone: '' };
const EMPTY_COMPLETE = { finalPricePaid: '', payments: [{ method: 'CASH', amount: '' }] };

// Partes del pago de una cita completada: sus ingresos enlazados o, en citas
// antiguas sin enlace, la forma de pago única guardada en la cita.
function paymentPartsOf(appt) {
  if (appt?.finances?.length) return appt.finances.map((f) => ({ method: f.paymentMethod, amount: f.amount }));
  if (appt?.paymentMethod) return [{ method: appt.paymentMethod, amount: appt.finalPricePaid }];
  return [];
}

const formatLogDate = (d) => new Date(d).toLocaleString('es-CO', {
  timeZone: 'America/Bogota', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
});

function describeParts(json) {
  try {
    return JSON.parse(json).map((p) => `${paymentLabel(p.method)} ${formatCurrency(p.amount)}`).join(' + ');
  } catch { return '—'; }
}

const STATUS_TABS = [
  { key: 'all',       label: 'Todas'      },
  { key: 'PENDING',   label: 'Pendientes' },
  { key: 'COMPLETED', label: 'Completadas'},
  { key: 'CANCELLED', label: 'Canceladas' },
];

// ─── Hourly Calendar (Google-Calendar style) ────────────────────────────────

const HOUR_H     = 64;          // px per hour
const CAL_START  = 7;           // 7 AM
const CAL_END    = 22;          // 10 PM
const CAL_HOURS  = CAL_END - CAL_START;

function getBogotaMinutes() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const h = parseInt(parts.find(p => p.type === 'hour').value);
  const m = parseInt(parts.find(p => p.type === 'minute').value);
  return h * 60 + m;
}

function shiftDate(dateStr, delta) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const nd = new Date(Date.UTC(y, mo - 1, d + delta));
  const p  = n => String(n).padStart(2, '0');
  return `${nd.getUTCFullYear()}-${p(nd.getUTCMonth() + 1)}-${p(nd.getUTCDate())}`;
}

function fmtHourLabel(h) {
  if (h === 12) return '12 PM';
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function layoutDayEvents(appointments, getApptSvcs) {
  const events = appointments.map(appt => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date(appt.date));
    const h = parseInt(parts.find(p => p.type === 'hour').value);
    const m = parseInt(parts.find(p => p.type === 'minute').value);
    const startMin = h * 60 + m;
    const svcs     = getApptSvcs(appt);
    const dur      = svcs.reduce((s, sv) => s + (sv.durationMinutes || 0), 0) || 60;
    return { appt, startMin, endMin: startMin + dur, col: 0, totalCols: 1 };
  });

  events.sort((a, b) => a.startMin - b.startMin);

  // Greedy column packing
  const colEnds = [];
  events.forEach(ev => {
    let col = colEnds.findIndex(t => t <= ev.startMin);
    if (col === -1) col = colEnds.length;
    colEnds[col] = ev.endMin;
    ev.col = col;
  });

  // Total simultaneous columns for each event
  events.forEach(ev => {
    const concurrent = events.filter(o => o.startMin < ev.endMin && o.endMin > ev.startMin);
    ev.totalCols = Math.max(...concurrent.map(e => e.col)) + 1;
  });

  return events;
}

function HourlyCalendar({ appointments, selectedDate, onDateChange, getApptServices, resolveColor, onEventClick }) {
  const [nowMin, setNowMin] = useState(getBogotaMinutes);
  const scrollRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNowMin(getBogotaMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Scroll to current time (or 8 AM) on first render
  useEffect(() => {
    if (!scrollRef.current) return;
    const minFromTop = nowMin - CAL_START * 60 - 60; // 1 hr before current
    scrollRef.current.scrollTop = Math.max(0, (minFromTop / 60) * HOUR_H);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const events  = layoutDayEvents(appointments, getApptServices);
  const nowTop  = ((nowMin - CAL_START * 60) / 60) * HOUR_H;
  const showNow = nowMin >= CAL_START * 60 && nowMin <= CAL_END * 60;
  const isToday = selectedDate === toLocalDateInput(new Date());

  const friendlyDay = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden flex flex-col">
      {/* Day navigator */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, -1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-center leading-tight">
          <p className="text-sm font-semibold text-gray-800 capitalize">{friendlyDay}</p>
          {isToday && <p className="text-xs text-blush-500 font-medium">Hoy</p>}
        </div>
        <button
          onClick={() => onDateChange(shiftDate(selectedDate, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Scrollable area */}
      <div ref={scrollRef} className="overflow-y-auto" style={{ height: '440px' }}>
        <div className="relative flex" style={{ height: `${CAL_HOURS * HOUR_H}px` }}>

          {/* Hour labels */}
          <div className="w-14 flex-shrink-0 relative select-none">
            <div className="absolute top-1 right-2 text-[9px] font-medium text-gray-300 uppercase tracking-wider">
              GMT-5
            </div>
            {Array.from({ length: CAL_HOURS }, (_, i) => CAL_START + i).map(h => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-gray-400 font-medium leading-none whitespace-nowrap"
                style={{ top: `${(h - CAL_START) * HOUR_H - 6}px` }}
              >
                {fmtHourLabel(h)}
              </div>
            ))}
          </div>

          {/* Grid + events */}
          <div className="flex-1 relative border-l border-gray-100 min-w-0">

            {/* Grid lines */}
            {Array.from({ length: CAL_HOURS }, (_, i) => i).map(i => (
              <div key={i}>
                <div className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: `${i * HOUR_H}px` }} />
                <div className="absolute left-0 right-0 border-t border-dashed border-gray-50"
                  style={{ top: `${i * HOUR_H + HOUR_H / 2}px` }} />
              </div>
            ))}
            <div className="absolute left-0 right-0 border-t border-gray-100"
              style={{ top: `${CAL_HOURS * HOUR_H}px` }} />

            {/* Current time indicator */}
            {showNow && (
              <div className="absolute left-0 right-0 flex items-center pointer-events-none"
                style={{ top: `${nowTop}px`, zIndex: 20 }}>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 flex-shrink-0" />
                <div className="flex-1 h-px bg-red-500" />
              </div>
            )}

            {/* Events */}
            {events.map(({ appt, startMin, endMin, col, totalCols }) => {
              const top    = ((startMin - CAL_START * 60) / 60) * HOUR_H;
              const height = Math.max(((endMin - startMin) / 60) * HOUR_H, 22);
              const pct    = 100 / totalCols;
              const color  = resolveColor(appt.manicurist) || '#ec4899';
              const isShort = height < 42;

              return (
                <div
                  key={appt.id}
                  onClick={() => onEventClick(appt)}
                  className="absolute rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    top:             `${top + 1}px`,
                    height:          `${height - 2}px`,
                    left:            `calc(${col * pct}% + 2px)`,
                    width:           `calc(${pct}% - 4px)`,
                    backgroundColor: `${color}33`,
                    borderLeft:      `3px solid ${color}`,
                    zIndex:          10,
                  }}
                >
                  {/* Reservada por la clienta desde el portal y sin confirmar.
                      Va posicionada de forma absoluta para que se vea también en
                      las tarjetas muy cortas, donde no cabe texto. */}
                  {isOnlinePending(appt) && (
                    <span
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blush-500 flex items-center justify-center shadow-sm"
                      title="Reservada en línea · por confirmar"
                    >
                      <Globe size={9} className="text-white" />
                    </span>
                  )}
                  <div className="px-1.5 py-1 h-full overflow-hidden">
                    <p className="text-[11px] font-bold leading-tight truncate text-gray-700 pr-4">
                      {appt.client?.name}
                    </p>
                    {!isShort && (
                      <p className="text-[10px] text-gray-500 leading-tight truncate mt-0.5">
                        {formatTime(appt.date)}
                        {appt.manicurist?.name ? ` · ${appt.manicurist.name.split(' ')[0]}` : ''}
                      </p>
                    )}
                    {!isShort && appt.confirmed && appt.status === 'PENDING' && (
                      <p className="text-[9px] font-semibold mt-0.5 flex items-center gap-0.5 text-gray-600">
                        <BadgeCheck size={9} /> Confirmada
                      </p>
                    )}
                    {!isShort && isOnlinePending(appt) && (
                      <p className="text-[9px] font-semibold mt-0.5 text-blush-600 leading-tight">
                        En línea · por confirmar
                      </p>
                    )}
                    {!isShort && appt.status === 'COMPLETED' && (
                      <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">✓ Completada</p>
                    )}
                    {!isShort && appt.status === 'CANCELLED' && (
                      <p className="text-[9px] text-red-400 font-semibold mt-0.5">✗ Cancelada</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

export default function Appointments() {
  const { isAdmin, user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [pending,      setPending]      = useState([]);
  const [clients,      setClients]      = useState([]);
  const [services,     setServices]     = useState([]);
  const [manicurists,  setManicurists]  = useState([]);
  // Permite abrir un día concreto desde otra parte de la app
  // (ej. /appointments?date=2026-08-26 desde la campanita de avisos).
  const [selectedDate, setSelectedDate] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get('date');
    return /^\d{4}-\d{2}-\d{2}$/.test(wanted || '') ? wanted : toLocalDateInput(new Date());
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading,      setLoading]      = useState(false);
  const [tab,          setTab]          = useState('calendar');
  const [calOpen,      setCalOpen]      = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // El estado inicial cubre la llegada directa a la URL; este efecto cubre el
  // caso de ya estar en esta página y tocar otro aviso (el componente no se
  // remonta, así que el inicializador no se vuelve a evaluar). Luego limpia el
  // parámetro para que no quede pegado al navegar.
  useEffect(() => {
    const wanted = searchParams.get('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wanted || '')) return;
    setSelectedDate(wanted);
    setTab('calendar');
    const next = new URLSearchParams(searchParams);
    next.delete('date');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const [apptModal,  setApptModal]  = useState(false);
  const [apptForm,   setApptForm]   = useState(EMPTY_APPT);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [clientSearch,       setClientSearch]       = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [completeModal,  setCompleteModal]  = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm,   setCompleteForm]   = useState(EMPTY_COMPLETE);
  const [completing,     setCompleting]     = useState(false);

  const [detailsModal,  setDetailsModal]  = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

  // Cambio de forma de pago de una cita completada.
  const [payEditOpen,  setPayEditOpen]  = useState(false);
  const [payEditParts, setPayEditParts] = useState([]);
  const [payEditing,   setPayEditing]   = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const [byDate, pend] = await Promise.all([
        api.getAppointments({ date: selectedDate }),
        api.getAppointments({ status: 'PENDING' }),
      ]);
      setAppointments(byDate);
      setPending(pend);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);
  useEffect(() => {
    Promise.all([api.getClients(), api.getServices(), api.getManicurists()]).then(([c, s, m]) => {
      setClients(c); setServices(s); setManicurists(m);
    });
  }, []);

  const filtered = appointments.filter(
    a => statusFilter === 'all' || a.status === statusFilter
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const friendlyDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const openComplete = (appt) => {
    setCompleteTarget(appt);
    setCompleteForm({ finalPricePaid: String(getServicesTotal(getApptServices(appt))), payments: [{ method: 'CASH', amount: '' }] });
    setCompleteModal(true);
  };

  const openCreate = () => { setEditId(null); setApptForm(EMPTY_APPT); setClientSearch(''); setShowClientDropdown(false); setApptModal(true); };
  const openEdit   = (appt) => {
    setEditId(appt.id);
    setApptForm({
      clientId: appt.clientId || appt.client?.id || '',
      manicuristId: appt.manicuristId || appt.manicurist?.id || '',
      serviceIds: getApptServices(appt).map((s) => s.id),
      date: toLocalDateTimeInput(appt.date),
      isNewClient: false, newClientName: '', newClientPhone: '',
    });
    setClientSearch(appt.client?.name || '');
    setShowClientDropdown(false);
    setApptModal(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    const err = partsError(completeForm.payments, completeForm.finalPricePaid);
    if (err) { alert(err); return; }
    setCompleting(true);
    try {
      await api.completeAppointment(completeTarget.id, {
        finalPricePaid: completeForm.finalPricePaid,
        payments: normalizeParts(completeForm.payments, completeForm.finalPricePaid),
      });
      setCompleteModal(false); loadAppointments();
    }
    catch (err) { alert(err.message); }
    finally { setCompleting(false); }
  };

  // La administradora y la especialista que atendió la cita (el servidor lo valida igual).
  const canEditPayment = (appt) =>
    appt?.status === 'COMPLETED' && (isAdmin || (user?.manicuristId && user.manicuristId === appt.manicuristId));

  const openPayEdit = () => {
    const parts = paymentPartsOf(detailsTarget);
    setPayEditParts(parts.length ? parts.map((p) => ({ method: p.method, amount: String(p.amount) })) : [{ method: 'CASH', amount: '' }]);
    setPayEditOpen(true);
  };

  const handlePayEdit = async (e) => {
    e.preventDefault();
    const total = detailsTarget.finalPricePaid;
    const err = partsError(payEditParts, total);
    if (err) { alert(err); return; }
    setPayEditing(true);
    try {
      const res = await api.updateAppointmentPayment(detailsTarget.id, normalizeParts(payEditParts, total));
      setDetailsTarget(res.appointment);
      setPayEditOpen(false);
      loadAppointments();
      if (res.warning) alert(res.warning);
    } catch (err) { alert(err.message); }
    finally { setPayEditing(false); }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    try { await api.updateAppointment(id, { status: 'CANCELLED' }); loadAppointments(); }
    catch (err) { alert(err.message); }
  };

  const handleSaveAppt = async (e) => {
    e.preventDefault();
    if (apptForm.serviceIds.length === 0) { alert('Selecciona al menos un servicio.'); return; }
    if (!editId && apptForm.isNewClient && !isValidColombianPhone(apptForm.newClientPhone)) {
      alert('Ingresa un teléfono válido en formato +57 XXX XXXXXXX.');
      return;
    }
    setSaving(true);
    try {
      const payload = { manicuristId: apptForm.manicuristId, serviceIds: apptForm.serviceIds, date: apptForm.date };
      if (editId) {
        await api.updateAppointment(editId, payload);
      } else if (apptForm.isNewClient) {
        payload.newClient = { name: apptForm.newClientName, phone: apptForm.newClientPhone };
        await api.createAppointment(payload);
      } else {
        payload.clientId = apptForm.clientId;
        await api.createAppointment(payload);
      }
      setApptModal(false); setEditId(null); loadAppointments();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const toggleService = (id) => {
    setApptForm((cur) => {
      const serviceIds = cur.serviceIds.includes(id)
        ? cur.serviceIds.filter((s) => s !== id)
        : [...cur.serviceIds, id];
      // Si la manicurista ya elegida no presta la nueva combinación, se
      // deselecciona en vez de dejar el desplegable mostrando a alguien que ya
      // no es una opción válida.
      const chosen = manicurists.find((m) => m.id === cur.manicuristId);
      const stillValid = !chosen || providesAll(chosen, services.filter((s) => serviceIds.includes(s.id)), services);
      return { ...cur, serviceIds, manicuristId: stillValid ? cur.manicuristId : '' };
    });
  };

  const handleDeleteAppt = async (id) => {
    if (!confirm('¿Eliminar esta cita?')) return;
    try { await api.deleteAppointment(id); loadAppointments(); }
    catch (err) { alert(err.message); }
  };

  const setConfirmed = async (appt, value) => {
    try {
      await api.updateAppointment(appt.id, { confirmed: value });
      // Si la cita está abierta en el modal, refleja el cambio de inmediato:
      // completeTarget guarda una copia del momento en que se abrió, así que
      // recargar la lista por sí solo no lo actualizaría.
      setCompleteTarget((t) => (t && t.id === appt.id ? { ...t, confirmed: value } : t));
      loadAppointments();
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleConfirmed = async (appt, e) => {
    e.stopPropagation();
    await setConfirmed(appt, !appt.confirmed);
  };

  const selectedServices      = services.filter((s) => apptForm.serviceIds.includes(s.id));
  const selectedServicesTotal = getServicesTotal(selectedServices);
  const selectedServicesDur   = getServicesDur(selectedServices);

  // Solo las especialistas que prestan TODOS los servicios marcados.
  const eligibleManicurists = filterByServices(manicurists, selectedServices, services);
  const hiddenManicurists   = manicurists.length - eligibleManicurists.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Citas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} citas · <span className="capitalize">{friendlyDate}</span></p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nueva Cita
        </Button>
      </div>

      {/* Main layout: stack on mobile, side-by-side on lg */}
      <div className="flex flex-col lg:grid lg:grid-cols-[240px_1fr] gap-4">

        {/* Calendar sidebar */}
        <div className="space-y-3">
          {/* Mobile toggle */}
          <button
            onClick={() => setCalOpen(v => !v)}
            className="lg:hidden w-full flex items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-card px-4 py-3 text-sm font-medium text-gray-700"
          >
            <Calendar size={16} className="text-blush-400" />
            <span className="capitalize">{friendlyDate}</span>
            <ChevronRight size={14} className={`ml-auto text-gray-400 transition-transform ${calOpen ? 'rotate-90' : ''}`} />
          </button>

          <div className={`${calOpen ? 'block' : 'hidden'} lg:block`}>
            <MiniCalendar
              selected={selectedDate}
              onSelect={(d) => { setSelectedDate(d); setCalOpen(false); }}
              appointmentDates={pending.map(a => toLocalDateInput(a.date))}
            />
          </div>

          {/* Day summary — desktop only */}
          <div className="hidden lg:block bg-white rounded-2xl border border-gray-100 shadow-card p-4 space-y-3">
            <p className="section-title">Resumen del día</p>
            {[
              { label: 'Pendientes',  value: appointments.filter(a => a.status === 'PENDING').length,   cls: 'text-amber-500'   },
              { label: 'Completadas', value: appointments.filter(a => a.status === 'COMPLETED').length, cls: 'text-emerald-600' },
              { label: 'Canceladas',  value: appointments.filter(a => a.status === 'CANCELLED').length, cls: 'text-red-400'     },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{item.label}</span>
                <span className={`text-sm font-bold ${item.cls}`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Pending tab shortcut — desktop only */}
          <button
            onClick={() => setTab(tab === 'pending' ? 'calendar' : 'pending')}
            className={`hidden lg:flex w-full items-center justify-between px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
              tab === 'pending'
                ? 'bg-brand-gradient text-white border-transparent shadow-soft'
                : 'bg-white border-gray-100 shadow-card text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>Todas las Pendientes</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tab === 'pending' ? 'bg-white/20 text-white' : 'bg-blush-50 text-blush-600'}`}>
              {pending.length}
            </span>
          </button>
        </div>

        {/* Appointment list */}
        <div className="space-y-3 min-w-0">
          {/* Tabs: mobile only */}
          <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-card w-fit lg:hidden">
            {[{ key: 'calendar', label: 'Por Fecha' }, { key: 'pending', label: `Pendientes (${pending.length})` }].map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-brand-gradient text-white shadow-soft' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Hourly calendar — always visible in day view */}
          {tab === 'calendar' && (
            <HourlyCalendar
              appointments={appointments}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              getApptServices={getApptServices}
              resolveColor={resolveManicuristColor}
              onEventClick={(appt) => {
                if (appt.status === 'PENDING') { openComplete(appt); }
                else { setDetailsTarget(appt); setDetailsModal(true); }
              }}
            />
          )}

          {/* Status filter — only in day view */}
          {tab === 'calendar' && (
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Listado del día</p>
              <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-card overflow-x-auto">
                {STATUS_TABS.map(t => (
                  <button key={t.key} onClick={() => setStatusFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === t.key ? 'bg-brand-gradient text-white shadow-soft' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cards */}
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100 shadow-card" />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(tab === 'pending' ? pending : filtered).length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center shadow-card">
                  <p className="text-gray-300 text-sm">No hay citas para este día.</p>
                </div>
              )}
              {(tab === 'pending' ? pending : filtered).map((appt) => {
                const apptSvcs = getApptServices(appt);
                return (
                  <div
                    key={appt.id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-card px-3 py-4 sm:px-4 sm:py-5 flex items-center gap-3 sm:gap-4 hover:shadow-card-hover transition-all cursor-pointer"
                    style={apptCardStyle(resolveManicuristColor(appt.manicurist))}
                    onClick={() => {
                      if (appt.status === 'PENDING') { openComplete(appt); }
                      else { setDetailsTarget(appt); setDetailsModal(true); }
                    }}
                  >
                    {/* Time block */}
                    <div className="w-12 sm:w-14 flex flex-col items-center bg-gray-50 rounded-xl p-2 flex-shrink-0">
                      <span className="text-[9px] text-gray-400 font-medium leading-none">
                        {formatTime(appt.date).includes('am') ? 'AM' : 'PM'}
                      </span>
                      <span className="text-sm font-bold text-gray-800 leading-tight mt-0.5">
                        {formatTime(appt.date).replace(/\s(am|pm)$/i, '')}
                      </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{appt.client?.name}</p>
                        {isOnlinePending(appt) && <OnlineBadge />}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {getServicesLabel(apptSvcs)}
                        <span className="hidden sm:inline"> · {appt.manicurist?.name?.split(' ')[0]}</span>
                      </p>
                    </div>

                    {/* Price */}
                    {appt.finalPricePaid != null && (
                      <span className="text-sm font-bold text-emerald-600 flex-shrink-0 hidden sm:block">
                        {formatCurrency(appt.finalPricePaid)}
                      </span>
                    )}

                    {/* Status badge */}
                    <StatusBadge status={appt.status} />

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {appt.status === 'PENDING' && (
                        <>
                          {/* Confirmar cita: admin puede togglear, especialista solo ve */}
                          {isAdmin ? (
                            <button
                              onClick={(e) => toggleConfirmed(appt, e)}
                              title={appt.confirmed ? 'Cita confirmada' : 'Confirmar cita'}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                                appt.confirmed
                                  ? 'text-teal-500 bg-teal-50'
                                  : 'text-gray-300 hover:bg-teal-50 hover:text-teal-400'
                              }`}
                            >
                              <BadgeCheck size={15} />
                            </button>
                          ) : appt.confirmed ? (
                            <span className="w-7 h-7 flex items-center justify-center text-teal-400" title="Confirmada">
                              <BadgeCheck size={15} />
                            </span>
                          ) : null}
                          {/* Completar cita */}
                          <button
                            onClick={() => openComplete(appt)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                            title="Completar cita"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </>
                      )}
                      {appt.status !== 'PENDING' && isAdmin && (
                        <button
                          onClick={() => handleDeleteAppt(appt.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal isOpen={apptModal} onClose={() => setApptModal(false)} title={editId ? 'Editar Cita' : 'Nueva Cita'} maxWidth="max-w-md">
        <form onSubmit={handleSaveAppt} className="space-y-4">
          <DateTimePicker label="Fecha y Hora *" value={apptForm.date} onChange={(v) => setApptForm({ ...apptForm, date: v })} required />

          {!editId && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="new-client-check" checked={apptForm.isNewClient} className="accent-blush-500"
                onChange={(e) => setApptForm({ ...apptForm, isNewClient: e.target.checked, clientId: '' })} />
              <label htmlFor="new-client-check" className="text-xs font-medium text-gray-600">Crear nueva clienta</label>
            </div>
          )}

          {!editId && apptForm.isNewClient ? (
            <div className="space-y-3 pl-3 border-l-2 border-blush-200">
              <Input label="Nombre *" id="new-client-name" value={apptForm.newClientName} required={apptForm.isNewClient} placeholder="Nombre completo"
                onChange={(e) => setApptForm({ ...apptForm, newClientName: e.target.value })} />
              <Input label="Teléfono *" id="new-client-phone" value={apptForm.newClientPhone} required={apptForm.isNewClient}
                placeholder="+57 300 0000000"
                onChange={(e) => setApptForm({ ...apptForm, newClientPhone: formatPhoneInput(e.target.value) })} />
            </div>
          ) : (
            <div className="relative flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide" htmlFor="client-search">
                Clienta *
              </label>
              <input
                id="client-search"
                type="text"
                autoComplete="off"
                disabled={Boolean(editId)}
                placeholder="Buscar clienta..."
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value);
                  setApptForm({ ...apptForm, clientId: '' });
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowClientDropdown(false), 150)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-400 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {showClientDropdown && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clients
                    .filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setApptForm({ ...apptForm, clientId: c.id });
                          setClientSearch(c.name);
                          setShowClientDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-blush-50 hover:text-blush-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
                      >
                        {c.name}
                      </button>
                    ))}
                  {clients.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                    <p className="px-3 py-2.5 text-sm text-gray-400">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios *</span>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white">
              {groupServicesByCategory(services).map((cat) => (
                <div key={cat.value}>
                  <div className="sticky top-0 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
                    <cat.Icon size={12} /> {cat.label}
                  </div>
                  <div className="divide-y divide-gray-50">
                    {cat.services.map((s) => (
                      <label key={s.id} htmlFor={`appt-svc-${s.id}`} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input id={`appt-svc-${s.id}`} type="checkbox" checked={apptForm.serviceIds.includes(s.id)}
                          onChange={() => toggleService(s.id)} className="accent-blush-500" />
                        <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(s.basePrice)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{selectedServices.length} seleccionado(s)</span>
              <span>{selectedServicesDur} min · {formatCurrency(selectedServicesTotal)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Select label="Especialista *" id="appt-manicurist" value={apptForm.manicuristId} required
              onChange={(e) => setApptForm({ ...apptForm, manicuristId: e.target.value })}>
              <option value="">
                {apptForm.serviceIds.length === 0
                  ? 'Selecciona primero los servicios...'
                  : eligibleManicurists.length === 0
                    ? 'Ninguna presta estos servicios'
                    : 'Seleccionar especialista...'}
              </option>
              {eligibleManicurists.map((m) => (
                <option key={m.id} value={m.id}>{m.name} ({m.commissionPercentage}%)</option>
              ))}
            </Select>
            {eligibleManicurists.length === 0 && apptForm.serviceIds.length > 0 ? (
              <p className="text-xs text-red-500">
                Ninguna especialista presta esa combinación de servicios. Ajusta los servicios o
                asigna el servicio a alguien en la sección Especialistas.
              </p>
            ) : hiddenManicurists > 0 ? (
              <p className="text-xs text-gray-400">
                {hiddenManicurists === 1 ? 'Se ocultó 1 especialista' : `Se ocultaron ${hiddenManicurists} especialistas`} que
                no prestan los servicios seleccionados.
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setApptModal(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Cita'}</Button>
          </div>
        </form>
      </Modal>

      {/* Complete Service Modal */}
      <Modal isOpen={completeModal} onClose={() => setCompleteModal(false)} title="Finalizar Servicio" maxWidth="max-w-sm">
        {completeTarget && (
          <form onSubmit={handleComplete} className="space-y-4">
            <AllergyAlert notes={completeTarget.client?.notes} />
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5"
              style={{ borderLeft: `4px solid ${resolveManicuristColor(completeTarget.manicurist)}` }}>
              <div className="flex items-center justify-between gap-2">
                <Link to={`/clients/${completeTarget.clientId}`} className="font-semibold text-gray-800 hover:text-blush-600 underline-offset-2 hover:underline">
                  {completeTarget.client?.name}
                </Link>
                {completeTarget.confirmed ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 flex-shrink-0">
                    <BadgeCheck size={10} /> Confirmada
                  </span>
                ) : isOnlinePending(completeTarget) ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blush-600 bg-blush-50 px-2 py-0.5 rounded-full border border-blush-200 flex-shrink-0">
                    <Globe size={10} /> En línea · sin confirmar
                  </span>
                ) : completeTarget.status === 'PENDING' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex-shrink-0">
                    <Clock size={10} /> Sin confirmar
                  </span>
                ) : null}
              </div>
              {completeTarget.manicurist?.name && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <UserCheck size={11} /> {completeTarget.manicurist.name}
                </p>
              )}
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={11} /> {formatDateTime(completeTarget.date)}
              </p>
              <div className="text-gray-500 space-y-1">
                {getApptServices(completeTarget).map((sv) => (
                  <div key={sv.id} className="flex justify-between gap-3">
                    <span>{sv.name}</span>
                    <span className="font-medium text-gray-700">{formatCurrency(sv.basePrice)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 pt-1 border-t border-gray-200">
                Total base: {formatCurrency(getServicesTotal(getApptServices(completeTarget)))}
              </p>
            </div>
            {isAdmin && completeTarget.client?.phone && (
              <a
                href={buildWhatsAppLink(completeTarget, getApptServices(completeTarget))}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors"
              >
                <MessageCircle size={15} />
                Confirmar cita por WhatsApp
              </a>
            )}

            {/* Marca la cita como confirmada por la clienta. Equivale al check
                del listado del día; al confirmarla el estado de arriba cambia y
                este botón desaparece. */}
            {isAdmin && completeTarget.status === 'PENDING' && !completeTarget.confirmed && (
              <button
                type="button"
                onClick={() => setConfirmed(completeTarget, true)}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                <BadgeCheck size={15} />
                Confirmar
              </button>
            )}

            <Input label="Valor Real Pagado (COP) *" id="final-price" type="number" min="0" step="1" required
              value={completeForm.finalPricePaid}
              onChange={(e) => setCompleteForm({ ...completeForm, finalPricePaid: e.target.value })} />
            <PaymentSplitEditor parts={completeForm.payments} total={completeForm.finalPricePaid}
              onChange={(payments) => setCompleteForm({ ...completeForm, payments })} />
            <div className="flex gap-2 pt-2 justify-between">
              <Button type="button" variant="ghost"
                onClick={() => { setCompleteModal(false); openEdit(completeTarget); }}>
                <Pencil size={14} /> Editar cita
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={async () => {
                  if (!confirm('¿Cancelar esta cita?')) return;
                  try { await api.updateAppointment(completeTarget.id, { status: 'CANCELLED' }); setCompleteModal(false); loadAppointments(); }
                  catch (err) { alert(err.message); }
                }}>Cancelar cita</Button>
                <Button type="submit" disabled={completing}>{completing ? 'Procesando...' : 'Cobrar y Cerrar'}</Button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Details Modal */}
      <Modal isOpen={detailsModal} onClose={() => { setDetailsModal(false); setPayEditOpen(false); }} title="Detalles de la Cita" maxWidth="max-w-sm">
        {detailsTarget && (
          <div className="space-y-4">
            <AllergyAlert notes={detailsTarget.client?.notes} />
            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm"
              style={{ borderLeft: `4px solid ${resolveManicuristColor(detailsTarget.manicurist)}` }}>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Clienta:</span>
                <Link to={`/clients/${detailsTarget.clientId}`} className="font-medium text-gray-800 hover:text-blush-600 underline-offset-2 hover:underline">
                  {detailsTarget.client?.name}
                </Link>
              </div>
              {[
                ['Especialista', detailsTarget.manicurist?.name],
                ['Fecha',       formatDateTime(detailsTarget.date)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}:</span>
                  <span className="font-medium text-gray-800">{value}</span>
                </div>
              ))}
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Servicios:</span>
                <div className="text-right">
                  {getApptServices(detailsTarget).map((sv) => (
                    <div key={sv.id} className="font-medium text-gray-800">{sv.name}</div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Estado:</span>
                <StatusBadge status={detailsTarget.status} />
              </div>
              {detailsTarget.finalPricePaid != null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Cobrado:</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(detailsTarget.finalPricePaid)}</span>
                </div>
              )}
              {paymentPartsOf(detailsTarget).length > 0 && (
                <div className="flex justify-between items-start gap-4">
                  <span className="text-gray-500">Método:</span>
                  <div className="flex flex-col items-end gap-1">
                    {paymentPartsOf(detailsTarget).map((p, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <PaymentBadge method={p.method} />
                        {paymentPartsOf(detailsTarget).length > 1 && (
                          <span className="text-xs font-medium text-gray-600">{formatCurrency(p.amount)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {canEditPayment(detailsTarget) && !payEditOpen && (
              <Button type="button" variant="secondary" className="w-full justify-center" onClick={openPayEdit}>
                <Pencil size={14} /> Cambiar forma de pago
              </Button>
            )}

            {payEditOpen && (
              <form onSubmit={handlePayEdit} className="space-y-3 rounded-xl border border-blush-100 bg-blush-25 p-3">
                <p className="text-xs text-gray-500">
                  El total cobrado ({formatCurrency(detailsTarget.finalPricePaid)}) no cambia. Finanzas, cierres y
                  saldos se recalculan con la nueva forma de pago.
                </p>
                <PaymentSplitEditor parts={payEditParts} total={detailsTarget.finalPricePaid} onChange={setPayEditParts} />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setPayEditOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={payEditing}>{payEditing ? 'Guardando...' : 'Guardar'}</Button>
                </div>
              </form>
            )}

            {(detailsTarget.paymentLogs || []).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cambios de forma de pago</p>
                <ul className="space-y-1.5">
                  {detailsTarget.paymentLogs.map((log) => (
                    <li key={log.id} className="text-xs text-gray-500 bg-gray-50 rounded-lg px-2.5 py-2">
                      <span className="font-medium text-gray-700">{log.changedByName}</span> · {formatLogDate(log.createdAt)}
                      <div className="mt-0.5">
                        <span className="line-through">{describeParts(log.previous)}</span>
                        {' → '}
                        <span className="font-medium text-gray-700">{describeParts(log.next)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-2 justify-between">
              <Button type="button" variant="danger"
                onClick={() => { if (confirm('¿Eliminar esta cita?')) { handleDeleteAppt(detailsTarget.id); setDetailsModal(false); } }}>
                <Trash2 size={14} /> Eliminar
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDetailsModal(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
