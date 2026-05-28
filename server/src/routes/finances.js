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

async function buildFinancialReport(prisma, { period, start, end }) {
  const [finances, appointments, statusCounts] = await Promise.all([
    prisma.finance.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.findMany({
      where: {
        date: { gte: start, lt: end },
        status: 'COMPLETED',
      },
      include: { manicurist: true },
      orderBy: { date: 'asc' },
    }),
    prisma.appointment.groupBy({
      by: ['status'],
      where: { date: { gte: start, lt: end } },
      _count: { _all: true },
    }),
  ]);

  const incomes = finances.filter((f) => f.type === 'INCOME');
  const expenses = finances.filter((f) => f.type === 'EXPENSE');

  const byPaymentMethod = incomes.reduce((acc, f) => {
    const pm = f.paymentMethod || 'UNKNOWN';
    acc[pm] = (acc[pm] || 0) + f.amount;
    return acc;
  }, {});

  const totalIncome = incomes.reduce((s, f) => s + f.amount, 0);
  const totalExpenses = expenses.reduce((s, f) => s + f.amount, 0);

  const liquidationMap = {};
  for (const appt of appointments) {
    const key = appt.manicurist.id;
    const paid = Number(appt.finalPricePaid) || 0;
    const commissionPercentage = Number(appt.manicurist?.commissionPercentage) || 0;

    if (!liquidationMap[key]) {
      liquidationMap[key] = {
        name: appt.manicurist.name,
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
    netAfterCommissions: net - totalCommissions,
    byPaymentMethod,
    appointmentStatus,
    manicuristLiquidation,
    financeEntries: finances,
  };
}

router.get('/day-close', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    const report = await buildFinancialReport(req.prisma, {
      period: 'day',
      start: startOfBogotaDay(date),
      end: endExclusiveOfBogotaDay(date),
    });

    res.json({ date, ...report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/week-close', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    const range = getBogotaWeekRange(date);
    const report = await buildFinancialReport(req.prisma, {
      period: 'week',
      ...range,
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const range = getRangeFromQuery(req.query);
    const report = await buildFinancialReport(req.prisma, range);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { type, dateFrom, dateTo } = req.query;
    const where = {};

    if (type) where.type = type;
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
  try {
    const { type, amount, description, date, paymentMethod } = req.body;
    const finance = await req.prisma.finance.create({
      data: {
        type,
        amount: parseFloat(amount),
        description,
        date: new Date(date),
        paymentMethod: paymentMethod || null,
      },
    });
    res.status(201).json(finance);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.finance.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
