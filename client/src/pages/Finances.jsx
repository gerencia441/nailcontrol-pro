import { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, BarChart3, Landmark, Wallet, CreditCard } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { PaymentBadge } from '../components/ui/Badge.jsx';
import { useAuth } from '../lib/AuthContext.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
  });

function toLocalDateInput(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(date));
}

function toIsoWeekInput(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function isoWeekToDateInput(value) {
  const [yearPart, weekPart] = value.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

const EMPTY_FORM = {
  type: 'EXPENSE', amount: '', description: '',
  date: toLocalDateInput(new Date()), paymentMethod: '',
};

const paymentLabels = {
  CASH: 'Efectivo', BANCOLOMBIA: 'Bancolombia', NEQUI: 'Nequi', UNKNOWN: 'Sin método',
};

function SummaryCard({ title, value, tone = 'neutral' }) {
  const tones = {
    income: 'text-emerald-600', expense: 'text-blush-600',
    neutral: 'text-gray-800',  commission: 'text-mauve-600',
  };
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function ReportView({ report, isAdmin, pendingCommissions = [], onPayCommission }) {
  if (!report) return null;

  const myData = !isAdmin && report.manicuristLiquidation?.[0];
  const pendingMap = Object.fromEntries(pendingCommissions.map((p) => [p.id, p]));

  if (!isAdmin) {
    // Vista manicurista: solo sus ingresos y su comisión
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard title="Mis Ingresos"  value={formatCurrency(report.totalIncome)} tone="income" />
          <SummaryCard title="Mi Comisión"   value={formatCurrency(report.totalCommissions)} tone="commission" />
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
          <h3 className="section-title mb-3">Mis Citas del Periodo</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Pendientes',  value: report.appointmentStatus?.PENDING   || 0, cls: 'text-amber-500'   },
              { label: 'Completadas', value: report.appointmentStatus?.COMPLETED  || 0, cls: 'text-emerald-600' },
              { label: 'Canceladas',  value: report.appointmentStatus?.CANCELLED  || 0, cls: 'text-blush-500'   },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {myData && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
            <h3 className="section-title mb-3">Mi Liquidación</h3>
            <div className="space-y-1 text-sm max-w-sm">
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Total cobrado ({myData.appointmentCount} citas)</span>
                <span className="font-semibold text-gray-700">{formatCurrency(myData.totalBilled)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500">Mi comisión ({myData.commissionPercentage}%)</span>
                <span className="font-bold text-mauve-600">{formatCurrency(myData.commissionEarned)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card overflow-x-auto">
          <h3 className="section-title mb-3">Mis Transacciones</h3>
          {report.financeEntries.length === 0 ? (
            <p className="text-sm text-gray-400">No hay ingresos en este periodo.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 table-header">Fecha</th>
                  <th className="text-left py-2 table-header">Descripción</th>
                  <th className="text-right py-2 table-header">Monto</th>
                </tr>
              </thead>
              <tbody>
                {report.financeEntries.map((f) => (
                  <tr key={f.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 text-gray-400 text-xs">{formatDate(f.date)}</td>
                    <td className="py-3 text-gray-700">{f.description}</td>
                    <td className="py-3 text-right font-semibold text-emerald-600">+{formatCurrency(f.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Vista administrador: reporte completo
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <SummaryCard title="Total Ingresos"   value={formatCurrency(report.totalIncome)}           tone="income"     />
        <SummaryCard title="Total Egresos"    value={formatCurrency(report.totalExpenses)}          tone="expense"    />
        <SummaryCard title="Neto bruto"       value={formatCurrency(report.net)}                                      />
        <SummaryCard title="Comisiones"       value={formatCurrency(report.totalCommissions)}       tone="commission" />
        <SummaryCard title="Saldo del Salón"  value={formatCurrency(report.netAfterCommissions)}
          tone={report.netAfterCommissions >= 0 ? 'neutral' : 'expense'} />
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
        <h3 className="section-title mb-4">Desglose de Cuentas</h3>
        <div className="space-y-1 text-sm max-w-md">
          <div className="flex justify-between py-1.5">
            <span className="text-gray-500">Ingresos totales</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(report.totalIncome)}</span>
          </div>
          {report.totalExpenses > 0 && (
            <div className="flex justify-between py-1.5">
              <span className="text-gray-500">(-) Egresos</span>
              <span className="font-semibold text-blush-500">-{formatCurrency(report.totalExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between py-1.5 border-t border-gray-100 mt-1">
            <span className="text-gray-700 font-medium">= Neto bruto</span>
            <span className="font-bold text-gray-800">{formatCurrency(report.net)}</span>
          </div>
          {report.manicuristLiquidation.length > 0 && (
            <>
              <div className="flex justify-between pt-3 pb-1">
                <span className="text-gray-500">(-) Comisiones a pagar</span>
                <span className="font-semibold text-mauve-600">-{formatCurrency(report.totalCommissions)}</span>
              </div>
              {report.manicuristLiquidation.map((m) => (
                <div key={m.name} className="flex justify-between py-1 pl-4 text-xs">
                  <span className="text-gray-400">{m.name} ({m.commissionPercentage}%)</span>
                  <span className="text-mauve-500">-{formatCurrency(m.commissionEarned)}</span>
                </div>
              ))}
            </>
          )}
          <div className="flex justify-between py-2.5 border-t-2 border-gray-200 mt-2">
            <span className="font-bold text-gray-900">= Saldo del Salón</span>
            <span className={`text-lg font-bold ${report.netAfterCommissions >= 0 ? 'text-gray-900' : 'text-blush-600'}`}>
              {formatCurrency(report.netAfterCommissions)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
          <h3 className="section-title mb-3">Ingresos por Método de Pago</h3>
          <div className="space-y-2">
            {Object.entries(report.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-gray-400">Sin ingresos registrados.</p>
            ) : (
              Object.entries(report.byPaymentMethod).map(([method, amount]) => (
                <div key={method} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{paymentLabels[method] || method}</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
          <h3 className="section-title mb-3">Citas del Periodo</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Pendientes',  value: report.appointmentStatus?.PENDING   || 0, cls: 'text-amber-500'   },
              { label: 'Completadas', value: report.appointmentStatus?.COMPLETED  || 0, cls: 'text-emerald-600' },
              { label: 'Canceladas',  value: report.appointmentStatus?.CANCELLED  || 0, cls: 'text-blush-500'   },
            ].map(({ label, value, cls }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                <p className={`text-2xl font-bold ${cls}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card overflow-x-auto">
        <h3 className="section-title mb-3">Liquidación de Manicuristas</h3>
        {report.manicuristLiquidation.length === 0 ? (
          <p className="text-sm text-gray-400">No hay citas completadas en este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 table-header">Manicurista</th>
                <th className="text-right py-2 table-header">Citas</th>
                <th className="text-right py-2 table-header">Total cobrado</th>
                <th className="text-right py-2 table-header">% Com.</th>
                <th className="text-right py-2 table-header">Este periodo</th>
                <th className="text-right py-2 table-header">Acumulado</th>
                <th className="text-right py-2 table-header">Salón retiene</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {report.manicuristLiquidation.map((m) => {
                const pc = pendingMap[m.id];
                return (
                  <tr key={m.name} className="border-b border-gray-50 last:border-0">
                    <td className="py-3 font-semibold text-gray-800">
                      <div className="flex items-center gap-2">
                        {m.color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />}
                        {m.name}
                      </div>
                    </td>
                    <td className="py-3 text-right text-gray-500">{m.appointmentCount}</td>
                    <td className="py-3 text-right text-gray-600">{formatCurrency(m.totalBilled)}</td>
                    <td className="py-3 text-right text-mauve-600">{m.commissionPercentage}%</td>
                    <td className="py-3 text-right font-bold text-mauve-600">{formatCurrency(m.commissionEarned)}</td>
                    <td className="py-3 text-right">
                      {pc ? (
                        <span className={`font-bold ${pc.pending > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {formatCurrency(pc.pending)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 text-right font-bold text-emerald-600">{formatCurrency(m.totalBilled - m.commissionEarned)}</td>
                    <td className="py-3 text-right">
                      {pc && pc.pending > 0 && onPayCommission && (
                        <button
                          onClick={() => onPayCommission(pc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-mauve-50 text-mauve-700 text-xs font-semibold hover:bg-mauve-100 transition-colors"
                        >
                          <CreditCard size={11} /> Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {report.manicuristLiquidation.length > 1 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="py-2.5 font-bold text-gray-700 text-xs uppercase tracking-wide" colSpan={5}>Total</td>
                  <td className="py-2.5 text-right font-bold text-amber-600">
                    {formatCurrency(pendingCommissions.reduce((s, p) => s + p.pending, 0))}
                  </td>
                  <td className="py-2.5 text-right font-bold text-emerald-600">{formatCurrency(report.totalIncome - report.totalCommissions)}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card overflow-x-auto">
        <h3 className="section-title mb-3">Transacciones</h3>
        {report.financeEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No hay ingresos ni egresos en este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 table-header">Fecha</th>
                <th className="text-left py-2 table-header">Descripción</th>
                <th className="text-left py-2 table-header">Tipo</th>
                <th className="text-right py-2 table-header">Monto</th>
              </tr>
            </thead>
            <tbody>
              {report.financeEntries.map((f) => (
                <tr key={f.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 text-gray-400 text-xs">{formatDate(f.date)}</td>
                  <td className="py-3 text-gray-700">
                    <div className="flex items-center gap-2">
                      {f.manicuristColor && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: f.manicuristColor }} />
                      )}
                      {f.description}
                    </div>
                  </td>
                  <td className="py-3 text-gray-500">{f.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</td>
                  <td className={`py-3 text-right font-semibold ${f.type === 'INCOME' ? 'text-emerald-600' : 'text-blush-500'}`}>
                    {f.type === 'INCOME' ? '+' : '-'}{formatCurrency(f.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function Finances() {
  const { isAdmin } = useAuth();
  const [tab,        setTab]        = useState('entries');
  const [finances,   setFinances]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);

  const [reportDate,    setReportDate]    = useState(toLocalDateInput(new Date()));
  const [weekDate,      setWeekDate]      = useState(toIsoWeekInput(new Date()));
  const [report,        setReport]        = useState(null);
  const [weekReport,    setWeekReport]    = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const currentYear  = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [summaryType, setSummaryType] = useState('month');
  const [summaryForm, setSummaryForm] = useState({
    date: toLocalDateInput(new Date()), year: String(currentYear), month: currentMonth,
    dateFrom: toLocalDateInput(new Date()), dateTo: toLocalDateInput(new Date()),
  });
  const [summary,        setSummary]        = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [balances,            setBalances]            = useState(null);
  const [pendingCommissions,  setPendingCommissions]  = useState([]);
  const [payModal,            setPayModal]            = useState(null); // { id, name, color, pending }
  const [payForm,             setPayForm]             = useState({ amount: '', paymentMethod: 'CASH' });
  const [paying,              setPaying]              = useState(false);

  const load = () => api.getFinances().then(setFinances).finally(() => setLoading(false));
  const loadBalances = () => api.getBalances().then(setBalances).catch(() => {});
  const loadPending  = () => api.getPendingCommissions().then(setPendingCommissions).catch(() => {});

  useEffect(() => { load(); }, []);
  useEffect(() => { if (isAdmin) { loadBalances(); loadPending(); } }, [isAdmin]);

  const openPayModal = (pc) => {
    setPayModal(pc);
    setPayForm({ amount: String(Math.round(pc.pending)), paymentMethod: 'CASH' });
  };

  const handlePayCommission = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await api.payCommission({
        manicuristId:  payModal.id,
        amount:        parseFloat(payForm.amount),
        paymentMethod: payForm.paymentMethod,
      });
      setPayModal(null);
      load();
      loadBalances();
      loadPending();
    } catch (err) { alert(err.message); }
    finally { setPaying(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createFinance({ ...form, paymentMethod: form.paymentMethod || null });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load();
      loadBalances();
      loadPending();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este registro?')) return;
    try { await api.deleteFinance(id); load(); loadBalances(); loadPending(); }
    catch (err) { alert(err.message); }
  };

  const handleGenerateDayReport = async () => {
    setReportLoading(true);
    try { setReport(await api.getDayClose(reportDate)); }
    catch (err) { alert(err.message); }
    finally { setReportLoading(false); }
  };

  const handleGenerateWeekReport = async () => {
    setReportLoading(true);
    try { setWeekReport(await api.getWeekClose(isoWeekToDateInput(weekDate))); }
    catch (err) { alert(err.message); }
    finally { setReportLoading(false); }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const params = { period: summaryType };
      if (summaryType === 'day' || summaryType === 'week') params.date = summaryForm.date;
      if (summaryType === 'month' || summaryType === 'year') params.year = summaryForm.year;
      if (summaryType === 'month') params.month = summaryForm.month;
      if (summaryType === 'custom') { params.dateFrom = summaryForm.dateFrom; params.dateTo = summaryForm.dateTo; }
      setSummary(await api.getFinanceSummary(params));
    } catch (err) { alert(err.message); }
    finally { setSummaryLoading(false); }
  };

  const TABS = [
    { key: 'entries',   label: 'Registros'       },
    { key: 'dayclose',  label: 'Cierre del Día'  },
    { key: 'weekclose', label: 'Cierre Semanal'  },
    { key: 'summary',   label: 'Balance General' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="page-title">Finanzas</h1>
        {isAdmin && tab === 'entries' && (
          <Button onClick={() => setModalOpen(true)} className="self-start sm:self-auto">
            <Plus size={16} strokeWidth={2.5} /> Nuevo Registro
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1 shadow-card w-fit max-w-full overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              tab === key ? 'bg-brand-gradient text-white shadow-soft' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Entries tab */}
      {tab === 'entries' && isAdmin && balances && (
        <div className="grid grid-cols-1 gap-3">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 flex items-center justify-center flex-shrink-0">
              <Landmark size={19} className="text-sky-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saldo en Banco</p>
              <p className={`text-xl font-bold mt-0.5 ${balances.banco >= 0 ? 'text-sky-600' : 'text-blush-600'}`}>
                {formatCurrency(balances.banco)}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">Bancolombia + Nequi</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <Wallet size={19} className="text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saldo en Efectivo</p>
              <p className={`text-xl font-bold mt-0.5 ${balances.efectivo >= 0 ? 'text-emerald-600' : 'text-blush-600'}`}>
                {formatCurrency(balances.efectivo)}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">Efectivo</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'entries' && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : finances.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No hay registros financieros.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 table-header">Fecha</th>
                    <th className="text-left px-5 py-3 table-header">Descripción</th>
                    <th className="text-left px-5 py-3 table-header">Tipo</th>
                    <th className="text-left px-5 py-3 table-header">Método</th>
                    <th className="text-right px-5 py-3 table-header">Monto</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {finances.map((f) => (
                    <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(f.date)}</td>
                      <td className="px-5 py-3 text-gray-700 max-w-xs truncate">
                        <div className="flex items-center gap-2">
                          {f.manicuristColor && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0 inline-block" style={{ backgroundColor: f.manicuristColor }} />
                          )}
                          {f.description}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {f.type === 'INCOME' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-semibold">
                            <TrendingUp size={13} /> Ingreso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blush-500 text-xs font-semibold">
                            <TrendingDown size={13} /> Egreso
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3"><PaymentBadge method={f.paymentMethod} /></td>
                      <td className={`px-5 py-3 text-right font-semibold ${f.type === 'INCOME' ? 'text-emerald-600' : 'text-blush-500'}`}>
                        {f.type === 'INCOME' ? '+' : '-'}{formatCurrency(f.amount)}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3">
                          <Button variant="danger" size="sm" onClick={() => handleDelete(f.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Day close tab */}
      {tab === 'dayclose' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-end gap-3 flex-wrap">
            <Input
              label="Fecha del Cierre"
              id="report-date"
              type="date"
              value={reportDate}
              onChange={(e) => { setReportDate(e.target.value); setReport(null); }}
              className="w-48"
            />
            <Button onClick={handleGenerateDayReport} disabled={reportLoading}>
              <BarChart3 size={16} />
              {reportLoading ? 'Generando...' : 'Generar Cierre'}
            </Button>
          </div>
          <ReportView report={report} isAdmin={isAdmin} pendingCommissions={pendingCommissions} onPayCommission={openPayModal} />
        </div>
      )}

      {/* Week close tab */}
      {tab === 'weekclose' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-end gap-3 flex-wrap">
            <Input
              label="Semana"
              id="week-date"
              type="week"
              value={weekDate}
              onChange={(e) => { setWeekDate(e.target.value); setWeekReport(null); }}
              className="w-48"
            />
            <Button onClick={handleGenerateWeekReport} disabled={reportLoading}>
              <BarChart3 size={16} />
              {reportLoading ? 'Generando...' : 'Generar Cierre Semanal'}
            </Button>
          </div>
          {weekReport && (
            <p className="text-sm text-gray-400">Semana: {weekReport.dateFrom} a {weekReport.dateTo}</p>
          )}
          <ReportView report={weekReport} isAdmin={isAdmin} pendingCommissions={pendingCommissions} onPayCommission={openPayModal} />
        </div>
      )}

      {/* Summary tab */}
      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-end gap-3 flex-wrap">
            <Select
              label="Periodo"
              id="summary-period"
              value={summaryType}
              onChange={(e) => { setSummaryType(e.target.value); setSummary(null); }}
              className="w-44"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
              <option value="custom">Rango</option>
            </Select>

            {(summaryType === 'day' || summaryType === 'week') && (
              <Input
                label="Fecha" id="summary-date" type="date"
                value={summaryForm.date}
                onChange={(e) => setSummaryForm({ ...summaryForm, date: e.target.value })}
                className="w-48"
              />
            )}

            {(summaryType === 'month' || summaryType === 'year') && (
              <Input
                label="Año" id="summary-year" type="number"
                value={summaryForm.year}
                onChange={(e) => setSummaryForm({ ...summaryForm, year: e.target.value })}
                className="w-32"
              />
            )}

            {summaryType === 'month' && (
              <Select
                label="Mes" id="summary-month"
                value={summaryForm.month}
                onChange={(e) => setSummaryForm({ ...summaryForm, month: e.target.value })}
                className="w-40"
              >
                {[['01','Enero'],['02','Febrero'],['03','Marzo'],['04','Abril'],['05','Mayo'],
                  ['06','Junio'],['07','Julio'],['08','Agosto'],['09','Septiembre'],
                  ['10','Octubre'],['11','Noviembre'],['12','Diciembre']].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </Select>
            )}

            {summaryType === 'custom' && (
              <>
                <Input label="Desde" id="summary-from" type="date"
                  value={summaryForm.dateFrom}
                  onChange={(e) => setSummaryForm({ ...summaryForm, dateFrom: e.target.value })}
                  className="w-48"
                />
                <Input label="Hasta" id="summary-to" type="date"
                  value={summaryForm.dateTo}
                  onChange={(e) => setSummaryForm({ ...summaryForm, dateTo: e.target.value })}
                  className="w-48"
                />
              </>
            )}

            <Button onClick={handleGenerateSummary} disabled={summaryLoading}>
              <BarChart3 size={16} />
              {summaryLoading ? 'Generando...' : 'Generar Balance'}
            </Button>
          </div>

          {summary && (
            <p className="text-sm text-gray-400">Periodo: {summary.dateFrom} a {summary.dateTo}</p>
          )}
          <ReportView report={summary} isAdmin={isAdmin} pendingCommissions={pendingCommissions} onPayCommission={openPayModal} />
        </div>
      )}

      {/* Pay Commission Modal */}
      <Modal
        isOpen={!!payModal}
        onClose={() => setPayModal(null)}
        title="Pagar Comisión"
        maxWidth="max-w-sm"
      >
        {payModal && (
          <form onSubmit={handlePayCommission} className="space-y-4">
            {/* Encabezado con manicurista */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-mauve-50 border border-mauve-100">
              {payModal.color && (
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: payModal.color }} />
              )}
              <p className="text-sm font-semibold text-gray-800">{payModal.name}</p>
              <span className="ml-auto text-xs text-gray-400">{payModal.commissionPercentage}% comisión</span>
            </div>

            {/* Desglose del cálculo */}
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 text-sm overflow-hidden">
              <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50">
                <span className="text-gray-500">Total ganado (todos los servicios)</span>
                <span className="font-semibold text-gray-700">{formatCurrency(payModal.totalEarned)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5">
                <span className="text-gray-500">Ya pagado anteriormente</span>
                <span className="font-semibold text-emerald-600">− {formatCurrency(payModal.totalPaid)}</span>
              </div>
              <div className="flex justify-between items-center px-4 py-2.5 bg-amber-50">
                <span className="font-semibold text-amber-700">Pendiente de pago</span>
                <span className="font-bold text-amber-600">{formatCurrency(payModal.pending)}</span>
              </div>
            </div>

            <Input
              label="Monto a pagar (COP)"
              id="pay-amount"
              type="number"
              min="1"
              step="1"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Método de pago *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'CASH',        label: 'Efectivo', icon: <Wallet size={15} />,   ring: 'ring-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
                  { value: 'BANCOLOMBIA', label: 'Banco',    icon: <Landmark size={15} />, ring: 'ring-sky-400',     bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-400'     },
                ].map(({ value, label, icon, ring, bg, text, dot }) => {
                  const selected = payForm.paymentMethod === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPayForm({ ...payForm, paymentMethod: value })}
                      className={`relative flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        selected
                          ? `${bg} ${text} border-transparent ring-2 ${ring}`
                          : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {selected && <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />}
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setPayModal(null)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" disabled={paying} className="flex-1">
                <CreditCard size={14} />
                {paying ? 'Registrando...' : 'Confirmar Pago'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* New Finance Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo Registro Financiero"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Tipo *" id="fin-type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Egreso</option>
          </Select>
          <Input
            label="Descripción *" id="fin-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            placeholder="Ej: Compra de insumos"
          />
          <Input
            label="Monto (COP) *" id="fin-amount"
            type="number" min="0" step="1"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            placeholder="50000"
          />
          <Input
            label="Fecha *" id="fin-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <Select
            label="Método de Pago" id="fin-payment"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          >
            <option value="">Ninguno</option>
            <option value="CASH">Efectivo</option>
            <option value="BANCOLOMBIA">Bancolombia</option>
            <option value="NEQUI">Nequi</option>
          </Select>
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
