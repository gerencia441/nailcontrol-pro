import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, AlertCircle, LayoutDashboard } from 'lucide-react';
import { publicApi } from '../../lib/publicApi.js';
import { isValidColombianPhone } from '../../lib/phone.js';
import { useAuth } from '../../lib/AuthContext.jsx';
import StepProgress from './StepProgress.jsx';
import StepServices from './StepServices.jsx';
import StepManicurist from './StepManicurist.jsx';
import StepDateTime from './StepDateTime.jsx';
import StepContact from './StepContact.jsx';
import StepConfirm from './StepConfirm.jsx';
import BookingSuccess from './BookingSuccess.jsx';
import { formatDuration } from './bookingFormat.js';

const EMPTY = {
  step: 1,
  serviceIds: [],
  manicuristId: 'any',
  date: '',
  time: '',
  name: '',
  phone: '',
  honeypot: '',
};

export default function BookingPortal() {
  const { user } = useAuth();

  const [form, setForm] = useState(EMPTY);
  const [config, setConfig] = useState(null);
  const [catalog, setCatalog] = useState({ services: [], manicurists: [] });
  const [bootError, setBootError] = useState('');
  const [booting, setBooting] = useState(true);

  const [availability, setAvailability] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const availabilityReq = useRef(0);
  const topRef = useRef(null);

  useEffect(() => {
    let alive = true;
    Promise.all([publicApi.getConfig(), publicApi.getCatalog()])
      .then(([cfg, cat]) => {
        if (!alive) return;
        setConfig(cfg);
        setCatalog(cat);
      })
      .catch((err) => alive && setBootError(err.message))
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, []);

  const selectedServices = catalog.services.filter((s) => form.serviceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

  const loadAvailability = useCallback(
    async (date, serviceIds, manicuristId) => {
      if (!date || serviceIds.length === 0) {
        setAvailability(null);
        return;
      }
      const reqId = ++availabilityReq.current;
      setLoadingAvailability(true);
      try {
        const data = await publicApi.getAvailability({ date, serviceIds, manicuristId });
        // Descarta respuestas que llegaron tarde y ya no corresponden.
        if (reqId === availabilityReq.current) setAvailability(data);
      } catch (err) {
        if (reqId === availabilityReq.current) {
          setAvailability(null);
          setSubmitError(err.message);
        }
      } finally {
        if (reqId === availabilityReq.current) setLoadingAvailability(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAvailability(form.date, form.serviceIds, form.manicuristId);
  }, [form.date, form.serviceIds, form.manicuristId, loadAvailability]);

  const scrollTop = () => topRef.current?.scrollIntoView({ block: 'start' });

  const toggleService = (id) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((x) => x !== id)
        : [...f.serviceIds, id],
      // Cambiar los servicios cambia la duración, así que el horario elegido
      // puede dejar de ser válido.
      time: '',
    }));
  };

  const canContinue = () => {
    switch (form.step) {
      case 1:
        return form.serviceIds.length > 0;
      case 2:
        return Boolean(form.manicuristId);
      case 3:
        return Boolean(form.date && form.time);
      case 4:
        return form.name.trim().length >= 2 && isValidColombianPhone(form.phone);
      default:
        return true;
    }
  };

  const validateContact = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Ingresa tu nombre completo.';
    if (!isValidColombianPhone(form.phone)) next.phone = 'Ingresa un celular de 10 dígitos.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    setSubmitError('');
    if (form.step === 4 && !validateContact()) return;
    setForm((f) => ({ ...f, step: Math.min(f.step + 1, 5) }));
    scrollTop();
  };

  const goBack = () => {
    setSubmitError('');
    setForm((f) => ({ ...f, step: Math.max(f.step - 1, 1) }));
    scrollTop();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const data = await publicApi.book({
        serviceIds: form.serviceIds,
        manicuristId: form.manicuristId,
        date: form.date,
        time: form.time,
        clientName: form.name.trim(),
        phone: form.phone,
        website: form.honeypot,
      });
      setResult(data);
    } catch (err) {
      setSubmitError(err.message);
      // Si alguien tomó el horario mientras confirmaba, se devuelve al paso de
      // fecha con la disponibilidad recién actualizada.
      if (err.code === 'SLOT_TAKEN' || err.code === 'TOO_SOON' || err.code === 'CLOSED_DAY') {
        setForm((f) => ({ ...f, step: 3, time: '' }));
        loadAvailability(form.date, form.serviceIds, form.manicuristId);
        scrollTop();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setForm(EMPTY);
    setAvailability(null);
    setErrors({});
    setSubmitError('');
  };

  const manicuristName =
    form.manicuristId === 'any'
      ? 'Cualquiera disponible'
      : catalog.manicurists.find((m) => m.id === form.manicuristId)?.name.trim() || '';

  return (
    <div className="min-h-dvh bg-[#F2F2F7] flex flex-col">
      <header className="bg-brand-gradient px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 text-white">
        <div className="max-w-lg mx-auto">
          <p className="font-display text-2xl leading-tight">Flor Catalán</p>
          <p className="text-sm text-white/80 mt-0.5">Reserva tu cita en línea</p>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto pb-4" ref={topRef}>
        {booting ? (
          <div className="px-5 py-10 space-y-3">
            <div className="h-6 w-40 rounded-lg bg-white animate-pulse" />
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
            <div className="h-24 rounded-2xl bg-white animate-pulse" />
          </div>
        ) : bootError ? (
          <div className="px-5 py-10 text-center">
            <AlertCircle size={28} className="mx-auto text-rose-400 mb-2" />
            <p className="text-sm text-gray-600">{bootError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 text-sm font-semibold text-blush-600 underline underline-offset-4"
            >
              Reintentar
            </button>
          </div>
        ) : result ? (
          <BookingSuccess result={result} onReset={reset} />
        ) : (
          <>
            <StepProgress step={form.step} />

            <div className="px-5 pt-4">
              {submitError && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl bg-rose-50 border border-rose-100 p-3">
                  <AlertCircle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-rose-700">{submitError}</p>
                </div>
              )}

              {form.step === 1 && (
                <StepServices
                  services={catalog.services}
                  selectedIds={form.serviceIds}
                  onToggle={toggleService}
                  loading={false}
                />
              )}

              {form.step === 2 && (
                <StepManicurist
                  manicurists={catalog.manicurists}
                  value={form.manicuristId}
                  onChange={(id) => setForm((f) => ({ ...f, manicuristId: id, time: '' }))}
                  loading={false}
                />
              )}

              {form.step === 3 && (
                <StepDateTime
                  config={config}
                  date={form.date}
                  time={form.time}
                  onPickDate={(d) => setForm((f) => ({ ...f, date: d, time: '' }))}
                  onPickTime={(t) => setForm((f) => ({ ...f, time: t }))}
                  availability={availability}
                  loadingAvailability={loadingAvailability}
                  totalDurationMinutes={totalDuration}
                />
              )}

              {form.step === 4 && (
                <StepContact
                  name={form.name}
                  phone={form.phone}
                  errors={errors}
                  onChangeName={(v) => setForm((f) => ({ ...f, name: v }))}
                  onChangePhone={(v) => setForm((f) => ({ ...f, phone: v }))}
                  honeypot={form.honeypot}
                  onChangeHoneypot={(v) => setForm((f) => ({ ...f, honeypot: v }))}
                />
              )}

              {form.step === 5 && (
                <StepConfirm
                  services={selectedServices}
                  manicuristName={manicuristName}
                  date={form.date}
                  time={form.time}
                  endTime={availability?.slots.find((s) => s.time === form.time)?.endTime}
                  totalDurationMinutes={totalDuration}
                  name={form.name.trim()}
                  phone={form.phone}
                />
              )}
            </div>
          </>
        )}
      </main>

      {!booting && !bootError && !result && (
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            {form.step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 min-h-[48px] px-4 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={16} />
                Atrás
              </button>
            )}

            {form.step < 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={!canContinue()}
                className="flex-1 min-h-[48px] rounded-xl bg-brand-gradient text-white text-base font-semibold shadow-soft transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {form.step === 1 && form.serviceIds.length > 0
                  ? `Continuar · ${formatDuration(totalDuration)}`
                  : 'Continuar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 min-h-[48px] rounded-xl bg-brand-gradient text-white text-base font-semibold shadow-soft transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Enviando…' : 'Confirmar reserva'}
              </button>
            )}
          </div>
        </div>
      )}

      <footer className="px-5 py-5 text-center">
        {user ? (
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600"
          >
            <LayoutDashboard size={13} />
            Ir al panel
          </Link>
        ) : (
          <Link to="/login" className="text-xs text-gray-400 hover:text-gray-600">
            Acceso manicuristas
          </Link>
        )}
      </footer>
    </div>
  );
}
