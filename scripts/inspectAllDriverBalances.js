const admin = require('firebase-admin');
const path = require('path');

// Inspeciona todos os motoristas e compara saldo gravado com saldo computado
// Usage:
//   node scripts/inspectAllDriverBalances.js [--apply] [--limit=N]

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
try {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
} catch (e) {
  try { admin.app(); } catch (_) { }
}

const db = admin.firestore();
const PLATFORM_FEE_PERCENTAGE = 0.20; // must stay in sync with src/config/financeConfig.ts

function parseMoney(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9,.-]+/g, '').replace(/,/g, '.');
    const n = Number(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function round2(x) { return Math.round((x + Number.EPSILON) * 100) / 100; }

async function computeFromRides(driverId) {
  const ridesCol = db.collection('rides');
  const snap = await ridesCol.where('motoristaId', '==', driverId).where('status', '==', 'finalizada').get();
  if (snap.empty) return { ridesCount: 0, balance: 0, debt: 0 };

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => {
    const ta = a.horaFim ? new Date(a.horaFim).getTime() : (a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : 0);
    const tb = b.horaFim ? new Date(b.horaFim).getTime() : (b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : 0);
    return ta - tb;
  });

  let balance = 0;
  let debt = 0;

  for (const r of docs) {
    const total = parseMoney(r.valor_total ?? r.valorTotal ?? r['preçoEstimado'] ?? r.precoEstimado ?? 0);
    const fee = round2(total * PLATFORM_FEE_PERCENTAGE);
    const driverGross = round2(Math.max(0, total - fee));
    const paymentType = (r.tipo_pagamento || r.paymentType || (r.pago === true ? 'digital' : 'cash'));

    if (paymentType === 'digital') {
      if (debt > 0) {
        if (driverGross >= debt) {
          const remaining = round2(driverGross - debt);
          if (remaining > 0) balance = round2(balance + remaining);
          debt = 0;
        } else {
          debt = round2(debt - driverGross);
        }
      } else {
        balance = round2(balance + driverGross);
      }
    } else {
      debt = round2(debt + fee);
    }
  }

  return { ridesCount: docs.length, balance, debt };
}

async function run() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

  console.log('Scanning users for motorista profiles...');

  // Query users that are motoristas. We try 'perfil' == 'motorista' first, fallback to motoristaData.isRegistered
  let usersQuery = db.collection('users').where('perfil', '==', 'motorista');
  const snapshot = await usersQuery.get();
  let docs = snapshot.docs;

  if (docs.length === 0) {
    // fallback
    console.log('No users with perfil==motorista. Falling back to motoristaData.isRegistered==true');
    usersQuery = db.collection('users').where('motoristaData.isRegistered', '==', true);
    const snap2 = await usersQuery.get();
    docs = snap2.docs;
  }

  console.log('Found', docs.length, 'driver candidates');
  if (limit) docs = docs.slice(0, limit);

  const report = [];
  for (const d of docs) {
    const uid = d.id;
    const data = d.data() || {};
    const motoristaData = data.motoristaData || {};
    const storedBalance = parseMoney(motoristaData.balance || 0);
    const storedDebt = parseMoney(motoristaData.debt || 0);

    const computed = await computeFromRides(uid);

    const balanceDiff = round2(computed.balance - storedBalance);
    const debtDiff = round2(computed.debt - storedDebt);

    report.push({ uid, email: data.email || null, storedBalance, storedDebt, computedBalance: computed.balance, computedDebt: computed.debt, balanceDiff, debtDiff, rides: computed.ridesCount });

    if (apply && (Math.abs(balanceDiff) > 0.009 || Math.abs(debtDiff) > 0.009)) {
      await db.collection('users').doc(uid).update({ 'motoristaData.balance': computed.balance, 'motoristaData.debt': computed.debt, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`Applied update for ${uid}: balance ${storedBalance.toFixed(2)} -> ${computed.balance.toFixed(2)}, debt ${storedDebt.toFixed(2)} -> ${computed.debt.toFixed(2)}`);
    }
  }

  console.log('\nSummary:');
  report.forEach(r => {
    if (Math.abs(r.balanceDiff) > 0.009 || Math.abs(r.debtDiff) > 0.009) {
      console.log(`- ${r.uid} (${r.email || 'no-email'}): rides=${r.rides} storedBalance=${r.storedBalance.toFixed(2)} computed=${r.computedBalance.toFixed(2)} diff=${r.balanceDiff.toFixed(2)}`);
    }
  });

  const mismatches = report.filter(r => Math.abs(r.balanceDiff) > 0.009 || Math.abs(r.debtDiff) > 0.009);
  console.log('\nDrivers with mismatch:', mismatches.length);
  if (!apply) console.log('\nDry-run complete. Re-run with --apply to update mismatched users.');
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
