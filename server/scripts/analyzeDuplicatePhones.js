require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { normalizeColombianPhone } = require('../src/lib/phone');

const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany({
    include: { _count: { select: { appointments: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const groups = new Map();
  const unparseable = [];
  const noPhone = [];

  for (const c of clients) {
    if (!c.phone || !c.phone.trim()) {
      noPhone.push(c);
      continue;
    }
    let normalized;
    try {
      normalized = normalizeColombianPhone(c.phone);
    } catch (e) {
      unparseable.push({ client: c, reason: e.message });
      continue;
    }
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(c);
  }

  const duplicateGroups = [...groups.entries()].filter(([, members]) => members.length > 1);

  console.log('='.repeat(70));
  console.log('ANÁLISIS DE TELÉFONOS DUPLICADOS (solo lectura, nada se modificó)');
  console.log('='.repeat(70));
  console.log(`Total de clientes: ${clients.length}`);
  console.log(`Sin teléfono: ${noPhone.length}`);
  console.log(`Con teléfono no parseable (formato inválido, no se tocarán): ${unparseable.length}`);
  console.log(`Grupos de teléfono único (sin duplicados): ${groups.size - duplicateGroups.length}`);
  console.log(`Grupos con duplicados detectados: ${duplicateGroups.length}`);
  console.log('');

  if (unparseable.length) {
    console.log('--- Clientes con teléfono no parseable (revisar manualmente) ---');
    for (const { client: c, reason } of unparseable) {
      console.log(`  [${c.id}] "${c.name}" phone="${c.phone}" -> ${reason}`);
    }
    console.log('');
  }

  if (duplicateGroups.length) {
    console.log('--- Grupos duplicados ---');
    for (const [phone, members] of duplicateGroups) {
      const sorted = [...members].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      const keeper = sorted[0];
      console.log(`\nTeléfono normalizado: ${phone}  (${members.length} fichas)`);
      for (const m of sorted) {
        const tag = m.id === keeper.id ? '  [KEEPER: dato más reciente]' : '  [se fusiona y elimina]';
        console.log(
          `  - [${m.id}] "${m.name}" phone_original="${m.phone}" citas=${m._count.appointments} ` +
            `updatedAt=${m.updatedAt.toISOString()}${tag}`
        );
      }
    }
    console.log('');
  } else {
    console.log('No se encontraron grupos duplicados por teléfono normalizado.');
  }

  console.log('='.repeat(70));
  console.log('Este script NO modificó la base de datos. Es solo un reporte.');
  console.log('='.repeat(70));
}

main()
  .catch((err) => {
    console.error('Error al analizar duplicados:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
