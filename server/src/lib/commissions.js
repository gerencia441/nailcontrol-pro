// Comisiones acumuladas por especialista: lo ganado (ingresos de sus citas) y
// lo ya pagado (egresos isCommission). Lo usan GET /finances/pending-commissions
// y la corrección de citas (aviso de comisión ya cobrada).
//
// Lo ganado sale de los Finance INCOME con manicuristId, que se crean al
// completar cada cita. Cada registro guarda commissionPercentage (el % en vigor
// al momento del servicio). Para registros anteriores a esa mejora,
// commissionPercentage es null y se usa el % actual de la ficha como fallback.

// `manicurists`: fichas completas (se usa id y commissionPercentage).
// Devuelve { [manicuristId]: { earned, paid, pending } }.
async function commissionTotals(prisma, manicurists) {
  const ids = manicurists.map((m) => m.id);
  const [incomes, payments] = await Promise.all([
    prisma.finance.findMany({
      where: { type: 'INCOME', manicuristId: { in: ids } },
      select: { manicuristId: true, amount: true, commissionPercentage: true },
    }),
    prisma.finance.findMany({
      where: { isCommission: true, type: 'EXPENSE', manicuristId: { in: ids } },
      select: { manicuristId: true, amount: true },
    }),
  ]);

  const byId = Object.fromEntries(manicurists.map((m) => [m.id, m]));
  const totals = Object.fromEntries(ids.map((id) => [id, { earned: 0, paid: 0, pending: 0 }]));

  for (const f of incomes) {
    const m = byId[f.manicuristId];
    const pct = f.commissionPercentage != null ? f.commissionPercentage : m.commissionPercentage;
    totals[f.manicuristId].earned += (Number(f.amount) || 0) * pct / 100;
  }
  for (const p of payments) totals[p.manicuristId].paid += p.amount;
  for (const t of Object.values(totals)) t.pending = t.earned - t.paid;
  return totals;
}

module.exports = { commissionTotals };
