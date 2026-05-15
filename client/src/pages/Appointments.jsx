import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, CalendarDays, Clock, UserCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { StatusBadge, PaymentBadge } from '../components/ui/Badge.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0);

const formatDateTime = (d) =>
  new Date(d).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function toLocalDateInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const EMPTY_APPT = {
  clientId: '',
  manicuristId: '',
  serviceId: '',
  date: '',
  isNewClient: false,
  newClientName: '',
  newClientPhone: '',
};

const EMPTY_COMPLETE = { finalPricePaid: '', paymentMethod: 'CASH' };

export default function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [pending, setPending] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [manicurists, setManicurists] = useState([]);
  const [selectedDate, setSelectedDate] = useState(toLocalDateInput(new Date()));
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('calendar');

  const [apptModal, setApptModal] = useState(false);
  const [apptForm, setApptForm] = useState(EMPTY_APPT);
  const [saving, setSaving] = useState(false);

  const [completeModal, setCompleteModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE);
  const [completing, setCompleting] = useState(false);

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

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    Promise.all([api.getClients(), api.getServices(), api.getManicurists()]).then(
      ([c, s, m]) => {
        setClients(c);
        setServices(s);
        setManicurists(m);
      }
    );
  }, []);

  const openComplete = (appt) => {
    const basePrice = appt.service?.basePrice || 0;
    setCompleteTarget(appt);
    setCompleteForm({ finalPricePaid: String(basePrice), paymentMethod: 'CASH' });
    setCompleteModal(true);
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setCompleting(true);
    try {
      await api.completeAppointment(completeTarget.id, completeForm);
      setCompleteModal(false);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('¿Cancelar esta cita?')) return;
    try {
      await api.updateAppointment(id, { status: 'CANCELLED' });
      loadAppointments();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateAppt = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        manicuristId: apptForm.manicuristId,
        serviceId: apptForm.serviceId,
        date: apptForm.date,
      };
      if (apptForm.isNewClient) {
        payload.newClient = {
          name: apptForm.newClientName,
          phone: apptForm.newClientPhone,
        };
      } else {
        payload.clientId = apptForm.clientId;
      }
      await api.createAppointment(payload);
      setApptModal(false);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAppt = async (id) => {
    if (!confirm('¿Eliminar esta cita?')) return;
    try {
      await api.deleteAppointment(id);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    }
  };

  const AppointmentCard = ({ appt, showActions = true }) => (
    <div className="bg-white rounded-xl border border-pink-100 p-4 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-gray-800 text-sm">{appt.client?.name}</p>
          <StatusBadge status={appt.status} />
          {appt.paymentMethod && <PaymentBadge method={appt.paymentMethod} />}
        </div>
        <div className="mt-1 space-y-0.5">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <CalendarDays size={12} />
            {formatDateTime(appt.date)}
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock size={12} />
            {appt.service?.name} — {appt.service?.durationMinutes} min
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <UserCheck size={12} />
            {appt.manicurist?.name}
          </p>
          {appt.finalPricePaid != null && (
            <p className="text-xs font-medium text-emerald-600">
              Cobrado: {formatCurrency(appt.finalPricePaid)}
            </p>
          )}
        </div>
      </div>
      {showActions && appt.status === 'PENDING' && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <Button size="sm" onClick={() => openComplete(appt)}>
            <CheckCircle size={13} /> Finalizar
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleCancel(appt.id)}>
            <XCircle size={13} /> Cancelar
          </Button>
        </div>
      )}
      {showActions && appt.status !== 'PENDING' && (
        <Button size="sm" variant="danger" onClick={() => handleDeleteAppt(appt.id)}>
          Eliminar
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Citas</h1>
        <Button
          onClick={() => {
            setApptForm(EMPTY_APPT);
            setApptModal(true);
          }}
        >
          <Plus size={16} /> Nueva Cita
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'calendar', label: 'Por Fecha' },
          { key: 'pending', label: `Pendientes (${pending.length})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-pink-500 text-white'
                : 'bg-white text-gray-500 border border-pink-100 hover:bg-pink-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-48"
            />
            <span className="text-sm text-gray-500">
              {loading ? 'Cargando...' : `${appointments.length} cita(s)`}
            </span>
          </div>
          <div className="space-y-3">
            {appointments.length === 0 && !loading ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-pink-50">
                No hay citas para esta fecha.
              </div>
            ) : (
              appointments.map((a) => <AppointmentCard key={a.id} appt={a} />)
            )}
          </div>
        </div>
      )}

      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm border border-pink-50">
              No hay citas pendientes.
            </div>
          ) : (
            pending.map((a) => <AppointmentCard key={a.id} appt={a} />)
          )}
        </div>
      )}

      {/* New Appointment Modal */}
      <Modal
        isOpen={apptModal}
        onClose={() => setApptModal(false)}
        title="Nueva Cita"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreateAppt} className="space-y-4">
          <Input
            label="Fecha y Hora *"
            id="appt-date"
            type="datetime-local"
            value={apptForm.date}
            onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })}
            required
          />

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-client-check"
              checked={apptForm.isNewClient}
              onChange={(e) =>
                setApptForm({ ...apptForm, isNewClient: e.target.checked, clientId: '' })
              }
              className="accent-pink-500"
            />
            <label htmlFor="new-client-check" className="text-xs font-medium text-gray-600">
              Crear nueva clienta
            </label>
          </div>

          {apptForm.isNewClient ? (
            <div className="space-y-3 pl-2 border-l-2 border-pink-200">
              <Input
                label="Nombre de la clienta *"
                id="new-client-name"
                value={apptForm.newClientName}
                onChange={(e) => setApptForm({ ...apptForm, newClientName: e.target.value })}
                required={apptForm.isNewClient}
                placeholder="Nombre completo"
              />
              <Input
                label="Teléfono"
                id="new-client-phone"
                value={apptForm.newClientPhone}
                onChange={(e) => setApptForm({ ...apptForm, newClientPhone: e.target.value })}
                placeholder="300 000 0000"
              />
            </div>
          ) : (
            <Select
              label="Clienta *"
              id="appt-client"
              value={apptForm.clientId}
              onChange={(e) => setApptForm({ ...apptForm, clientId: e.target.value })}
              required={!apptForm.isNewClient}
            >
              <option value="">Seleccionar clienta...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <Select
            label="Servicio *"
            id="appt-service"
            value={apptForm.serviceId}
            onChange={(e) => setApptForm({ ...apptForm, serviceId: e.target.value })}
            required
          >
            <option value="">Seleccionar servicio...</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {formatCurrency(s.basePrice)}
              </option>
            ))}
          </Select>

          <Select
            label="Manicurista *"
            id="appt-manicurist"
            value={apptForm.manicuristId}
            onChange={(e) => setApptForm({ ...apptForm, manicuristId: e.target.value })}
            required
          >
            <option value="">Seleccionar manicurista...</option>
            {manicurists.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.commissionPercentage}%)
              </option>
            ))}
          </Select>

          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setApptModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Crear Cita'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Complete Service Modal */}
      <Modal
        isOpen={completeModal}
        onClose={() => setCompleteModal(false)}
        title="Finalizar Servicio"
        maxWidth="max-w-sm"
      >
        {completeTarget && (
          <form onSubmit={handleComplete} className="space-y-4">
            <div className="bg-pink-50 rounded-xl p-3 text-sm space-y-1">
              <p className="font-medium text-gray-700">{completeTarget.client?.name}</p>
              <p className="text-gray-500">{completeTarget.service?.name}</p>
              <p className="text-xs text-gray-400">
                Precio base: {formatCurrency(completeTarget.service?.basePrice)}
              </p>
            </div>

            <Input
              label="Valor Real Pagado (COP) *"
              id="final-price"
              type="number"
              min="0"
              step="1000"
              value={completeForm.finalPricePaid}
              onChange={(e) =>
                setCompleteForm({ ...completeForm, finalPricePaid: e.target.value })
              }
              required
            />

            <Select
              label="Método de Pago *"
              id="payment-method"
              value={completeForm.paymentMethod}
              onChange={(e) =>
                setCompleteForm({ ...completeForm, paymentMethod: e.target.value })
              }
              required
            >
              <option value="CASH">Efectivo</option>
              <option value="BANCOLOMBIA">Bancolombia</option>
              <option value="NEQUI">Nequi</option>
            </Select>

            <div className="flex gap-2 pt-2 justify-end">
              <Button type="button" variant="secondary" onClick={() => setCompleteModal(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={completing}>
                {completing ? 'Procesando...' : 'Cobrar y Cerrar'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
