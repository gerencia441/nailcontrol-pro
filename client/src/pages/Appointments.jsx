import { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle, XCircle, CalendarDays, Clock, UserCheck, Trash2, Pencil } from 'lucide-react';
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

function toLocalDateTimeInput(date) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const getAppointmentServices = (appt) =>
  appt?.services?.length ? appt.services : appt?.service ? [appt.service] : [];

const getServicesTotal = (items) =>
  items.reduce((sum, service) => sum + (Number(service.basePrice) || 0), 0);

const getServicesDuration = (items) =>
  items.reduce((sum, service) => sum + (Number(service.durationMinutes) || 0), 0);

const getServicesLabel = (items) =>
  items.length ? items.map((service) => service.name).join(' + ') : 'Sin servicios';

const EMPTY_APPT = {
  clientId: '',
  manicuristId: '',
  serviceIds: [],
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
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [completeModal, setCompleteModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE);
  const [completing, setCompleting] = useState(false);

  const [detailsModal, setDetailsModal] = useState(false);
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
    const basePrice = getServicesTotal(getAppointmentServices(appt));
    setCompleteTarget(appt);
    setCompleteForm({ finalPricePaid: String(basePrice), paymentMethod: 'CASH' });
    setCompleteModal(true);
  };

  const openCreate = () => {
    setEditId(null);
    setApptForm(EMPTY_APPT);
    setApptModal(true);
  };

  const openEdit = (appt) => {
    setEditId(appt.id);
    setApptForm({
      clientId: appt.clientId || appt.client?.id || '',
      manicuristId: appt.manicuristId || appt.manicurist?.id || '',
      serviceIds: getAppointmentServices(appt).map((service) => service.id),
      date: toLocalDateTimeInput(appt.date),
      isNewClient: false,
      newClientName: '',
      newClientPhone: '',
    });
    setApptModal(true);
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

  const handleSaveAppt = async (e) => {
    e.preventDefault();
    if (apptForm.serviceIds.length === 0) {
      alert('Selecciona al menos un servicio.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        manicuristId: apptForm.manicuristId,
        serviceIds: apptForm.serviceIds,
        date: apptForm.date,
      };

      if (editId) {
        await api.updateAppointment(editId, payload);
      } else if (apptForm.isNewClient) {
        payload.newClient = {
          name: apptForm.newClientName,
          phone: apptForm.newClientPhone,
        };
        await api.createAppointment(payload);
      } else {
        payload.clientId = apptForm.clientId;
        await api.createAppointment(payload);
      }
      setApptModal(false);
      setEditId(null);
      loadAppointments();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleService = (serviceId) => {
    setApptForm((current) => {
      const exists = current.serviceIds.includes(serviceId);
      return {
        ...current,
        serviceIds: exists
          ? current.serviceIds.filter((id) => id !== serviceId)
          : [...current.serviceIds, serviceId],
      };
    });
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

  const AppointmentCard = ({ appt, showActions = true }) => {
    const apptServices = getAppointmentServices(appt);
    const duration = getServicesDuration(apptServices);

    return (
    <div
      className="bg-white rounded-xl border border-pink-100 p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        if (appt.status === 'PENDING') {
          openComplete(appt);
        } else {
          setDetailsTarget(appt);
          setDetailsModal(true);
        }
      }}
    >
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
            {getServicesLabel(apptServices)} - {duration} min
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
          <div className="flex flex-col gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" onClick={() => openEdit(appt)}>
              <Pencil size={13} /> Editar
            </Button>
            <Button size="sm" onClick={() => openComplete(appt)}>
              <CheckCircle size={13} /> Finalizar
            </Button>
          <Button size="sm" variant="danger" onClick={() => handleCancel(appt.id)}>
            <XCircle size={13} /> Cancelar
          </Button>
        </div>
      )}
    </div>
    );
  };

  const selectedServices = services.filter((service) =>
    apptForm.serviceIds.includes(service.id)
  );
  const selectedServicesTotal = getServicesTotal(selectedServices);
  const selectedServicesDuration = getServicesDuration(selectedServices);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Citas</h1>
        <Button
          onClick={openCreate}
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
        title={editId ? 'Editar Cita' : 'Nueva Cita'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveAppt} className="space-y-4">
          <Input
            label="Fecha y Hora *"
            id="appt-date"
            type="datetime-local"
            value={apptForm.date}
            onChange={(e) => setApptForm({ ...apptForm, date: e.target.value })}
            required
          />

          {!editId && (
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
          )}

          {!editId && apptForm.isNewClient ? (
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
              disabled={Boolean(editId)}
            >
              <option value="">Seleccionar clienta...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-600">Servicios *</span>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-pink-200 bg-white divide-y divide-pink-50">
              {services.map((s) => (
                <label
                  key={s.id}
                  htmlFor={`appt-service-${s.id}`}
                  className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-pink-50"
                >
                  <input
                    id={`appt-service-${s.id}`}
                    type="checkbox"
                    checked={apptForm.serviceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="accent-pink-500"
                  />
                  <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                  <span className="text-xs font-medium text-emerald-600">
                    {formatCurrency(s.basePrice)}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{selectedServices.length} seleccionado(s)</span>
              <span>
                {selectedServicesDuration} min - {formatCurrency(selectedServicesTotal)}
              </span>
            </div>
          </div>

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
              {saving ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Cita'}
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
              <div className="text-gray-500">
                {getAppointmentServices(completeTarget).map((service) => (
                  <div key={service.id} className="flex justify-between gap-3">
                    <span>{service.name}</span>
                    <span>{formatCurrency(service.basePrice)}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                Total base: {formatCurrency(getServicesTotal(getAppointmentServices(completeTarget)))}
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

      {/* Appointment Details Modal */}
      <Modal
        isOpen={detailsModal}
        onClose={() => setDetailsModal(false)}
        title="Detalles de la Cita"
        maxWidth="max-w-sm"
      >
        {detailsTarget && (
          <div className="space-y-4">
            <div className="bg-pink-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Clienta:</span>
                <span className="font-medium text-gray-800">{detailsTarget.client?.name}</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-600">Servicios:</span>
                <div className="text-right">
                  {getAppointmentServices(detailsTarget).map((service) => (
                    <div key={service.id} className="font-medium text-gray-800">
                      {service.name}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Manicurista:</span>
                <span className="font-medium text-gray-800">{detailsTarget.manicurist?.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Fecha:</span>
                <span className="font-medium text-gray-800">{formatDateTime(detailsTarget.date)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Estado:</span>
                <StatusBadge status={detailsTarget.status} />
              </div>
              {detailsTarget.finalPricePaid != null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Valor Cobrado:</span>
                  <span className="font-medium text-emerald-600">{formatCurrency(detailsTarget.finalPricePaid)}</span>
                </div>
              )}
              {detailsTarget.paymentMethod && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Método:</span>
                  <PaymentBadge method={detailsTarget.paymentMethod} />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 justify-between">
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (confirm('¿Eliminar esta cita?')) {
                    handleDeleteAppt(detailsTarget.id);
                    setDetailsModal(false);
                  }
                }}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
              <Button type="button" variant="secondary" onClick={() => setDetailsModal(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
