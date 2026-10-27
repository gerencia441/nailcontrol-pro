// Formas de pago de una cita completada. Cada parte del pago es un Finance
// INCOME enlazado a la cita (Finance.appointmentId): así los totales por forma
// de pago, los saldos de banco/efectivo y las comisiones pendientes (que suman
// registro por registro) funcionan igual con pago único o dividido.

const PAYMENT_METHODS = ['CASH', 'BANCOLOMBIA', 'NEQUI'];
const MAX_PAYMENT_PARTS = 3;
// Tolerancia para comparar sumas de dinero en pesos (vienen como Float).
const AMOUNT_EPSILON = 0.5;

// Normaliza las partes del pago. Acepta `payments: [{ method, amount }]` o, por
// compatibilidad, un único `paymentMethod` por el total. Las partes con la
// misma forma de pago se suman. Devuelve `{ error }` o `{ parts }`.
function parsePayments(body, total) {
  const raw = Array.isArray(body?.payments)
    ? body.payments
    : [{ method: body?.paymentMethod, amount: total }];

  if (raw.length === 0 || raw.length > MAX_PAYMENT_PARTS) {
    return { error: `Indica entre 1 y ${MAX_PAYMENT_PARTS} formas de pago.` };
  }

  const byMethod = new Map();
  for (const p of raw) {
    const method = p?.method;
    const amount = Number(p?.amount);
    if (!PAYMENT_METHODS.includes(method)) return { error: 'Forma de pago inválida.' };
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Cada parte del pago debe tener un monto mayor que 0.' };
    byMethod.set(method, (byMethod.get(method) || 0) + amount);
  }

  const parts = [...byMethod].map(([method, amount]) => ({ method, amount }));
  const sum = parts.reduce((s, p) => s + p.amount, 0);
  if (Math.abs(sum - Number(total)) > AMOUNT_EPSILON) {
    return { error: `Las partes del pago suman ${Math.round(sum)} y el total cobrado es ${Math.round(Number(total))}.` };
  }
  return { parts };
}

// Forma de pago a guardar en la cita: la única, o null si es dividido.
function appointmentMethodOf(parts) {
  return parts.length === 1 ? parts[0].method : null;
}

// Partes actuales de una cita a partir de sus ingresos enlazados.
function partsOf(incomes) {
  return incomes.map((f) => ({ method: f.paymentMethod, amount: f.amount }));
}

// Cuenta en la que impacta cada forma de pago en /finances/balances.
function accountOf(method) {
  if (method === 'BANCOLOMBIA' || method === 'NEQUI') return 'banco';
  if (method === 'CASH') return 'efectivo';
  return null;
}

function totalsByAccount(parts) {
  const acc = { banco: 0, efectivo: 0 };
  for (const p of parts) {
    const a = accountOf(p.method);
    if (a) acc[a] += p.amount;
  }
  return acc;
}

// Si el cambio mueve dinero entre banco y efectivo en una cita anterior al
// último ajuste manual de saldos, ese ajuste ya incluía el pago tal como estaba
// y el saldo calculado NO se corrige solo. Devuelve el aviso o null.
async function balanceWarning(prisma, apptDate, previous, next) {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['balance_banco_at', 'balance_efectivo_at'] } },
  });
  const cutoff = Object.fromEntries(settings.map((s) => [s.key, s.value ? new Date(s.value) : null]));
  const before = totalsByAccount(previous);
  const after = totalsByAccount(next);
  const date = new Date(apptDate);

  const affected = [];
  if (Math.abs(before.banco - after.banco) > AMOUNT_EPSILON && cutoff.balance_banco_at && date <= cutoff.balance_banco_at) {
    affected.push('banco');
  }
  if (Math.abs(before.efectivo - after.efectivo) > AMOUNT_EPSILON && cutoff.balance_efectivo_at && date <= cutoff.balance_efectivo_at) {
    affected.push('efectivo');
  }
  if (affected.length === 0) return null;
  return `Esta cita es anterior al último ajuste manual del saldo de ${affected.join(' y ')}. ` +
    'Ese saldo ya contaba el pago como estaba antes: revísalo en Ajustes.';
}

module.exports = {
  PAYMENT_METHODS,
  MAX_PAYMENT_PARTS,
  AMOUNT_EPSILON,
  parsePayments,
  appointmentMethodOf,
  partsOf,
  balanceWarning,
};
