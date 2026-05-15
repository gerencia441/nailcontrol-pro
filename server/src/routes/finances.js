const { Router } = require('express');
const router = Router();

// IMPORTANT: /day-close must be registered before /:id
router.get('/day-close', async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'date query param required' });

    const day = new Date(date);
    day.setUTCHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const [finances, appointments] = await Promise.all([
      req.prisma.finance.findMany({
        where: { date: { gte: day, lt: nextDay } },
        orderBy: { date: 'asc' },
      }),
      req.prisma.appointment.findMany({
        where: {
          date: { gte: day, lt: nextDay },
          status: 'COMPLETED',
        },
        include: { manicurist: true },
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
      if (!liquidationMap[key]) {
        liquidationMap[key] = {
          name: appt.manicurist.name,
          commissionPercentage: appt.manicurist.commissionPercentage,
          totalBilled: 0,
          commissionEarned: 0,
          appointmentCount: 0,
        };
      }
      const paid = appt.finalPricePaid || 0;
      liquidationMap[key].totalBilled += paid;
      liquidationMap[key].commissionEarned +=
        paid * (appt.manicurist.commissionPercentage / 100);
      liquidationMap[key].appointmentCount += 1;
    }

    res.json({
      date,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses,
      byPaymentMethod,
      manicuristLiquidation: Object.values(liquidationMap),
      financeEntries: finances,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
