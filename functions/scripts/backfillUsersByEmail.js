#!/usr/bin/env node
/**
 * Backfill script to create human-readable duplicate user documents in users/
 * Usage: node scripts/backfillUsersByEmail.js
 * Requires functions/serviceAccountKey.json and network access
 */
const admin = require('firebase-admin');
const path = require('path');

function loadServiceAccount() {
  try {
    const p = path.join(__dirname, '..', 'serviceAccountKey.json');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(p);
  } catch (e) {
    console.error('Não encontrei functions/serviceAccountKey.json. Coloque a chave antes de rodar este script.');
    process.exit(2);
  }
}

function sanitizeForPath(s) {
  if (!s) return 'user';
  try {
    const normalized = s.normalize ? s.normalize('NFD').replace(/[^\u0000-\u036f]/g, '') : s;
    const pre = String(normalized).replace(/@/g, '-at-').replace(/\./g, '-');
    const cleaned = pre.replace(/[^a-zA-Z0-9\s-_]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase();
    return cleaned.substring(0, 48);
  } catch (e) {
    return String(s).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 48);
  }
}

async function main() {
  const svc = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  const db = admin.firestore();

  console.log('Backfill: scanning users collection... (creating readable duplicates in users/)');
  const usersSnap = await db.collection('users').get();
  console.log('Found', usersSnap.size, 'users');

  let done = 0;
  for (const doc of usersSnap.docs) {
    try {
      const data = doc.data() || {};
      const uid = data.uid || doc.id;
      const email = data.email || data.nome || 'user';
      const displayId = `${sanitizeForPath(email)}_${uid}`;
      const dupRef = db.collection('users').doc(displayId);
      await dupRef.set({ uid, email: data.email || '', nome: data.nome || '', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      done++;
      console.log(`Backfilled ${displayId}`);
    } catch (err) {
      console.warn('Failed to backfill for', doc.id, String(err).substring(0, 160));
    }
  }

  console.log('Backfill completed. Processed:', done);
}

main().catch((e) => { console.error('Backfill failed', e); process.exit(1); });
