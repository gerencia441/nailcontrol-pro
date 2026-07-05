import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, Landmark, Wallet, Save } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

export default function Settings() {
  const [balanceForm, setBalanceForm] = useState({ base_banco: '', base_efectivo: '' });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((s) => {
        setBalanceForm({
          base_banco:    s.base_banco    ?? '0',
          base_efectivo: s.base_efectivo ?? '0',
        });
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, []);

  const handleSaveBalances = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api.updateSettings({
        base_banco:    String(parseFloat(balanceForm.base_banco)    || 0),
        base_efectivo: String(parseFloat(balanceForm.base_efectivo) || 0),
      });
      setSaved(true);
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

      {/* Saldos iniciales */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center flex-shrink-0">
            <Landmark size={19} className="text-sky-500" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Saldos Iniciales</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Define el punto de partida para el cálculo de saldo en banco y efectivo. El sistema suma o resta cada transacción registrada sobre estos valores base.
            </p>
          </div>
        </div>

        {loadingSettings ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : (
          <form onSubmit={handleSaveBalances} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-sky-50 border border-sky-100">
              <Landmark size={15} className="text-sky-400 flex-shrink-0" />
              <p className="text-xs text-sky-600 font-medium">
                Bancolombia + Nequi → Saldo en Banco
              </p>
            </div>
            <Input
              label="Saldo inicial en Banco (COP)"
              id="base-banco"
              type="number"
              min="0"
              step="1000"
              value={balanceForm.base_banco}
              onChange={(e) => setBalanceForm({ ...balanceForm, base_banco: e.target.value })}
              placeholder="0"
            />

            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <Wallet size={15} className="text-emerald-400 flex-shrink-0" />
              <p className="text-xs text-emerald-600 font-medium">
                Efectivo → Saldo en Efectivo
              </p>
            </div>
            <Input
              label="Saldo inicial en Efectivo (COP)"
              id="base-efectivo"
              type="number"
              min="0"
              step="1000"
              value={balanceForm.base_efectivo}
              onChange={(e) => setBalanceForm({ ...balanceForm, base_efectivo: e.target.value })}
              placeholder="0"
            />

            <div className="flex items-center gap-3 pt-1">
              <Button type="submit" disabled={saving}>
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar Saldos'}
              </Button>
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
