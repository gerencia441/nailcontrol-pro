import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, Clock, UserCheck, Trash2, Pencil, ChevronLeft, ChevronRight, Calendar, MessageCircle } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import DateTimePicker from '../components/ui/DateTimePicker.jsx';
import { StatusBadge, PaymentBadge } from '../components/ui/Badge.jsx';
import { resolveManicuristColor, apptCardStyle } from '../lib/manicuristColors.js';

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
  const dynamic =
    `Nombre: ${appt.client?.name}\n` +
    `Día: ${dia}\n` +
    `Hora: ${hora}\n` +
    `Servicio: ${svcs}\n` +
    `Manicurista: ${appt.manicurist?.name}\n\n`;
  const staticEncoded =
    'Te%20estoy%20confirmando%20tu%20cita%20con%20estos%20datos%0A' +
    'Si%20deseas%20ajustar%20algo%2C%20estoy%20encantada%20de%20ayudarte';
  return `https://wa.me/${phone}?text=${encodeURIComponent(dynamic)}${staticEncoded}`;
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

const EMPTY_APPT    = { clientId: '', manicuristId: '', serviceIds: [], date: '', isNewClient: false, newClientName: '', newClientPhone: '' };
const EMPTY_COMPLETE = { finalPricePaid: '', paymentMethod: 'CASH' };

