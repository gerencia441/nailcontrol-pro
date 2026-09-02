require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const EJECUTAR = process.argv.includes('--ejecutar');
const money = n => (n<0?'-':'')+Math.abs(Math.round(n)).toLocaleString('es-CO');
const day = d => new Date(d.getTime()-5*3600e3).toISOString().slice(0,10);
const hhmm = d => new Date(d.getTime()-5*3600e3).toISOString().slice(11,16);
const norm = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
const cliente = desc => norm((desc||'').split(' - ').pop());

(async () => {
  const mans = await p.manicurist.findMany();
  const flor = mans.find(m=>norm(m.name).startsWith('flor'));
  const nm = Object.fromEntries(mans.map(m=>[m.id,m.name.trim()]));
  const inc = await p.finance.findMany({ where:{type:'INCOME'}, orderBy:{date:'asc'} });
  const ap  = await p.appointment.findMany({ where:{status:'COMPLETED'}, include:{client:true,services:{include:{service:true}}} });

  // --- FASE 1: duplicados exactos
  const vistos={}, dups=[];
  for (const f of inc){const k=`${day(f.date)}|${f.amount}|${norm(f.description)}`; if(vistos[k])dups.push(f); else vistos[k]=f;}

  // --- Emparejamiento
  const dupIds=new Set(dups.map(f=>f.id));
  const usadas=new Set(), match={};
  for (const f of inc.filter(f=>!dupIds.has(f.id))) {
    const m = ap.find(a=>!usadas.has(a.id)&&day(a.date)===day(f.date)&&(a.finalPricePaid||0)===f.amount&&norm(a.client?.name)===cliente(f.description));
    if (m){ usadas.add(m.id); match[f.id]=m; }
  }
  // --- FASE 2: huerfanos con cita
  const aAtribuir = inc.filter(f=>!dupIds.has(f.id) && !f.manicuristId && match[f.id]);
  // --- FASE 4: citas completadas sin ingreso
  const sinIngreso = ap.filter(a=>!usadas.has(a.id));

  console.log(EJECUTAR ? '################  EJECUCION REAL  ################\n' : '################  SIMULACION (nada se escribe)  ################\n');
  console.log(`--- FASE 1: borrar ${dups.length} duplicados (${money(dups.reduce((s,f)=>s+f.amount,0))}) ---`);
  for (const f of dups) console.log(`   ${day(f.date)}  ${money(f.amount).padStart(8)}  ${f.manicuristId?nm[f.manicuristId]:'sin manicurista'} :: ${f.description.trim()}`);

  console.log(`\n--- FASE 2: atribuir ${aAtribuir.length} ingresos a su manicurista ---`);
  const resumen={};
  for (const f of aAtribuir){ const a=match[f.id]; const k=nm[a.manicuristId];
    resumen[k]=resumen[k]||{n:0,importe:0,com:0};
    resumen[k].n++; resumen[k].importe+=f.amount; resumen[k].com+=f.amount*(a.commissionPercentage/100); }
  for (const [k,v] of Object.entries(resumen)) console.log(`   ${k.padEnd(16)} ${String(v.n).padStart(3)} regs  ${money(v.importe).padStart(10)}  -> comision ${money(v.com)}`);

  console.log(`\n--- FASE 4: ${sinIngreso.length} citas a nombre de Flor + su ingreso ---`);
  for (const a of sinIngreso) console.log(`   ${day(a.date)} ${hhmm(a.date)}  ${money(a.finalPricePaid||0).padStart(8)}  ${a.client.name.trim()}  (era ${nm[a.manicuristId]} ${a.commissionPercentage}% -> pasa a Flor 10%)`);

  console.log(`\n--- FASE 2b: pagos de comision en efectivo a registrar (para no generar deuda) ---`);
  for (const [k,v] of Object.entries(resumen)) console.log(`   ${k.padEnd(16)} ${money(v.com)}`);

  if (!EJECUTAR) { console.log('\n(usa --ejecutar para aplicar)'); await p.$disconnect(); return; }

  // ================= EJECUCION =================
  const respaldo = { tomadoEl:new Date().toISOString(),
    fase1_borrados: dups,
    fase2_antes: aAtribuir.map(f=>({id:f.id, manicuristId:f.manicuristId, manicuristColor:f.manicuristColor, commissionPercentage:f.commissionPercentage})),
    fase4_citas_antes: sinIngreso.map(a=>({id:a.id, manicuristId:a.manicuristId, commissionPercentage:a.commissionPercentage})) };
  fs.writeFileSync(__dirname+'/../backup-pre-reconciliacion.json', JSON.stringify(respaldo,null,2));
  console.log('\nRespaldo -> backup-pre-reconciliacion.json');

  await p.$transaction(async tx => {
    for (const f of dups) await tx.finance.delete({ where:{id:f.id} });
    for (const f of aAtribuir) {
      const a = match[f.id]; const m = mans.find(x=>x.id===a.manicuristId);
      await tx.finance.update({ where:{id:f.id}, data:{
        manicuristId:a.manicuristId, manicuristColor:m?.color||null, commissionPercentage:a.commissionPercentage } });
    }
    for (const a of sinIngreso) {
      await tx.appointment.update({ where:{id:a.id}, data:{ manicuristId:flor.id, commissionPercentage:10 } });
      await tx.finance.create({ data:{
        type:'INCOME', amount:a.finalPricePaid||0,
        description:`${a.services.map(s=>s.service.name.trim()).join(' + ')} - ${a.client.name.trim()}`,
        date:a.date, paymentMethod:a.paymentMethod||'BANCOLOMBIA',
        manicuristId:flor.id, manicuristColor:flor.color, commissionPercentage:10 } });
    }
    for (const [k,v] of Object.entries(resumen)) {
      const m = mans.find(x=>x.name.trim()===k);
      await tx.finance.create({ data:{
        type:'EXPENSE', isCommission:true, amount:Math.round(v.com),
        description:`Pago de comisión en efectivo - ${k} (regularización may-jul)`,
        date:new Date('2026-08-01T05:00:00Z'), paymentMethod:'CASH',
        manicuristId:m.id, manicuristColor:m.color } });
    }
  }, { timeout: 60000 });
  console.log('Transaccion aplicada.');
  await p.$disconnect();
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
