const admin = require('firebase-admin');
const path = require('path');

// Backfill driver balance from rides history
// Usage:
//   node scripts/backfillDriverBalance.js <driverId|email> [--apply]

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
try {
  admin.initializeApp({ credential: admin.credential.cert(require(serviceAccountPath)) });
} catch (e) {
  try { admin.app(); } catch (_) { }
}

const db = admin.firestore();

const PLATFORM_FEE_PERCENTAGE = 0.20; // keep in sync with src/config/financeConfig.ts

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

async function findUserByArg(arg) {
  if (!arg) return null;
  if (arg.includes && arg.includes('@')) {
    const q = await db.collection('users').where('email', '==', arg).limit(1).get();
    if (q.empty) return null;
    return { id: q.docs[0].id, data: q.docs[0].data() };
  }
  const snap = await db.collection('users').doc(arg).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() };
}

async function computeFromRides(driverId) {
  // get finalized rides for driver
  const ridesCol = db.collection('rides');
  const snap = await ridesCol.where('motoristaId', '==', driverId).where('status', '==', 'finalizada').get();
  if (snap.empty) return { rides: [], balance: 0, debt: 0 };

  // sort by horaFim ascending (if present), fallback to createdAt
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => {
    const ta = a.horaFim ? new Date(a.horaFim).getTime() : (a.updatedAt && a.updatedAt.toDate ? a.updatedAt.toDate().getTime() : 0);
    const tb = b.horaFim ? new Date(b.horaFim).getTime() : (b.updatedAt && b.updatedAt.toDate ? b.updatedAt.toDate().getTime() : 0);
    return ta - tb;
  });

  let balance = 0;
  let debt = 0;

  const processed = [];

  for (const r of docs) {
    const total = parseMoney(r.valor_total ?? r.valorTotal ?? r['preçoEstimado'] ?? r.precoEstimado ?? r.preçoEstimado ?? 0);
    const fee = round2(total * PLATFORM_FEE_PERCENTAGE);
    const driverGross = round2(Math.max(0, total - fee));

    // determine payment type: prefer explicit, else infer from 'pago' boolean
    const paymentType = (r.tipo_pagamento || r.paymentType || (r.pago === true ? 'digital' : 'cash'));

    if (paymentType === 'digital') {
      if (debt > 0) {
        if (driverGross >= debt) {
          const remaining = round2(driverGross - debt);
          // clear debt
          processed.push({ rideId: r.id, action: 'debt_cleared', amount: debt, creditToBalance: remaining });
          driverGross > 0 && (balance = round2(balance + remaining));
          debt = 0;
        } else {
          // partial debt payment
          processed.push({ rideId: r.id, action: 'debt_partial', amount: driverGross });
          debt = round2(debt - driverGross);
        }
      } else {
        balance = round2(balance + driverGross);
        processed.push({ rideId: r.id, action: 'credit', amount: driverGross });
      }
    } else {
      // cash: fee becomes debt, balance unchanged
      debt = round2(debt + fee);
      processed.push({ rideId: r.id, action: 'debt_increase', amount: fee });
    }
  }

  return { ridesCount: docs.length, balance, debt, processed };
}

async function run() {
  const arg = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!arg) {
    console.error('Usage: node scripts/backfillDriverBalance.js <driverId|email> [--apply]');
    process.exit(1);
  }

  const found = await findUserByArg(arg);
  if (!found) {
    console.error('User not found for', arg);
    process.exit(2);
  }
  const driverId = found.id;
  const motoristaData = found.data.motoristaData || {};
  console.log('Found driver:', driverId);
  console.log('Existing motoristaData:', JSON.stringify(motoristaData, null, 2));

  const computed = await computeFromRides(driverId);
  console.log('\nComputed from rides:');
  console.log('  rides processed:', computed.ridesCount);
  console.log('  computed balance:', computed.balance.toFixed(2));
  console.log('  computed debt:', computed.debt.toFixed(2));

  const currentBalance = parseMoney(motoristaData.balance || 0);
  const currentDebt = parseMoney(motoristaData.debt || 0);
  console.log('\nCurrent stored:');
  console.log('  balance:', currentBalance.toFixed(2));
  console.log('  debt:', currentDebt.toFixed(2));

  if (Math.abs(currentBalance - computed.balance) < 0.01 && Math.abs(currentDebt - computed.debt) < 0.01) {
    console.log('\nNo update required — stored values match computed values.');
    return;
  }

  console.log('\nDifference detected:');
  console.log('  balance diff:', (computed.balance - currentBalance).toFixed(2));
  console.log('  debt diff:', (computed.debt - currentDebt).toFixed(2));

  if (!apply) {
    console.log('\nDry-run mode. To apply the computed values to the user document run with --apply.');
    return;
  }

  // Apply update
  const userRef = db.collection('users').doc(driverId);
  await userRef.update({ 'motoristaData.balance': computed.balance, 'motoristaData.debt': computed.debt, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log('\nApplied update to user document: motoristaData.balance and motoristaData.debt set.');
}

run().catch(err => { console.error('Error:', err); process.exit(1); });
