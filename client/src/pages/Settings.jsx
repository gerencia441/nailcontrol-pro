import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Landmark, Wallet, Save, RefreshCw } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

function formatTs(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function Settings() {
  const [balances, setBalances] = useState(null);
  const [form,     setForm]     = useState({ banco: '0', efectivo: '0' });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const loadBalances = () => {
    setLoading(true);
    api.getBalances()
      .then((b) => {
        setBalances(b);
        setForm({
          banco:    String(Math.round(b.banco    || 0)),
          efectivo: String(Math.round(b.efectivo || 0)),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadBalances(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({
        balance_banco:    String(parseFloat(form.banco)    || 0),
        balance_efectivo: String(parseFloat(form.efectivo) || 0),
      });
      setSaved(true);
      loadBalances();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="page-title">Ajustes</h1>
        <p className="text-sm text-gray-400 mt-0.5">Configuración de la aplicación</p>
      </div>

      {/* Saldos actuales */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center flex-shrink-0">
            <Landmark size={19} className="text-sky-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Saldos Actuales</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              El sistema calcula el saldo sumando los movimientos desde el último ajuste. Si el saldo calculado no coincide con el real, corrígelo aquí.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {/* Banco */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Landmark size={14} className="text-sky-400" />
                <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">Banco — Bancolombia + Nequi</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-sky-50 border border-sky-100">
                <span className="text-xs text-gray-500">Saldo calculado actualmente</span>
                <span className="font-bold text-sky-700">{formatCurrency(balances?.banco)}</span>
              </div>
              {balances?.bancoAt && (
                <p className="text-[11px] text-gray-400 pl-1">
                  Último ajuste: {formatTs(balances.bancoAt)}
                </p>
              )}
              <Input
                label="Saldo real en banco (COP)"
                id="balance-banco"
                type="number"
                step="1000"
                value={form.banco}
                onChange={(e) => setForm({ ...form, banco: e.target.value })}
              />
            </div>

            {/* Efectivo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet size={14} className="text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Efectivo</span>
              </div>
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-xs text-gray-500">Saldo calculado actualmente</span>
                <span className="font-bold text-emerald-700">{formatCurrency(balances?.efectivo)}</span>
              </div>
              {balances?.efectivoAt && (
                <p className="text-[11px] text-gray-400 pl-1">
                  Último ajuste: {formatTs(balances.efectivoAt)}
                </p>
              )}
              <Input
                label="Saldo real en efectivo (COP)"
                id="balance-efectivo"
                type="number"
                step="1000"
                value={form.efectivo}
                onChange={(e) => setForm({ ...form, efectivo: e.target.value })}
              />
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700 leading-relaxed">
              Al guardar, los valores ingresados se convierten en el nuevo punto de partida. Solo los movimientos registrados <strong>a partir de ese momento</strong> afectarán el saldo.
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar Ajuste'}
              </Button>
              <button
                type="button"
                onClick={loadBalances}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RefreshCw size={13} /> Recargar
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                  <CheckCircle2 size={15} /> Guardado
                </span>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Google Calendar */}
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
