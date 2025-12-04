const admin = require('firebase-admin');
const path = require('path');

// Usage:
// DRIVER_ID=<uid> node scripts/inspectDriverBalance.js
// or
// node scripts/inspectDriverBalance.js <uid>

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (e) {
  try { admin.app(); } catch (_) { /* ignore */ }
}

const db = admin.firestore();

async function main() {
  const cliArg = process.argv[2];
  const envId = process.env.DRIVER_ID;
  const arg = cliArg || envId;

  // If arg contains '@' treat as email lookup
  const emailArg = (arg && arg.includes && arg.includes('@')) ? arg : null;

  const driverId = (!emailArg) ? arg : null;

  if (!driverId && !emailArg) {
    console.log('No DRIVER_ID provided. Listing up to 20 users with motoristaData present...');
    const usersSnap = await db.collection('users').where('motoristaData', '!=', null).limit(20).get();
    if (usersSnap.empty) {
      console.log('No users with motoristaData found.');
      return;
    }
    usersSnap.forEach(doc => {
      const d = doc.data();
      const md = d.motoristaData || {};
      console.log('---');
      console.log('uid:', doc.id);
      console.log('balance (raw):', md.balance, 'type:', typeof md.balance);
      console.log('debt (raw):', md.debt, 'type:', typeof md.debt);
      console.log('consecutiveCashDays:', md.consecutiveCashDays);
    });
    return;
  }
  if (emailArg) {
    console.log('Looking up user by email:', emailArg);
    const q = await db.collection('users').where('email', '==', emailArg).limit(1).get();
    if (q.empty) {
      console.error('No user found with email:', emailArg);
      process.exit(2);
    }
    const doc = q.docs[0];
    console.log('Found uid:', doc.id);
    const snap = doc;
    const data = snap.data() || {};
    const motoristaData = data.motoristaData || {};
    console.log('motoristaData (raw):', JSON.stringify(motoristaData, null, 2));

    // continue to list transactions and rides below using doc.id
    var foundDriverId = doc.id;
    // show last 10 transactions for this driver (try ordered, fallback to unordered)
    console.log('\nLast transactions (up to 10):');
    try {
      const txSnap = await db.collection('transactions').where('driverId', '==', foundDriverId).orderBy('createdAt', 'desc').limit(10).get();
      if (txSnap.empty) console.log('  none');
      txSnap.forEach(t => {
        const td = t.data();
        console.log('  id:', t.id, 'type:', td.type, 'amount:', td.amount, 'balanceBefore:', td.balanceBefore, 'balanceAfter:', td.balanceAfter, 'createdAt:', (td.createdAt && td.createdAt.toDate ? td.createdAt.toDate().toISOString() : String(td.createdAt)));
      });
    } catch (txErr) {
      console.warn('  Ordered transactions query failed (index). Falling back to unordered limited query:', txErr.message || txErr);
      const txSnap2 = await db.collection('transactions').where('driverId', '==', foundDriverId).limit(10).get();
      if (txSnap2.empty) console.log('  none');
      txSnap2.forEach(t => {
        const td = t.data();
        console.log('  id:', t.id, 'type:', td.type, 'amount:', td.amount, 'balanceBefore:', td.balanceBefore, 'balanceAfter:', td.balanceAfter, 'createdAt:', (td.createdAt && td.createdAt.toDate ? td.createdAt.toDate().toISOString() : String(td.createdAt)));
      });
    }

    // show recent rides for that driver (try ordered, fallback to unordered)
    console.log('\nLast rides (up to 10):');
    try {
      const ridesSnap = await db.collection('rides').where('motoristaId', '==', foundDriverId).where('status', '==', 'finalizada').orderBy('horaFim', 'desc').limit(10).get();
      if (ridesSnap.empty) console.log('  none');
      ridesSnap.forEach(r => {
        const rd = r.data();
        console.log('  id:', r.id, 'horaFim:', rd.horaFim, 'valor_total:', rd.valor_total, 'valor_taxa:', rd.valor_taxa, 'valor_motorista:', rd.valor_motorista);
      });
    } catch (ridesErr) {
      console.warn('  Ordered rides query failed (index). Falling back to unordered limited query:', ridesErr.message || ridesErr);
      const ridesSnap2 = await db.collection('rides').where('motoristaId', '==', foundDriverId).where('status', '==', 'finalizada').limit(10).get();
      if (ridesSnap2.empty) console.log('  none');
      ridesSnap2.forEach(r => {
        const rd = r.data();
        console.log('  id:', r.id, 'horaFim:', rd.horaFim, 'valor_total:', rd.valor_total, 'valor_taxa:', rd.valor_taxa, 'valor_motorista:', rd.valor_motorista);
      });
    }

    return;
  }

  console.log('Inspecting driver:', driverId);
  const userRef = db.collection('users').doc(driverId);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error('User not found:', driverId);
    process.exit(2);
  }
  const data = snap.data() || {};
  const motoristaData = data.motoristaData || {};
  console.log('motoristaData (raw):', JSON.stringify(motoristaData, null, 2));

  // show last 10 transactions for this driver
  const txSnap = await db.collection('transactions').where('driverId', '==', driverId).orderBy('createdAt', 'desc').limit(10).get();
  console.log('\nLast transactions (up to 10):');
  if (txSnap.empty) console.log('  none');
  txSnap.forEach(t => {
    const td = t.data();
    console.log('  id:', t.id, 'type:', td.type, 'amount:', td.amount, 'balanceBefore:', td.balanceBefore, 'balanceAfter:', td.balanceAfter, 'createdAt:', (td.createdAt && td.createdAt.toDate ? td.createdAt.toDate().toISOString() : String(td.createdAt)));
  });

  // show recent rides for that driver
  const ridesSnap = await db.collection('rides').where('motoristaId', '==', driverId).where('status', '==', 'finalizada').orderBy('horaFim', 'desc').limit(10).get();
  console.log('\nLast rides (up to 10):');
  if (ridesSnap.empty) console.log('  none');
  ridesSnap.forEach(r => {
    const rd = r.data();
    console.log('  id:', r.id, 'horaFim:', rd.horaFim, 'valor_total:', rd.valor_total, 'valor_taxa:', rd.valor_taxa, 'valor_motorista:', rd.valor_motorista);
  });
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
