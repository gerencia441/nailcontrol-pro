require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const { normalizeColombianPhone } = require('../src/lib/phone');

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// Clientes que se quedan con el número indicado (ya verificado por el usuario).
const KEEP = [
  { id: 'cmpoetxu5002aqx4sl4zcviiw', name: 'Paola estrada', phone: '+57 320 4521133' },
  { id: 'cmr89rl4e0008b38hn2pntdzy', name: 'Yuli Alzate', phone: '+57 316 6530269' },
  { id: 'cmrw83zkw0074v7zcxholp676', name: 'Verónica Castro ', phone: '+57 312 8411938' },
  { id: 'cmrplnp2i004vv7zclm3ur08m', name: 'Alix Munera ', phone: '+57 311 3000121' },
  { id: 'cmrclhdys0005111t4lerr2p0', name: 'Tatiana Correa ', phone: '+57 304 6329938' },
  { id: 'cmqifmdhm007fsvrhcf6aavue', name: 'Luzdary Patiño ', phone: '+57 316 7563961' },
  { id: 'cmqhb7dpw006ysvrheuhmwypv', name: 'Beatriz ospina ', phone: '+57 310 2712592' },
  { id: 'cmpvoby01002o7dbycmb7kcub', name: 'Cristina Aguilar ', phone: '+57 312 7504304' },
  { id: 'cmqgyhqjj006dsvrhkgqqhqvm', name: 'Ludis Galván', phone: '+57 301 7423641' },
  { id: 'cmq5z0k0a0019svrhn1y6lnvx', name: 'Yessica Murillo ', phone: '+57 300 2230045' },
  { id: 'cmpj7976b000ajmafdlkl99rb', name: 'Milena podóloga ', phone: '+57 300 5778045' },
];

// Clientes a los que se les quita el número (no son quien realmente lo tiene).
const CLEAR = [
  { id: 'cmqgz89iw006jsvrh2k2v5srl', name: 'Alex moreno ' },
  { id: 'cmpppmlnv0036qx4sonbivcog', name: 'Sandra moreno ' },
  { id: 'cmrw85a220077v7zc1hqzjb6w', name: 'María José Mejia' },
  { id: 'cmrplolna004yv7zcl5fx6u97', name: 'María clara' },
  { id: 'cmrclfj4i0002111txl3m9957', name: 'Raquel ' },
  { id: 'cmqifkmdm007csvrhhzru1nq0', name: 'Isabella Vargas ' },
  { id: 'cmq2sph95000asvrhveqhaebp', name: 'María clara ' },
  { id: 'cmqhb60um006vsvrh19quqw8y', name: 'Ana Sofía Patiño Daza' },
  { id: 'cmqh2p3a0006osvrhthgoh4mk', name: 'Isabella maya ' },
  { id: 'cmqgyj3mi006gsvrhzvfkqoxp', name: 'Carmen Esquivel' },
  { id: 'cmpyd8qf7000q3ldkrvak8rav', name: 'Caterin Marín' },
  { id: 'cmpw1b6k900043ldkldr9jh41', name: 'Jessica Murillo ' },
  { id: 'cmpy6e8zp000n3ldkuyib572e', name: 'Gloria fernandez' },
  { id: 'cmpk62bw60003kwaa05npqyw4', name: 'Ana ' },
];

// Fichas con nombre idéntico dentro de un grupo: se fusionan entre sí antes de
// aplicar la decisión final del número (igual criterio que mergeDuplicateClients.js).
const MERGE_PAIRS = [
  {
    keeperId: 'cmqfwq0wp0067svrh9d1sjkfg',
    keeperName: 'Vanessa rivera',
    dupeId: 'cmpyd9xbr000t3ldkaa92rsty',
    dupeName: 'Vanessa rivera ',
    finalPhone: '+57 312 5560549', // Vanessa rivera es quien se queda con el número
  },
  // El grupo +57 314 6681186 (Johana Rodríguez / Miriam jaramillo Hernandez x2)
  // ya no aparece en el análisis: alguien lo corrigió manualmente en la app
  // mientras se preparaba este script. No requiere acción aquí.
];

