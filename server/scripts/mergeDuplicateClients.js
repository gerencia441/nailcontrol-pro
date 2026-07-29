require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { normalizeColombianPhone } = require('../src/lib/phone');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function main() {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { appointments: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const groups = new Map();
  for (const c of clients) {
    if (!c.phone || !c.phone.trim()) continue;
    let normalized;
    try {
      normalized = normalizeColombianPhone(c.phone);
    } catch {
      continue; // teléfono no parseable: no se toca
    }
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(c);
  }

  const autoMergeGroups = [];
  const manualReviewGroups = [];
  const singletons = [];

  for (const [phone, members] of groups) {
    if (members.length === 1) {
      singletons.push({ phone, client: members[0] });
      continue;
    }
    const names = new Set(members.map((m) => normalizeName(m.name)));
    if (names.size === 1) {
      autoMergeGroups.push({ phone, members });
    } else {
      manualReviewGroups.push({ phone, members });
    }
  }

  console.log('='.repeat(70));
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'DRY-RUN (usa --apply para ejecutar de verdad)'}`);
  console.log('='.repeat(70));
  console.log(`Grupos a fusionar (mismo nombre): ${autoMergeGroups.length}`);
  console.log(`Grupos que requieren revisión manual (nombres distintos, NO se tocan): ${manualReviewGroups.length}`);
  console.log(`Clientes con teléfono único a normalizar: ${singletons.length}`);
  console.log('');

  if (manualReviewGroups.length) {
    console.log('--- Grupos que NO se tocarán (revisión manual pendiente) ---');
    for (const { phone, members } of manualReviewGroups) {
      console.log(`\n${phone}:`);
      for (const m of members) {
        console.log(`  - [${m.id}] "${m.name}" citas=${m._count.appointments}`);
      }
    }
    console.log('');
  }

  if (autoMergeGroups.length) {
    console.log('--- Grupos a fusionar ---');
    for (const { phone, members } of autoMergeGroups) {
      const sorted = [...members].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      console.log(`\n${phone} -> keeper: [${sorted[0].id}] "${sorted[0].name}"`);
      for (const m of sorted.slice(1)) {
        console.log(`  - fusiona y elimina [${m.id}] "${m.name}" (citas=${m._count.appointments})`);
      }
    }
    console.log('');
  }

  if (!autoMergeGroups.length && !singletons.length) {
    console.log('Nada que aplicar.');
    return;
  }

  if (!APPLY) {
    console.log('Ejecuta con --apply para aplicar estos cambios (se hace un respaldo antes de escribir nada).');
    return;
  }

  const backupDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `pre-merge-${Date.now()}.json`);
  const [allClients, allAppointments, allApptServices] = await Promise.all([
    prisma.client.findMany(),
    prisma.appointment.findMany(),
    prisma.appointmentService.findMany(),
  ]);
  fs.writeFileSync(
    backupPath,
    JSON.stringify({ clients: allClients, appointments: allAppointments, appointmentServices: allApptServices }, null, 2)
  );
  console.log(`Respaldo guardado en ${backupPath}`);

  let mergedGroups = 0;
  let deletedClients = 0;
  let reassignedAppointments = 0;
  let normalizedSingletons = 0;

  // Cada grupo se fusiona en su propia transacción corta (evita timeouts por
  // latencia de la BD remota cuando se agrupan muchas operaciones en una sola).
  for (const { members } of autoMergeGroups) {
    const sorted = [...members].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const keeper = sorted[0];
    const dupes = sorted.slice(1);

    const tags = new Set(JSON.parse(keeper.tags || '[]'));
    const notes = keeper.technicalNotes ? [keeper.technicalNotes] : [];
    let birthDate = keeper.birthDate;
    for (const d of dupes) {
      for (const t of JSON.parse(d.tags || '[]')) tags.add(t);
      if (d.technicalNotes && !notes.includes(d.technicalNotes)) notes.push(d.technicalNotes);
      if (!birthDate && d.birthDate) birthDate = d.birthDate;
    }

    await prisma.$transaction(
      async (tx) => {
        for (const d of dupes) {
          const { count } = await tx.appointment.updateMany({
            where: { clientId: d.id },
            data: { clientId: keeper.id },
          });
          reassignedAppointments += count;
          await tx.client.delete({ where: { id: d.id } });
          deletedClients += 1;
        }

        await tx.client.update({
          where: { id: keeper.id },
          data: {
            phone: normalizeColombianPhone(keeper.phone),
            tags: JSON.stringify([...tags]),
            technicalNotes: notes.join('\n---\n') || null,
            birthDate,
          },
        });
      },
      { timeout: 20000 }
    );
    mergedGroups += 1;
  }

  // Normalización de teléfonos de clientes sin duplicados: son actualizaciones
  // independientes de un solo campo, no requieren una transacción conjunta.
  for (const { client } of singletons) {
    const normalized = normalizeColombianPhone(client.phone);
    if (normalized !== client.phone) {
      await prisma.client.update({ where: { id: client.id }, data: { phone: normalized } });
      normalizedSingletons += 1;
    }
  }

  console.log('');
  console.log(
    `Listo. Grupos fusionados: ${mergedGroups}, fichas eliminadas: ${deletedClients}, ` +
      `citas reasignadas: ${reassignedAppointments}, teléfonos normalizados: ${normalizedSingletons}.`
  );
}

main()
  .catch((err) => {
    console.error('Error en la fusión:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
