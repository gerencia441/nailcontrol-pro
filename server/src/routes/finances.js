const { Router } = require('express');
const router = Router();

// Todas las citas y finanzas se guardan en UTC pero representan hora local de
// Bogotá (UTC−5, sin horario de verano). Un día de Bogotá [00:00, 24:00) equivale
// al rango UTC [05:00, 05:00 del día siguiente). Estos helpers construyen los
// rangos de cada período alineados al día de Bogotá, igual que el resto de la app
// (appointments.js y dashboard.js usan bogotaDayRangeToUtc).
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

function startOfBogotaDay(value) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return new Date(date.getTime() + BOGOTA_OFFSET_MS);
}

function endExclusiveOfBogotaDay(value) {
  const date = startOfBogotaDay(value);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function getBogotaWeekRange(value) {
  const base = new Date(value);
  base.setUTCHours(0, 0, 0, 0);
  const day = base.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  base.setUTCDate(base.getUTCDate() - daysFromMonday);

  const start = new Date(base.getTime() + BOGOTA_OFFSET_MS);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start, end };
}

function getBogotaMonthRange(year, month) {
  const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1) + BOGOTA_OFFSET_MS);
  const end = new Date(Date.UTC(Number(year), Number(month), 1) + BOGOTA_OFFSET_MS);
  return { start, end };
}

function getBogotaYearRange(year) {
  const start = new Date(Date.UTC(Number(year), 0, 1) + BOGOTA_OFFSET_MS);
  const end = new Date(Date.UTC(Number(year) + 1, 0, 1) + BOGOTA_OFFSET_MS);
  return { start, end };
}

