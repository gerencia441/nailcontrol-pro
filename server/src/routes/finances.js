const { Router } = require('express');
const {
  SERVICE_CATEGORIES,
  SUPPLY_FUND_RATE_BY_CATEGORY,
  isValidCategory,
  allocatePaid,
} = require('../lib/serviceCategories');
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

  const [finances, appointments, statusCounts, linkedUsers] = await Promise.all([
    prisma.finance.findMany({
      where: financeWhere,
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.findMany({
      where: { ...apptWhere, status: 'COMPLETED' },
      include: {
        manicurist: true,
        services: {
          select: {
            category: true,
            amount: true,
            service: { select: { category: true, basePrice: true } },
          },
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: apptWhere,
      _count: { _all: true },
    }),
    // El rol no vive en Manicurist sino en User (User.manicuristId es @unique, así
    // que la relación es 1:1). Se consulta aparte porque no hay relación Prisma
    // declarada entre ambos modelos y por tanto no se puede hacer include.
    prisma.user.findMany({
      where: { manicuristId: { not: null } },
      select: { manicuristId: true, role: true },
    }),
  ]);

  // manicuristId -> UserRole. Una manicurista sin cuenta de usuario asociada se
  // trata como MANICURIST (el caso por defecto y el porcentaje base del 50%).
  const roleByManicuristId = Object.fromEntries(
    linkedUsers.map((u) => [u.manicuristId, u.role])
  );

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

  // Egresos reales por categoría (sin contar pagos de comisión, ya excluidos de
  // `expenses`). "uncategorized" es lo registrado antes de esta clasificación o
  // sin categoría asignada; se muestra aparte para no perderlo del total.
  const expensesByCategory = expenses.reduce(
    (acc, f) => {
      const key = f.expenseCategory === 'SUPPLIES' ? 'supplies'
        : f.expenseCategory === 'FIXED' ? 'fixed'
        : f.expenseCategory === 'OTHER' ? 'other'
        : 'uncategorized';
      acc[key] += f.amount;
      return acc;
    },
    { supplies: 0, fixed: 0, other: 0, uncategorized: 0 }
  );

  // Balance por categoría de servicio (manicure, pedicure, cejas, pestañas).
  // Lo facturado sale de las citas completadas, repartido entre sus servicios;
  // los insumos gastados, de los egresos imputados a cada categoría.
  const byServiceCategory = Object.fromEntries(
    SERVICE_CATEGORIES.map((c) => [
      c,
      {
        billed: 0,
        billedAdmin: 0,
        billedManicurist: 0,
        commissions: 0,
        appointmentCount: 0,
        suppliesSpent: 0,
        otherExpenses: 0,
      },
    ])
  );
  // Egresos sin categoría de servicio: gastos generales del salón.
  let generalExpenses = 0;
  for (const f of expenses) {
    const bucket = byServiceCategory[f.serviceCategory];
    if (!bucket) generalExpenses += f.amount;
    else if (f.expenseCategory === 'SUPPLIES') bucket.suppliesSpent += f.amount;
    else bucket.otherExpenses += f.amount;
  }

  const liquidationMap = {};
  // Facturación segmentada por el rol del usuario dueño de la ficha, que es lo
  // que alimenta el reparto de cajaEstudio (ver fundDistribution más abajo).
  let totalBilledAdmin = 0;
  let totalBilledManicurist = 0;

  for (const appt of appointments) {
    const key = appt.manicurist.id;
    const paid = Number(appt.finalPricePaid) || 0;
    // Prioriza el % congelado en la cita al completarla; solo cae al de la ficha
    // en citas antiguas sin backfill. Sin esto, cambiar el % de una manicurista
    // reescribía las comisiones de todos los cierres ya emitidos.
    const commissionPercentage = Number(
      appt.commissionPercentage != null
        ? appt.commissionPercentage
        : appt.manicurist?.commissionPercentage
    ) || 0;
    const role = roleByManicuristId[key] === 'ADMIN' ? 'ADMIN' : 'MANICURIST';

    if (!liquidationMap[key]) {
      liquidationMap[key] = {
        id: appt.manicurist.id,
        name: appt.manicurist.name,
        color: appt.manicurist.color,
        role,
        commissionPercentage,
        totalBilled: 0,
        commissionEarned: 0,
        appointmentCount: 0,
      };
    }

    liquidationMap[key].totalBilled += paid;
    liquidationMap[key].commissionEarned += paid * (commissionPercentage / 100);
    liquidationMap[key].appointmentCount += 1;

    if (role === 'ADMIN') totalBilledAdmin += paid;
    else totalBilledManicurist += paid;

    // Usa el reparto congelado al completar; las citas anteriores a esa
    // columna se reparten al vuelo con la categoría y precio actuales.
    const frozen = appt.services.length > 0 && appt.services.every((s) => s.amount != null && s.category);
    const shares = frozen
      ? appt.services.map((s) => ({ category: s.category, amount: s.amount }))
      : (() => {
          const current = appt.services.map((s) => s.service);
          const amounts = allocatePaid(current, paid);
          return current.map((s, i) => ({ category: s.category, amount: amounts[i] }));
        })();
    const touched = new Set();
    for (const share of shares) {
      const bucket = byServiceCategory[share.category];
      if (!bucket) continue;
      bucket.billed += share.amount;
      if (role === 'ADMIN') bucket.billedAdmin += share.amount;
      else bucket.billedManicurist += share.amount;
      bucket.commissions += share.amount * (commissionPercentage / 100);
      touched.add(share.category);
    }
    for (const c of touched) byServiceCategory[c].appointmentCount += 1;
  }

  for (const c of SERVICE_CATEGORIES) {
    const b = byServiceCategory[c];
    const rate = SUPPLY_FUND_RATE_BY_CATEGORY[c] ?? 0.25;
    b.supplyFundRate = rate;
    b.fondoInsumos = b.billed * rate;
    b.cajaEstudio = b.billedAdmin * 0.4 + b.billedManicurist * 0.25;
    // Lo que deja la categoría después de comisiones y de sus propios egresos.
    b.net = b.billed - b.commissions - b.suppliesSpent - b.otherExpenses;
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

  // Desglose de lo que retiene el salón (netAfterCommissions) en dos rubros
  // operativos. La identidad se cumple cuando el ADMIN comisiona al 35% y las
  // manicuristas al 50%, y todo el ingreso del periodo viene de citas COMPLETED:
  //   netAfterCommissions = totalIncome − (0.35·A + 0.50·M)  con A+M = totalIncome
  //                       = 0.65·A + 0.50·M
  //   fondoInsumos + cajaEstudio = 0.25·(A+M) + 0.40·A + 0.25·M = 0.65·A + 0.50·M
  // Con totalExpenses > 0, o con ingresos manuales que no provienen de citas, la
  // igualdad deja de darse: son rubros de reparto, no un cuadre contable.
  const fondoInsumos = totalIncome * 0.25;
  const cajaEstudio = totalBilledAdmin * 0.4 + totalBilledManicurist * 0.25;

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
    totalBilledAdmin,
    totalBilledManicurist,
    // Ingresos del periodo que no provienen de una cita completada. Son los que
    // impiden que el reparto de fondos cuadre con el Saldo del Salón: suman al
    // total pero no a lo facturado por ninguna manicurista. Casi todos son de
    // mayo-julio de 2026, cuando aún no se usaba la agenda de forma sistemática.
    incomeWithoutAppointment: totalIncome - (totalBilledAdmin + totalBilledManicurist),
    fundDistribution: {
      fondoInsumos,
      cajaEstudio,
    },
    expensesByCategory,
    byServiceCategory,
    generalExpenses,
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
    if (!manicurist) return res.status(404).json({ error: 'Especialista no encontrada' });

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

const EXPENSE_CATEGORIES = ['SUPPLIES', 'FIXED', 'OTHER'];

router.post('/', async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Solo administradores' });
  try {
    const { type, amount, description, date, paymentMethod, expenseCategory, serviceCategory } = req.body;

    // La categoría solo tiene sentido en un egreso; en un ingreso se ignora
    // aunque llegue en el body, para no dejar basura en registros que nunca
    // se leen por categoría.
    if (expenseCategory && !EXPENSE_CATEGORIES.includes(expenseCategory)) {
      return res.status(400).json({ error: 'expenseCategory inválida' });
    }
    if (serviceCategory && !isValidCategory(serviceCategory)) {
      return res.status(400).json({ error: 'serviceCategory inválida' });
    }

    const finance = await req.prisma.finance.create({
      data: {
        type,
        amount: parseFloat(amount),
        description,
        date: startOfBogotaDay(date),
        paymentMethod: paymentMethod || null,
        expenseCategory: type === 'EXPENSE' ? (expenseCategory || null) : null,
        serviceCategory: type === 'EXPENSE' ? (serviceCategory || null) : null,
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