async function assertName(id, expectedName) {
  const c = await prisma.client.findUnique({ where: { id }, select: { name: true } });
  if (!c) throw new Error(`Cliente ${id} no existe (¿ya se movió/eliminó?).`);
  if (c.name !== expectedName) {
    throw new Error(`Cliente ${id}: nombre en BD es "${c.name}", se esperaba "${expectedName}". Abortando por seguridad.`);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'DRY-RUN (usa --apply para ejecutar de verdad)'}`);
  console.log('='.repeat(70));

  for (const k of KEEP) await assertName(k.id, k.name);
  for (const c of CLEAR) await assertName(c.id, c.name);
  for (const m of MERGE_PAIRS) {
    await assertName(m.keeperId, m.keeperName);
    await assertName(m.dupeId, m.dupeName);
  }
  console.log('Verificación de nombres OK (todos coinciden con lo esperado).\n');

  console.log(`Clientes que conservan su número: ${KEEP.length}`);
  for (const k of KEEP) console.log(`  [${k.id}] "${k.name}" -> ${normalizeColombianPhone(k.phone)}`);

  console.log(`\nClientes a los que se les quita el número: ${CLEAR.length}`);
  for (const c of CLEAR) console.log(`  [${c.id}] "${c.name}" -> (sin teléfono)`);

  console.log(`\nFusiones (nombre idéntico dentro del grupo): ${MERGE_PAIRS.length}`);
  for (const m of MERGE_PAIRS) {
    console.log(
      `  [${m.dupeId}] "${m.dupeName}" se fusiona en [${m.keeperId}] "${m.keeperName}" -> teléfono final: ${
        m.finalPhone ? normalizeColombianPhone(m.finalPhone) : '(sin teléfono)'
      }`
    );
  }

  if (!APPLY) {
    console.log('\nEjecuta con --apply para aplicar estos cambios.');
    return;
  }

  let cleared = 0;
  let kept = 0;
  let merged = 0;
  let reassignedAppointments = 0;

  for (const m of MERGE_PAIRS) {
    await prisma.$transaction(
      async (tx) => {
        const keeper = await tx.client.findUnique({ where: { id: m.keeperId } });
        const dupe = await tx.client.findUnique({ where: { id: m.dupeId } });

        const tags = new Set(JSON.parse(keeper.tags || '[]'));
        for (const t of JSON.parse(dupe.tags || '[]')) tags.add(t);
        const notes = [keeper.technicalNotes, dupe.technicalNotes].filter(Boolean);
        const birthDate = keeper.birthDate || dupe.birthDate;

        const { count } = await tx.appointment.updateMany({
          where: { clientId: dupe.id },
          data: { clientId: keeper.id },
        });
        reassignedAppointments += count;

        await tx.client.delete({ where: { id: dupe.id } });

        await tx.client.update({
          where: { id: keeper.id },
          data: {
            phone: m.finalPhone ? normalizeColombianPhone(m.finalPhone) : null,
            tags: JSON.stringify([...tags]),
            technicalNotes: notes.join('\n---\n') || null,
            birthDate,
          },
        });
      },
      { timeout: 20000 }
    );
    merged += 1;
  }

  for (const k of KEEP) {
    await prisma.client.update({
      where: { id: k.id },
      data: { phone: normalizeColombianPhone(k.phone) },
    });
    kept += 1;
  }

  for (const c of CLEAR) {
    await prisma.client.update({ where: { id: c.id }, data: { phone: null } });
    cleared += 1;
  }

  console.log(
    `\nListo. Fusiones: ${merged}, citas reasignadas en fusiones: ${reassignedAppointments}, ` +
      `números confirmados: ${kept}, teléfonos limpiados: ${cleared}.`
  );
}

main()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
