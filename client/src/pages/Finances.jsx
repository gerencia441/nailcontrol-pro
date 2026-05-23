import { useEffect, useState } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import { PaymentBadge } from '../components/ui/Badge.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(v || 0);

const formatDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', {
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
  type: 'EXPENSE',
  amount: '',
  description: '',
  date: toLocalDateInput(new Date()),
  paymentMethod: '',
};

const paymentLabels = {
  CASH: 'Efectivo',
  BANCOLOMBIA: 'Bancolombia',
  NEQUI: 'Nequi',
  UNKNOWN: 'Sin metodo',
};

function SummaryCard({ title, value, tone = 'neutral' }) {
  const tones = {
    income: 'text-emerald-600',
    expense: 'text-red-500',
    neutral: 'text-gray-800',
    commission: 'text-purple-600',
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function ReportView({ report }) {
  if (!report) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard title="Total Ingresos" value={formatCurrency(report.totalIncome)} tone="income" />
        <SummaryCard title="Total Egresos" value={formatCurrency(report.totalExpenses)} tone="expense" />
        <SummaryCard title="Neto" value={formatCurrency(report.net)} />
        <SummaryCard title="Comisiones" value={formatCurrency(report.totalCommissions)} tone="commission" />
        <SummaryCard
          title="Balance Final"
          value={formatCurrency(report.netAfterCommissions)}
          tone={report.netAfterCommissions >= 0 ? 'neutral' : 'expense'}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Ingresos por Metodo de Pago
          </h3>
          <div className="space-y-2">
            {Object.entries(report.byPaymentMethod).length === 0 ? (
              <p className="text-sm text-gray-400">Sin ingresos registrados.</p>
            ) : (
              Object.entries(report.byPaymentMethod).map(([method, amount]) => (
                <div
                  key={method}
                  className="flex items-center justify-between py-2 border-b border-pink-50 last:border-0"
                >
                  <span className="text-sm text-gray-600">{paymentLabels[method] || method}</span>
                  <span className="font-semibold text-emerald-600">{formatCurrency(amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Citas del Periodo</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Pendientes</p>
              <p className="text-2xl font-bold text-gray-800">{report.appointmentStatus?.PENDING || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Completadas</p>
              <p className="text-2xl font-bold text-emerald-600">{report.appointmentStatus?.COMPLETED || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Canceladas</p>
              <p className="text-2xl font-bold text-red-500">{report.appointmentStatus?.CANCELLED || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Liquidacion de Manicuristas
        </h3>
        {report.manicuristLiquidation.length === 0 ? (
          <p className="text-sm text-gray-400">No hay citas completadas en este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pink-50">
                <th className="text-left py-2 font-medium text-gray-600">Manicurista</th>
                <th className="text-right py-2 font-medium text-gray-600">Citas</th>
                <th className="text-right py-2 font-medium text-gray-600">Total Cobrado</th>
                <th className="text-right py-2 font-medium text-gray-600">% Com.</th>
                <th className="text-right py-2 font-medium text-gray-600">Ganancias</th>
              </tr>
            </thead>
            <tbody>
              {report.manicuristLiquidation.map((m) => (
                <tr key={m.name} className="border-b border-pink-50 last:border-0">
                  <td className="py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="py-3 text-right text-gray-500">{m.appointmentCount}</td>
                  <td className="py-3 text-right text-gray-600">
                    {formatCurrency(m.totalBilled)}
                  </td>
                  <td className="py-3 text-right text-purple-600">
                    {m.commissionPercentage}%
                  </td>
                  <td className="py-3 text-right font-bold text-emerald-600">
                    {formatCurrency(m.commissionEarned)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm overflow-x-auto">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Transacciones</h3>
        {report.financeEntries.length === 0 ? (
          <p className="text-sm text-gray-400">No hay ingresos ni egresos en este periodo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pink-50">
                <th className="text-left py-2 font-medium text-gray-600">Fecha</th>
                <th className="text-left py-2 font-medium text-gray-600">Descripcion</th>
                <th className="text-left py-2 font-medium text-gray-600">Tipo</th>
                <th className="text-right py-2 font-medium text-gray-600">Monto</th>
              </tr>
            </thead>
            <tbody>
              {report.financeEntries.map((f) => (
                <tr key={f.id} className="border-b border-pink-50 last:border-0">
                  <td className="py-3 text-gray-500">{formatDate(f.date)}</td>
                  <td className="py-3 text-gray-700">{f.description}</td>
                  <td className="py-3 text-gray-500">
                    {f.type === 'INCOME' ? 'Ingreso' : 'Egreso'}
                  </td>
                  <td
                    className={`py-3 text-right font-semibold ${
                      f.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'
                    }`}
                  >
                    {f.type === 'INCOME' ? '+' : '-'}
                    {formatCurrency(f.amount)}
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
  const [tab, setTab] = useState('entries');
  const [finances, setFinances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [reportDate, setReportDate] = useState(toLocalDateInput(new Date()));
  const [weekDate, setWeekDate] = useState(toIsoWeekInput(new Date()));
  const [report, setReport] = useState(null);
  const [weekReport, setWeekReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [summaryType, setSummaryType] = useState('month');
  const [summaryForm, setSummaryForm] = useState({
    date: toLocalDateInput(new Date()),
    year: String(currentYear),
    month: currentMonth,
    dateFrom: toLocalDateInput(new Date()),
    dateTo: toLocalDateInput(new Date()),
  });
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const load = () =>
    api
      .getFinances()
      .then(setFinances)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createFinance({
        ...form,
        paymentMethod: form.paymentMethod || null,
      });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este registro?')) return;
    try {
      await api.deleteFinance(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleGenerateDayReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.getDayClose(reportDate);
      setReport(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleGenerateWeekReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.getWeekClose(isoWeekToDateInput(weekDate));
      setWeekReport(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setSummaryLoading(true);
    try {
      const params = { period: summaryType };
      if (summaryType === 'day' || summaryType === 'week') params.date = summaryForm.date;
      if (summaryType === 'month') {
        params.year = summaryForm.year;
        params.month = summaryForm.month;
      }
      if (summaryType === 'year') params.year = summaryForm.year;
      if (summaryType === 'custom') {
        params.dateFrom = summaryForm.dateFrom;
        params.dateTo = summaryForm.dateTo;
      }

      const data = await api.getFinanceSummary(params);
      setSummary(data);
    } catch (err) {
      alert(err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Finanzas</h1>
        {tab === 'entries' && (
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Nuevo Registro
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {[
          { key: 'entries', label: 'Registros' },
          { key: 'dayclose', label: 'Cierre del Dia' },
          { key: 'weekclose', label: 'Cierre Semanal' },
          { key: 'summary', label: 'Balance General' },
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

      {tab === 'entries' && (
        <div className="bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : finances.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No hay registros financieros.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-pink-50 bg-pink-50/50">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Descripcion</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Tipo</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Metodo</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Monto</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {finances.map((f) => (
                    <tr
                      key={f.id}
                      className="border-b border-pink-50 last:border-0 hover:bg-pink-50/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(f.date)}</td>
                      <td className="px-5 py-3 text-gray-700 max-w-xs truncate">
                        {f.description}
                      </td>
                      <td className="px-5 py-3">
                        {f.type === 'INCOME' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                            <TrendingUp size={13} /> Ingreso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                            <TrendingDown size={13} /> Egreso
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <PaymentBadge method={f.paymentMethod} />
                      </td>
                      <td
                        className={`px-5 py-3 text-right font-semibold ${
                          f.type === 'INCOME' ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {f.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(f.amount)}
                      </td>
                      <td className="px-5 py-3">
                        <Button variant="danger" size="sm" onClick={() => handleDelete(f.id)}>
                          <Trash2 size={13} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'dayclose' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm flex items-end gap-3 flex-wrap">
            <Input
              label="Fecha del Cierre"
              id="report-date"
              type="date"
              value={reportDate}
              onChange={(e) => {
                setReportDate(e.target.value);
                setReport(null);
              }}
              className="w-48"
            />
            <Button onClick={handleGenerateDayReport} disabled={reportLoading}>
              <BarChart3 size={16} />
              {reportLoading ? 'Generando...' : 'Generar Cierre'}
            </Button>
          </div>
          <ReportView report={report} />
        </div>
      )}

      {tab === 'weekclose' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm flex items-end gap-3 flex-wrap">
            <Input
              label="Semana"
              id="week-date"
              type="week"
              value={weekDate}
              onChange={(e) => {
                setWeekDate(e.target.value);
                setWeekReport(null);
              }}
              className="w-48"
            />
            <Button onClick={handleGenerateWeekReport} disabled={reportLoading}>
              <BarChart3 size={16} />
              {reportLoading ? 'Generando...' : 'Generar Cierre Semanal'}
            </Button>
          </div>
          {weekReport && (
            <p className="text-sm text-gray-500">
              Semana: {weekReport.dateFrom} a {weekReport.dateTo}
            </p>
          )}
          <ReportView report={weekReport} />
        </div>
      )}

      {tab === 'summary' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-5 border border-pink-50 shadow-sm flex items-end gap-3 flex-wrap">
            <Select
              label="Periodo"
              id="summary-period"
              value={summaryType}
              onChange={(e) => {
                setSummaryType(e.target.value);
                setSummary(null);
              }}
              className="w-44"
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Ano</option>
              <option value="custom">Rango</option>
            </Select>

            {(summaryType === 'day' || summaryType === 'week') && (
              <Input
                label="Fecha"
                id="summary-date"
                type="date"
                value={summaryForm.date}
                onChange={(e) => setSummaryForm({ ...summaryForm, date: e.target.value })}
                className="w-48"
              />
            )}

            {(summaryType === 'month' || summaryType === 'year') && (
              <Input
                label="Ano"
                id="summary-year"
                type="number"
                value={summaryForm.year}
                onChange={(e) => setSummaryForm({ ...summaryForm, year: e.target.value })}
                className="w-32"
              />
            )}

            {summaryType === 'month' && (
              <Select
                label="Mes"
                id="summary-month"
                value={summaryForm.month}
                onChange={(e) => setSummaryForm({ ...summaryForm, month: e.target.value })}
                className="w-40"
              >
                {[
                  ['01', 'Enero'],
                  ['02', 'Febrero'],
                  ['03', 'Marzo'],
                  ['04', 'Abril'],
                  ['05', 'Mayo'],
                  ['06', 'Junio'],
                  ['07', 'Julio'],
                  ['08', 'Agosto'],
                  ['09', 'Septiembre'],
                  ['10', 'Octubre'],
                  ['11', 'Noviembre'],
                  ['12', 'Diciembre'],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}

            {summaryType === 'custom' && (
              <>
                <Input
                  label="Desde"
                  id="summary-from"
                  type="date"
                  value={summaryForm.dateFrom}
                  onChange={(e) => setSummaryForm({ ...summaryForm, dateFrom: e.target.value })}
                  className="w-48"
                />
                <Input
                  label="Hasta"
                  id="summary-to"
                  type="date"
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
            <p className="text-sm text-gray-500">
              Periodo: {summary.dateFrom} a {summary.dateTo}
            </p>
          )}
          <ReportView report={summary} />
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nuevo Registro Financiero"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Tipo *"
            id="fin-type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option value="INCOME">Ingreso</option>
            <option value="EXPENSE">Egreso</option>
          </Select>
          <Input
            label="Descripcion *"
            id="fin-desc"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
            placeholder="Ej: Compra de insumos"
          />
          <Input
            label="Monto (COP) *"
            id="fin-amount"
            type="number"
            min="0"
            step="1000"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
            placeholder="50000"
          />
          <Input
            label="Fecha *"
            id="fin-date"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
          <Select
            label="Metodo de Pago"
            id="fin-payment"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
          >
            <option value="">Ninguno</option>
            <option value="CASH">Efectivo</option>
            <option value="BANCOLOMBIA">Bancolombia</option>
            <option value="NEQUI">Nequi</option>
          </Select>
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
