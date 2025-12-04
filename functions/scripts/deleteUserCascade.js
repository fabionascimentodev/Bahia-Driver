#!/usr/bin/env node
/**
 * deleteUserCascade.js
 * Script run-once para apagar um usuário (Auth) e fazer a limpeza em Storage e Firestore.
 * Uso seguro: execute localmente em ambiente trusted com serviceAccountKey.json presente em functions/.
 *
 * node scripts/deleteUserCascade.js --email user@example.com
 * node scripts/deleteUserCascade.js --uid someUid
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

function usageAndExit() {
  console.log('Uso: node scripts/deleteUserCascade.js --email user@example.com  OR  --uid someUid');
  process.exit(1);
}

async function deleteQueryInBatches(db, q) {
  const snapshot = await q.get();
  if (!snapshot.size) return 0;
  const docs = snapshot.docs;
  const BATCH_SIZE = 400;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = docs.slice(i, i + BATCH_SIZE);
    slice.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += slice.length;
  }
  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) usageAndExit();

  let email = null;
  let uid = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email') email = args[i + 1];
    if (args[i] === '--uid') uid = args[i + 1];
  }
  if (!email && !uid) usageAndExit();

  const svc = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(svc) });
  const db = admin.firestore();
  const bucket = admin.storage().bucket();

  try {
    if (!uid && email) {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    }
    if (!uid) throw new Error('UID não resolvido');

    console.log('Iniciando operação destrutiva para UID:', uid);

    // 1) Delete Storage prefixes
    const prefixes = [
      `avatars/${uid}/`,
      `vehicles/${uid}/`,
      `vehicle_documents/${uid}/`,
      `cnhs/${uid}/`,
      `antecedentes/${uid}/`,
    ];

    const deletedPrefixes = [];
    for (const prefix of prefixes) {
      try {
        console.log('Removendo arquivos em Storage prefix:', prefix);
        await bucket.deleteFiles({ prefix });
        deletedPrefixes.push(prefix);
      } catch (err) {
        console.warn('Erro removendo prefix:', prefix, String(err).substring(0, 180));
      }
    }

    // 2) Delete firestore documents
    console.log('Removendo documentos principais em users/ e motoristas/');
    try { await db.collection('users').doc(uid).delete(); console.log('users/', uid, '=> deleted'); } catch (e) { console.warn('users delete error', String(e).substring(0,160)); }
    try { await db.collection('motoristas').doc(uid).delete(); console.log('motoristas/', uid, '=> deleted'); } catch (e) { console.warn('motoristas delete error', String(e).substring(0,160)); }

    // 2.a) Remove duplicate human-readable user docs inside users/ (docs where uid==uid but id != uid)
    try {
      console.log('Removendo duplicatas legíveis em users/ para uid:', uid);
      const q = db.collection('users').where('uid', '==', uid);
      const snapshot = await q.get();
      let removed = 0;
      for (const d of snapshot.docs) {
        if (d.id !== uid) {
          await d.ref.delete();
          removed++;
        }
      }
      console.log('users duplicates removed:', removed);
    } catch (e) {
      console.warn('Erro removendo duplicatas em users/', String(e).substring(0,160));
    }

    // 3) Delete from common related collections
    const map = [
      { collection: 'rides', fields: ['motoristaId', 'passageiroId'] },
      { collection: 'trips', fields: ['driverId', 'passengerId', 'motoristaId', 'passageiroId'] },
      { collection: 'transactions', fields: ['driverId', 'userId'] },
      { collection: 'supportReports', fields: ['userId'] },
    ];

    for (const entry of map) {
      let total = 0;
      for (const f of entry.fields) {
        try {
          const q = db.collection(entry.collection).where(f, '==', uid);
          const count = await deleteQueryInBatches(db, q);
          if (count) console.log(`Deleted ${count} docs from ${entry.collection} where ${f} == ${uid}`);
          total += count;
        } catch (e) {
          console.warn('Erro ao deletar em:', entry.collection, f, String(e).substring(0,160));
        }
      }
      if (total === 0) console.log(`Nenhum documento removido em ${entry.collection}`);
    }

    // 4) Delete auth user
    try {
      await admin.auth().deleteUser(uid);
      console.log('Auth user deleted:', uid);
    } catch (e) {
      console.warn('Falha ao deletar Auth user', String(e).substring(0,160));
    }

    console.log('Operação finalizada. Prefixos removidos:', deletedPrefixes);
  } catch (error) {
    console.error('Erro durante operação:', error.message || error);
    process.exit(4);
  }
}

main();
