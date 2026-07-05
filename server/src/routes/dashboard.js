const { Router } = require('express');
const { bogotaDayRangeToUtc } = require('../lib/bogotaTime');
const router = Router();

router.get('/', async (req, res) => {
  try {
    const todayBogota = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const { start: today, end: tomorrow } = bogotaDayRangeToUtc(todayBogota);

    const isManicurist = req.user.role === 'MANICURIST';
    const mId = isManicurist ? req.user.manicuristId : null;

    if (isManicurist && !mId) {
      return res.json({ appointmentsToday: 0, pendingCount: 0, cashToday: 0, totalIncomeToday: 0 });
    }

    const apptFilter = mId ? { manicuristId: mId } : {};
    const financeFilter = mId ? { manicuristId: mId } : {};

    const [appointmentsToday, pendingCount, cashToday, totalIncomeToday] =
      await Promise.all([
        req.prisma.appointment.count({
          where: { ...apptFilter, date: { gte: today, lt: tomorrow } },
        }),
        req.prisma.appointment.count({
          where: { ...apptFilter, status: 'PENDING', date: { gte: today, lt: tomorrow } },
        }),
        req.prisma.finance.aggregate({
          where: {
            ...financeFilter,
            date: { gte: today, lt: tomorrow },
            type: 'INCOME',
            paymentMethod: 'CASH',
          },
          _sum: { amount: true },
        }),
        req.prisma.finance.aggregate({
          where: {
            ...financeFilter,
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
