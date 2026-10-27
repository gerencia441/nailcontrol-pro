import { Plus, X } from 'lucide-react';

// Editor de la forma de pago de una cita: una sola forma por el total, o el
// pago dividido en varias (máx. 3, igual que server/src/lib/payments.js).
// `parts` = [{ method, amount }]. Con una sola parte el monto sigue al total.

export const PAYMENT_OPTIONS = [
  { value: 'CASH',        label: 'Efectivo' },
  { value: 'BANCOLOMBIA', label: 'Bancolombia' },
  { value: 'NEQUI',       label: 'Nequi' },
];
export const paymentLabel = (m) => PAYMENT_OPTIONS.find((o) => o.value === m)?.label || m;
const MAX_PARTS = 3;

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

// Partes listas para enviar: con una sola, su monto es el total.
export function normalizeParts(parts, total) {
  if (parts.length === 1) return [{ method: parts[0].method, amount: Number(total) || 0 }];
  return parts.map((p) => ({ method: p.method, amount: Number(p.amount) || 0 }));
}

// Mensaje de error si las partes no cuadran con el total, o null.
export function partsError(parts, total) {
  const norm = normalizeParts(parts, total);
  if (norm.some((p) => p.amount <= 0)) return 'Cada forma de pago debe tener un monto mayor que 0.';
  const diff = (Number(total) || 0) - norm.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(diff) > 0.5) {
    return diff > 0 ? `Faltan ${formatCurrency(diff)} por asignar.` : `Sobran ${formatCurrency(-diff)}.`;
  }
  return null;
}

const selectCls = 'flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blush-300';
const inputCls  = 'w-32 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blush-300';

export default function PaymentSplitEditor({ parts, total, onChange }) {
  const split = parts.length > 1;
  const setPart = (i, patch) => onChange(parts.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPart = () => {
    // La nueva parte arranca con lo que falte por asignar y otra forma de pago.
    const norm = normalizeParts(parts, total);
    const assigned = split ? norm.reduce((s, p) => s + p.amount, 0) : 0;
    const used = new Set(parts.map((p) => p.method));
    const method = PAYMENT_OPTIONS.find((o) => !used.has(o.value))?.value || 'CASH';
    const base = split ? parts : [{ ...parts[0], amount: '' }];
    onChange([...base, { method, amount: split ? String(Math.max(0, (Number(total) || 0) - assigned)) : '' }]);
  };
  const removePart = (i) => onChange(parts.filter((_, j) => j !== i));

  const error = split ? partsError(parts, total) : null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {split ? 'Formas de pago *' : 'Método de pago *'}
      </span>
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <select className={selectCls} value={p.method} aria-label={`Forma de pago ${i + 1}`}
            onChange={(e) => setPart(i, { method: e.target.value })}>
            {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {split && (
            <>
              <input className={inputCls} type="number" min="1" step="1" inputMode="numeric" required
                aria-label={`Monto ${i + 1}`} placeholder="Monto" value={p.amount}
                onChange={(e) => setPart(i, { amount: e.target.value })} />
              <button type="button" onClick={() => removePart(i)} title="Quitar"
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                <X size={14} />
              </button>
            </>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 text-xs">
        {parts.length < MAX_PARTS ? (
          <button type="button" onClick={addPart} className="inline-flex items-center gap-1 font-medium text-blush-500 hover:text-blush-600">
            <Plus size={12} /> {split ? 'Agregar otra forma de pago' : 'Dividir pago'}
          </button>
        ) : <span />}
        {split && (
          <span className={error ? 'text-red-500 font-medium' : 'text-emerald-600 font-medium'}>
            {error || `Total ${formatCurrency(total)} ✓`}
          </span>
        )}
      </div>
    </div>
  );
}