// Convierte un instante UTC a la fecha calendario de Bogotá para mostrarla.
function toDateLabel(date) {
  return new Date(date.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

function getRangeFromQuery(query) {
  const { period = 'custom', date, dateFrom, dateTo, year, month } = query;

  if (period === 'day') {
    if (!date) throw new Error('date query param required');
    return { period, start: startOfBogotaDay(date), end: endExclusiveOfBogotaDay(date) };
  }

  if (period === 'week') {
    if (!date) throw new Error('date query param required');
    return { period, ...getBogotaWeekRange(date) };
  }

  if (period === 'month') {
    if (!year || !month) throw new Error('year and month query params required');
    return { period, ...getBogotaMonthRange(year, month) };
  }

  if (period === 'year') {
    if (!year) throw new Error('year query param required');
    return { period, ...getBogotaYearRange(year) };
  }

  if (!dateFrom || !dateTo) throw new Error('dateFrom and dateTo query params required');
  return { period, start: startOfBogotaDay(dateFrom), end: endExclusiveOfBogotaDay(dateTo) };
}

async function buildFinancialReport(prisma, { period, start, end }, manicuristId = null) {
  const apptWhere = { date: { gte: start, lt: end } };
  const financeWhere = { date: { gte: start, lt: end } };

  if (manicuristId) {
    apptWhere.manicuristId = manicuristId;
    financeWhere.manicuristId = manicuristId;
    financeWhere.type = 'INCOME';
  }

  const [finances, appointments, statusCounts] = await Promise.all([
    prisma.finance.findMany({
      where: financeWhere,
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { ...apptWhere, status: 'COMPLETED' },
      include: { manicurist: true },
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: apptWhere,
      _count: { _all: true },
    }),
  ]);

  const incomes  = finances.filter((f) => f.type === 'INCOME');
  // Los pagos de comisión (isCommission=true) se excluyen de totalExpenses porque
  // ya quedan reflejados en netAfterCommissions. Incluirlos causaría doble descuento.
  const expenses = finances.filter((f) => f.type === 'EXPENSE' && !f.isCommission);
  const commissionPayments = finances.filter((f) => f.type === 'EXPENSE' && f.isCommission);

  const byPaymentMethod = incomes.reduce((acc, f) => {
    const pm = f.paymentMethod || 'UNKNOWN';
    acc[pm] = (acc[pm] || 0) + f.amount;
    return acc;
  }, {});

  const totalIncome          = incomes.reduce((s, f) => s + f.amount, 0);
  const totalExpenses        = expenses.reduce((s, f) => s + f.amount, 0);
  const totalCommissionsPaid = commissionPayments.reduce((s, f) => s + f.amount, 0);

  const liquidationMap = {};
  for (const appt of appointments) {
    const key = appt.manicurist.id;
    const paid = Number(appt.finalPricePaid) || 0;
    const commissionPercentage = Number(appt.manicurist?.commissionPercentage) || 0;

    if (!liquidationMap[key]) {
      liquidationMap[key] = {
        id: appt.manicurist.id,
        name: appt.manicurist.name,
        color: appt.manicurist.color,
        commissionPercentage,
        totalBilled: 0,
        commissionEarned: 0,
        appointmentCount: 0,
      };
    }

    liquidationMap[key].totalBilled += paid;
    liquidationMap[key].commissionEarned += paid * (commissionPercentage / 100);
    liquidationMap[key].appointmentCount += 1;
  }

  const manicuristLiquidation = Object.values(liquidationMap);
  const totalCommissions = manicuristLiquidation.reduce(
    (sum, item) => sum + item.commissionEarned,
    0
  );
  const appointmentStatus = statusCounts.reduce(
    (acc, item) => ({ ...acc, [item.status]: item._count._all }),
    { PENDING: 0, COMPLETED: 0, CANCELLED: 0 }
  );
  const net = totalIncome - totalExpenses;

  return {
    period,
    dateFrom: toDateLabel(start),
    dateTo: toDateLabel(new Date(end.getTime() - 1)),
    totalIncome,
    totalExpenses,
    net,
    totalCommissions,
    totalCommissionsPaid,
    netAfterCommissions: net - totalCommissions,
    byPaymentMethod,
    appointmentStatus,
    manicuristLiquidation,
    financeEntries: finances,
  };
}

// GET /api/finances/balances — saldo desde el último ajuste manual (solo admin)
router.get('/balances', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const [settings, finances] = await Promise.all([
      req.prisma.setting.findMany(),
      req.prisma.finance.findMany({
        select: { type: true, amount: true, paymentMethod: true, date: true },
      }),
    ]);

    const cfg = {};
    for (const s of settings) cfg[s.key] = s.value;

    const baseBanco    = parseFloat(cfg.balance_banco    || '0');
    const baseEfectivo = parseFloat(cfg.balance_efectivo || '0');
    const bancoAt      = cfg.balance_banco_at    ? new Date(cfg.balance_banco_at)    : null;
    const efectivoAt   = cfg.balance_efectivo_at ? new Date(cfg.balance_efectivo_at) : null;

    let netBanco = 0;
    let netEfectivo = 0;

    for (const f of finances) {
      const sign = f.type === 'INCOME' ? 1 : -1;
      const amt  = f.amount * sign;
      if (f.paymentMethod === 'BANCOLOMBIA' || f.paymentMethod === 'NEQUI') {
        if (!bancoAt || f.date > bancoAt) netBanco += amt;
      } else if (f.paymentMethod === 'CASH') {
        if (!efectivoAt || f.date > efectivoAt) netEfectivo += amt;
      }
    }

    res.json({
      banco:      baseBanco    + netBanco,
      efectivo:   baseEfectivo + netEfectivo,
      bancoAt:    bancoAt    ? bancoAt.toISOString()    : null,
      efectivoAt: efectivoAt ? efectivoAt.toISOString() : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/day-close', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const mId = req.user.role === 'MANICURIST' ? (req.user.manicuristId || null) : null;
    const report = await buildFinancialReport(req.prisma, {
      period: 'day',
      start: startOfBogotaDay(date),
      end: endExclusiveOfBogotaDay(date),
    }, mId);
    res.json({ date, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/week-close', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });
    const mId = req.user.role === 'MANICURIST' ? (req.user.manicuristId || null) : null;
    const range = getBogotaWeekRange(date);
    const report = await buildFinancialReport(req.prisma, { period: 'week', ...range }, mId);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const mId = req.user.role === 'MANICURIST' ? (req.user.manicuristId || null) : null;
    const range = getRangeFromQuery(req.query);
    const report = await buildFinancialReport(req.prisma, range, mId);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/finances/pending-commissions — comisiones acumuladas sin pagar por manicurista
router.get('/pending-commissions', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const [manicurists, incomeFinances, payments] = await Promise.all([
      req.prisma.manicurist.findMany({ orderBy: { name: 'asc' } }),
      // Usamos los registros Finance de tipo INCOME con manicuristId, que se crean
      // al completar cada cita. Cada registro guarda commissionPercentage (el % en
      // vigor al momento del servicio). Para registros anteriores a esta mejora,
      // commissionPercentage es null y se usa el % actual como fallback.
      req.prisma.finance.findMany({
        where: { type: 'INCOME', manicuristId: { not: null } },
        select: { manicuristId: true, amount: true, commissionPercentage: true },
      }),
      req.prisma.finance.findMany({
        where: { isCommission: true, type: 'EXPENSE' },
        select: { manicuristId: true, amount: true },
      }),
    ]);

    const manicuristMap = Object.fromEntries(manicurists.map((m) => [m.id, m]));

    const earned = {};
    for (const f of incomeFinances) {
      const m = manicuristMap[f.manicuristId];
      if (!m) continue; // manicurista eliminada, ignorar
      // Prioriza el % guardado al momento del servicio; si no existe, usa el actual
      const pct = f.commissionPercentage != null ? f.commissionPercentage : m.commissionPercentage;
      earned[f.manicuristId] = (earned[f.manicuristId] || 0) + (Number(f.amount) || 0) * pct / 100;
    }

    const paid = {};
    for (const p of payments) {
      if (p.manicuristId) paid[p.manicuristId] = (paid[p.manicuristId] || 0) + p.amount;
    }

    const result = manicurists.map((m) => ({
      id: m.id,
      name: m.name,
      color: m.color,
      commissionPercentage: m.commissionPercentage,
      totalEarned: earned[m.id] || 0,
      totalPaid:   paid[m.id]   || 0,
      pending:     (earned[m.id] || 0) - (paid[m.id] || 0),
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finances/pay-commission — registrar pago de comisión
router.post('/pay-commission', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const { manicuristId, amount, paymentMethod } = req.body;
    if (!manicuristId || !amount || !paymentMethod) {
      return res.status(400).json({ error: 'manicuristId, amount y paymentMethod son requeridos' });
    }
    const manicurist = await req.prisma.manicurist.findUnique({ where: { id: manicuristId } });
    if (!manicurist) return res.status(404).json({ error: 'Manicurista no encontrada' });

    const finance = await req.prisma.finance.create({
      data: {
        type: 'EXPENSE',
        isCommission: true,
        amount: parseFloat(amount),
        description: `Pago de comisión - ${manicurist.name}`,
        date: new Date(),
        paymentMethod,
        manicuristId: manicurist.id,
        manicuristColor: manicurist.color,
      },
    });
    res.status(201).json(finance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, dateFrom, dateTo } = req.query;
    const where = {};

    if (req.user.role === 'MANICURIST') {
      if (!req.user.manicuristId) return res.json([]);
      where.manicuristId = req.user.manicuristId;
      where.type = 'INCOME';
    } else {
      if (type) where.type = type;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setUTCHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    const finances = await req.prisma.finance.findMany({
      where,
      orderBy: { date: 'desc' },
    });
    res.json(finances);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const { type, amount, description, date, paymentMethod } = req.body;
    const finance = await req.prisma.finance.create({
      data: {
        type,
        amount: parseFloat(amount),
        description,
        date: startOfBogotaDay(date),
        paymentMethod: paymentMethod || null,
      },
    });
    res.status(201).json(finance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    await req.prisma.finance.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