const STATUS_TABS = [
  { key: 'all',       label: 'Todas'      },
  { key: 'PENDING',   label: 'Pendientes' },
  { key: 'COMPLETED', label: 'Completadas'},
  { key: 'CANCELLED', label: 'Canceladas' },
];

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [pending,      setPending]      = useState([]);
  const [clients,      setClients]      = useState([]);
  const [services,     setServices]     = useState([]);
  const [manicurists,  setManicurists]  = useState([]);
  const [selectedDate, setSelectedDate] = useState(toLocalDateInput(new Date()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading,      setLoading]      = useState(false);
  const [tab,          setTab]          = useState('calendar');
  const [calOpen,      setCalOpen]      = useState(false);

  const [apptModal,  setApptModal]  = useState(false);
  const [apptForm,   setApptForm]   = useState(EMPTY_APPT);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);

  const [completeModal,  setCompleteModal]  = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm,   setCompleteForm]   = useState(EMPTY_COMPLETE);
  const [completing,     setCompleting]     = useState(false);

  const [detailsModal,  setDetailsModal]  = useState(false);
  const [detailsTarget, setDetailsTarget] = useState(null);

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
    setCompleteForm({ finalPricePaid: String(getServicesTotal(getApptServices(appt))), paymentMethod: 'CASH' });
    setCompleteModal(true);
  };

  const openCreate = () => { setEditId(null); setApptForm(EMPTY_APPT); setApptModal(true); };
  const openEdit   = (appt) => {
    setEditId(appt.id);
    setApptForm({
      clientId: appt.clientId || appt.client?.id || '',
      manicuristId: appt.manicuristId || appt.manicurist?.id || '',
      serviceIds: getApptServices(appt).map((s) => s.id),
      date: toLocalDateTimeInput(appt.date),
      isNewClient: false, newClientName: '', newClientPhone: '',
    });
    setApptModal(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault(); setCompleting(true);
    try { await api.completeAppointment(completeTarget.id, completeForm); setCompleteModal(false); loadAppointments(); }
    catch (err) { alert(err.message); }
    finally { setCompleting(false); }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    try { await api.updateAppointment(id, { status: 'CANCELLED' }); loadAppointments(); }
    catch (err) { alert(err.message); }
  };

  const handleSaveAppt = async (e) => {
    e.preventDefault();
    if (apptForm.serviceIds.length === 0) { alert('Selecciona al menos un servicio.'); return; }
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
    setApptForm((cur) => ({
      ...cur,
      serviceIds: cur.serviceIds.includes(id)
        ? cur.serviceIds.filter((s) => s !== id)
        : [...cur.serviceIds, id],
    }));
  };

  const handleDeleteAppt = async (id) => {
    if (!confirm('¿Eliminar esta cita?')) return;
    try { await api.deleteAppointment(id); loadAppointments(); }
    catch (err) { alert(err.message); }
  };

  const selectedServices      = services.filter((s) => apptForm.serviceIds.includes(s.id));
  const selectedServicesTotal = getServicesTotal(selectedServices);
  const selectedServicesDur   = getServicesDur(selectedServices);

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

          {/* Status filter — calendar tab only */}
          {tab === 'calendar' && (
            <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-card w-fit max-w-full overflow-x-auto">
              {STATUS_TABS.map(t => (
                <button key={t.key} onClick={() => setStatusFilter(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${statusFilter === t.key ? 'bg-brand-gradient text-white shadow-soft' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t.label}
                </button>
              ))}
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
                      <p className="text-sm font-semibold text-gray-800 truncate">{appt.client?.name}</p>
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
                          <button
                            onClick={() => openComplete(appt)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </>
                      )}
                      {appt.status !== 'PENDING' && (
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
              <Input label="Teléfono" id="new-client-phone" value={apptForm.newClientPhone} placeholder="300 000 0000"
                onChange={(e) => setApptForm({ ...apptForm, newClientPhone: e.target.value })} />
            </div>
          ) : (
            <Select label="Clienta *" id="appt-client" value={apptForm.clientId} required={!apptForm.isNewClient} disabled={Boolean(editId)}
              onChange={(e) => setApptForm({ ...apptForm, clientId: e.target.value })}>
              <option value="">Seleccionar clienta...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios *</span>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
              {services.map((s) => (
                <label key={s.id} htmlFor={`appt-svc-${s.id}`} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <input id={`appt-svc-${s.id}`} type="checkbox" checked={apptForm.serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)} className="accent-blush-500" />
                  <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                  <span className="text-xs font-semibold text-emerald-600">{formatCurrency(s.basePrice)}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>{selectedServices.length} seleccionado(s)</span>
              <span>{selectedServicesDur} min · {formatCurrency(selectedServicesTotal)}</span>
            </div>
          </div>

          <Select label="Manicurista *" id="appt-manicurist" value={apptForm.manicuristId} required
            onChange={(e) => setApptForm({ ...apptForm, manicuristId: e.target.value })}>
            <option value="">Seleccionar manicurista...</option>
            {manicurists.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.commissionPercentage}%)</option>)}
          </Select>

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
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5"
              style={{ borderLeft: `4px solid ${resolveManicuristColor(completeTarget.manicurist)}` }}>
              <p className="font-semibold text-gray-800">{completeTarget.client?.name}</p>
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
            {completeTarget.client?.phone && (
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

            <Input label="Valor Real Pagado (COP) *" id="final-price" type="number" min="0" step="1000" required
              value={completeForm.finalPricePaid}
              onChange={(e) => setCompleteForm({ ...completeForm, finalPricePaid: e.target.value })} />
            <Select label="Método de Pago *" id="payment-method" value={completeForm.paymentMethod} required
              onChange={(e) => setCompleteForm({ ...completeForm, paymentMethod: e.target.value })}>
              <option value="CASH">Efectivo</option>
              <option value="BANCOLOMBIA">Bancolombia</option>
              <option value="NEQUI">Nequi</option>
            </Select>
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
      <Modal isOpen={detailsModal} onClose={() => setDetailsModal(false)} title="Detalles de la Cita" maxWidth="max-w-sm">
        {detailsTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm"
              style={{ borderLeft: `4px solid ${resolveManicuristColor(detailsTarget.manicurist)}` }}>
              {[
                ['Clienta',     detailsTarget.client?.name],
                ['Manicurista', detailsTarget.manicurist?.name],
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
              {detailsTarget.paymentMethod && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Método:</span>
                  <PaymentBadge method={detailsTarget.paymentMethod} />
                </div>
              )}
            </div>
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
