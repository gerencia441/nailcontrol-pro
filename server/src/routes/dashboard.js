const { Router } = require('express');
const router = Router();

router.get('/', async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [appointmentsToday, pendingCount, cashToday, totalIncomeToday] =
      await Promise.all([
        req.prisma.appointment.count({
          where: { date: { gte: today, lt: tomorrow } },
        }),
        req.prisma.appointment.count({
          where: { status: 'PENDING' },
        }),
        req.prisma.finance.aggregate({
          where: {
            date: { gte: today, lt: tomorrow },
            type: 'INCOME',
            paymentMethod: 'CASH',
          },
          _sum: { amount: true },
        }),
        req.prisma.finance.aggregate({
          where: {
            date: { gte: today, lt: tomorrow },
            type: 'INCOME',
          },
          _sum: { amount: true },
        }),
      ]);

    res.json({
      appointmentsToday,
      pendingCount,
      cashToday: cashToday._sum.amount || 0,
      totalIncomeToday: totalIncomeToday._sum.amount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
