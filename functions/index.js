const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializa o Admin SDK (usado no Cloud Functions environment)
try {
  admin.initializeApp();
} catch (e) {
  // já inicializado
}

const db = admin.firestore();

// --- nodemailer (opcional) ---
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('nodemailer not available in functions runtime (install dependencies).');
}

/**
 * Firestore trigger: when a supportReports document is created we send an email to the support inbox.
 * Requires SMTP settings in environment variables: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS
 */
exports.onSupportReportCreated = functions.firestore
  .document('supportReports/{reportId}')
  .onCreate(async (snap, context) => {
    const data = snap.exists ? snap.data() : null;
    if (!data) return null;

    // attempt to send email if nodemailer configured
    if (!nodemailer) {
      console.warn('nodemailer not available, skipping email send for supportReports:', context.params.reportId);
      return null;
    }

    // Prefer functions config (set with `firebase functions:config:set smtp.host=...`) then env vars
    const cfg = functions.config && typeof functions.config === 'function' ? functions.config() : {};
    const smtpCfg = cfg.smtp || {};
    const smtpHost = smtpCfg.host || process.env.SMTP_HOST;
    const smtpPort = Number(smtpCfg.port || process.env.SMTP_PORT || 587);
    const smtpSecure = String(smtpCfg.secure || process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
    const smtpUser = smtpCfg.user || process.env.SMTP_USER;
    const smtpPass = smtpCfg.pass || process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('SMTP configuration missing - set SMTP_HOST, SMTP_USER, SMTP_PASS to enable automatic emails.');
      try {
        await snap.ref.update({ status: 'pending_no_smtp', processedAt: admin.firestore.FieldValue.serverTimestamp() });
      } catch (e) { /* ignore */ }
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const subject = `[Suporte Bahia Driver] ${data.subject || 'Relato de usuário'}`;
    const body = `Relato ID: ${context.params.reportId}\nUsuário: ${data.userName || '—'} (${data.role || '—'})\nE-mail: ${data.contactEmail || '—'}\n\n--- Mensagem ---\n${data.message || ''}\n\n(gravado em supportReports/${context.params.reportId})`;

    // Resolve the support inbox: prefer functions config then env var, then default.
    const cfgAll = functions.config && typeof functions.config === 'function' ? functions.config() : {};
    const supportCfg = cfgAll.support || {};
    const effectiveSupportEmail = supportCfg.email || process.env.SUPPORT_EMAIL || 'bahia-driver@gmail.com';
    console.debug('onSupportReportCreated: sending support email to', effectiveSupportEmail);

    try {
      const info = await transporter.sendMail({
        from: `${data.userName || 'Relato Bahia Driver'} <${smtpUser}>`,
        to: effectiveSupportEmail,
        subject,
        text: body,
      });

      await snap.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp(), mailInfo: { messageId: info.messageId } });
      console.log('Support email sent:', info.messageId);
    } catch (err) {
      console.error('Failed to send support email:', err);
      try {
        await snap.ref.update({ status: 'failed', processedAt: admin.firestore.FieldValue.serverTimestamp(), error: String(err) });
      } catch (e) { /* ignore */ }
    }

    return null;
  });

// --- remaining helpers / sample functions (optional) ---
const PLATFORM_FEE_PERCENTAGE = 0.10; // 10%
const DEBT_BLOCK_THRESHOLD = 500.0;
const MAX_CASH_RIDES_PER_DAY = 3;
const MIN_PAYOUT_AMOUNT = 20.0;

function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

async function recordTransaction(transactionOrNull, payload) {
  const col = db.collection('transactions');
  const docRef = col.doc();
  const body = {
    driverId: payload.driverId || null,
    tripId: payload.tripId || null,
    type: payload.type || 'other',
    amount: Number(payload.amount || 0),
    meta: payload.meta || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (transactionOrNull) {
    transactionOrNull.set(docRef, body);
    return docRef.id;
  }
  await docRef.set(body);
  return docRef.id;
}

exports.onTripCompleted = functions.firestore
  .document('trips/{tripId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;
    if (!after) return null;
    const statusAfter = after.status;
    const statusBefore = before ? before.status : null;
    if (statusAfter !== 'completed') return null;
    if (statusBefore === 'completed') return null;

    const tripId = context.params.tripId;
    const driverId = after.driverId;
    const tipoPagamento = after.tipo_pagamento || after.paymentType || 'digital';
    const valorTotal = Number(after.valor_total ?? after.preçoEstimado ?? 0);

    if (!driverId) {
      console.warn('Trip completed without driverId:', tripId);
      return null;
    }

    return db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(driverId);
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        console.warn('Driver (user) not found for trip', tripId, driverId);
        return null;
      }
      const userData = userSnap.data() || {};
      const motoristaData = userData.motoristaData || {};
      const balanceBefore = Number(motoristaData.balance || 0);
      const debtBefore = Number(motoristaData.debt || 0);
      const fee = round2(valorTotal * PLATFORM_FEE_PERCENTAGE);
      const valorMotorista = round2(valorTotal - fee);
      let balanceAfter = balanceBefore;
      let debtAfter = debtBefore;

      await recordTransaction(tx, { driverId, tripId, type: 'tax', amount: fee, meta: { tripId, valorTotal, tipoPagamento } });

      if (tipoPagamento === 'digital') {
        if (debtBefore > 0) {
          if (valorMotorista >= debtBefore) {
            const remaining = round2(valorMotorista - debtBefore);
            debtAfter = 0;
            balanceAfter = round2(balanceBefore + remaining);
            await recordTransaction(tx, { driverId, tripId, type: 'debit', amount: debtBefore, meta: { reason: 'debt_decrease_full', tripId } });
          } else {
            const remainingDebt = round2(debtBefore - valorMotorista);
            debtAfter = remainingDebt;
            balanceAfter = balanceBefore;
            await recordTransaction(tx, { driverId, tripId, type: 'debit', amount: valorMotorista, meta: { reason: 'debt_decrease_partial', tripId } });
          }
        } else {
          balanceAfter = round2(balanceBefore + valorMotorista);
        }
        const credited = round2(balanceAfter - balanceBefore);
        if (credited > 0) {
          await recordTransaction(tx, { driverId, tripId, type: 'credit', amount: credited, meta: { reason: 'digital_trip_credit', tripId } });
        }
      } else {
        debtAfter = round2(debtBefore + fee);
        balanceAfter = balanceBefore;
        await recordTransaction(tx, { driverId, tripId, type: 'debt', amount: fee, meta: { reason: 'cash_trip_fee', tripId } });
        const todayStr = new Date().toISOString().slice(0, 10);
        const cashRidesDate = motoristaData.cashRidesDate || null;
        let cashRidesToday = Number(motoristaData.cashRidesToday || 0);
        if (cashRidesDate === todayStr) {
          cashRidesToday += 1;
        } else {
          cashRidesToday = 1;
        }
        motoristaData.cashRidesDate = todayStr;
        motoristaData.cashRidesToday = cashRidesToday;
      }

      let blockedForCash = Boolean(motoristaData.blockedForCash || false);
      if (debtAfter >= DEBT_BLOCK_THRESHOLD) blockedForCash = true;
      if ((motoristaData.cashRidesToday || 0) >= MAX_CASH_RIDES_PER_DAY) blockedForCash = true;

      const updatePayload = {
        'motoristaData.balance': balanceAfter,
        'motoristaData.debt': debtAfter,
        'motoristaData.blockedForCash': blockedForCash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (motoristaData.cashRidesDate) updatePayload['motoristaData.cashRidesDate'] = motoristaData.cashRidesDate;
      if (typeof motoristaData.cashRidesToday !== 'undefined') updatePayload['motoristaData.cashRidesToday'] = motoristaData.cashRidesToday;

      tx.update(userRef, updatePayload);
      const tripRef = db.collection('trips').doc(tripId);
      tx.update(tripRef, { valor_taxa: fee, valor_motorista: valorMotorista, processedAt: admin.firestore.FieldValue.serverTimestamp() });

      return { success: true, driverId, tripId, balanceBefore, balanceAfter, debtBefore, debtAfter };
    });
  });

exports.health = functions.https.onRequest((req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

/**
 * Callable admin function: delete a user and cascade-delete related data
 * Usage: called by an authenticated admin (custom claim `admin: true`).
 * Params: { uid?: string, email?: string }
 */
exports.adminDeleteUser = functions.https.onCall(async (data, context) => {
  // Security: only callable by authenticated admins (custom claim 'admin' required)
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'A chamada deve ser autenticada.');
  }
  if (!context.auth.token || !context.auth.token.admin) {
    throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem executar esta função.');
  }

  const { uid: targetUid, email } = data || {};
  if (!targetUid && !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Forneça `uid` ou `email` do usuário a ser removido.');
  }

  let uid = targetUid;
  try {
    if (!uid && email) {
      const userRecord = await admin.auth().getUserByEmail(email);
      uid = userRecord.uid;
    }

    if (!uid) throw new Error('UID não resolvido');

    const results = { deletedAuth: false, deletedStoragePrefixes: [], deletedCollections: {}, errors: [] };

    // 1) Delete Storage objects under folders where user's files are expected
    try {
      const bucket = admin.storage().bucket();
      const prefixes = [
        `avatars/${uid}/`,
        `vehicles/${uid}/`,
        `vehicle_documents/${uid}/`,
        `cnhs/${uid}/`,
        `antecedentes/${uid}/`,
      ];

      for (const prefix of prefixes) {
        try {
          // deleteFiles removes objects under the prefix
          await bucket.deleteFiles({ prefix });
          results.deletedStoragePrefixes.push(prefix);
        } catch (err) {
          results.errors.push({ stage: 'storage-delete', prefix, error: String(err) });
        }
      }
    } catch (err) {
      results.errors.push({ stage: 'storage', error: String(err) });
    }

    // Helper to delete query results in batches
    async function deleteQueryInBatches(q) {
      const snapshot = await q.get();
      const docs = snapshot.docs;
      if (!docs.length) return 0;
      // Use batches of 400 to be safe
      let deleted = 0;
      const BATCH_SIZE = 400;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const slice = docs.slice(i, i + BATCH_SIZE);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += slice.length;
      }
      return deleted;
    }

    // 2) Delete Firestore documents: users, motoristas and related collections
    try {
      // remove main documents
      await db.collection('users').doc(uid).delete();
      results.deletedCollections.users = true;
    } catch (err) {
      results.errors.push({ stage: 'delete-user-doc', error: String(err) });
      results.deletedCollections.users = false;
    }

    try {
      await db.collection('motoristas').doc(uid).delete();
      results.deletedCollections.motoristas = true;
    } catch (err) {
      results.errors.push({ stage: 'delete-motoristas-doc', error: String(err) });
      results.deletedCollections.motoristas = false;
    }

    // delete from collections by matching known fields
    const deletionMap = [
      { collection: 'rides', fields: ['motoristaId', 'passageiroId'] },
      { collection: 'trips', fields: ['driverId', 'passengerId', 'motoristaId', 'passageiroId'] },
      { collection: 'transactions', fields: ['driverId', 'userId'] },
      { collection: 'supportReports', fields: ['userId'] },
      { collection: 'transactions', fields: ['driverId', 'userId'] },
    ];

    for (const entry of deletionMap) {
      const { collection, fields } = entry;
      let totalDeleted = 0;
      try {
        for (const f of fields) {
          const q = db.collection(collection).where(f, '==', uid);
          const deletedCount = await deleteQueryInBatches(q);
          totalDeleted += deletedCount;
        }
        results.deletedCollections[collection] = totalDeleted;
      } catch (err) {
        results.errors.push({ stage: 'delete-collection', collection, error: String(err) });
        results.deletedCollections[collection] = totalDeleted;
      }
    }

    // delete duplicate human-readable docs in users/ that reference this uid (documents where uid == uid but id != uid)
    try {
      const qDup = db.collection('users').where('uid', '==', uid);
      const snapshot = await qDup.get();
      let dupDeleted = 0;
      for (const d of snapshot.docs) {
        if (d.id !== uid) {
          await d.ref.delete();
          dupDeleted++;
        }
      }
      results.deletedCollections['users_readable_duplicates'] = dupDeleted;
    } catch (err) {
      results.errors.push({ stage: 'delete-users-duplicates', error: String(err) });
      results.deletedCollections['users_readable_duplicates'] = 0;
    }

    // 3) Delete auth user
    try {
      await admin.auth().deleteUser(uid);
      results.deletedAuth = true;
    } catch (err) {
      results.errors.push({ stage: 'delete-auth', error: String(err) });
      results.deletedAuth = false;
    }

    return { ok: true, uid, results };
  } catch (error) {
    console.error('adminDeleteUser: error', error);
    throw new functions.https.HttpsError('internal', String(error));
  }
});


/**
 * Firestore trigger: when a users/{uid} document is deleted (for example via Firebase Console)
 * this will attempt to cascade-delete Storage objects under known prefixes, remove related docs
 * and delete the Auth user if present. This allows admins to remove users directly using the
 * Firestore console and still trigger a full cleanup.
 */
exports.onUserDocDeleted = functions.firestore
  .document('users/{uid}')
  .onDelete(async (snap, context) => {
    const uid = context.params.uid || (snap.exists ? snap.data().uid : null);
    if (!uid) {
      console.warn('onUserDocDeleted: no uid available, skipping');
      return null;
    }

    const results = { deletedStoragePrefixes: [], deletedCollections: {}, deletedAuth: false, errors: [] };
    try {
      // 1) Delete Storage objects for this uid
      try {
        const bucket = admin.storage().bucket();
        const prefixes = [
          `avatars/${uid}/`,
          `vehicles/${uid}/`,
          `vehicle_documents/${uid}/`,
          `cnhs/${uid}/`,
          `antecedentes/${uid}/`,
        ];

        for (const prefix of prefixes) {
          try {
            await bucket.deleteFiles({ prefix });
            results.deletedStoragePrefixes.push(prefix);
          } catch (err) {
            console.warn('onUserDocDeleted - storage delete failed for prefix', prefix, String(err).slice(0, 200));
            results.errors.push({ stage: 'storage-delete', prefix, error: String(err) });
          }
        }
      } catch (err) {
        results.errors.push({ stage: 'storage', error: String(err) });
      }

      // helper to delete queries in batches
      async function deleteQueryInBatchesLocal(q) {
        const snapshot = await q.get();
        const docs = snapshot.docs || [];
        if (!docs.length) return 0;
        let deleted = 0;
        const BATCH_SIZE = 400;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const batch = db.batch();
          const slice = docs.slice(i, i + BATCH_SIZE);
          slice.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          deleted += slice.length;
        }
        return deleted;
      }

      // 2) Delete known docs
      try {
        await db.collection('users').doc(uid).delete().catch(() => {}); // already deleted or remove silently
        results.deletedCollections.users = true;
      } catch (err) {
        results.errors.push({ stage: 'delete-user-doc', error: String(err) });
        results.deletedCollections.users = false;
      }

      try {
        await db.collection('motoristas').doc(uid).delete().catch(() => {});
        results.deletedCollections.motoristas = true;
      } catch (err) {
        results.errors.push({ stage: 'delete-motoristas-doc', error: String(err) });
        results.deletedCollections.motoristas = false;
      }

      // delete from other collections by matching fields
      const deletionMap = [
        { collection: 'rides', fields: ['motoristaId', 'passageiroId'] },
        { collection: 'trips', fields: ['driverId', 'passengerId', 'motoristaId', 'passageiroId'] },
        { collection: 'transactions', fields: ['driverId', 'userId'] },
        { collection: 'supportReports', fields: ['userId'] },
      ];

      for (const entry of deletionMap) {
        const { collection, fields } = entry;
        let totalDeleted = 0;
        try {
          for (const f of fields) {
            const q = db.collection(collection).where(f, '==', uid);
            const count = await deleteQueryInBatchesLocal(q);
            totalDeleted += count;
          }
          results.deletedCollections[collection] = totalDeleted;
        } catch (err) {
          results.errors.push({ stage: 'delete-collection', collection, error: String(err) });
          results.deletedCollections[collection] = totalDeleted;
        }
      }

        // delete duplicate human-readable docs in users/ that reference this uid (docs where uid==uid but id != uid)
        try {
          const qDup = db.collection('users').where('uid', '==', uid);
          const snapDup = await qDup.get();
          let dupDeleted = 0;
          for (const d of snapDup.docs) {
            if (d.id !== uid) {
              await d.ref.delete();
              dupDeleted++;
            }
          }
          results.deletedCollections['users_readable_duplicates'] = dupDeleted;
        } catch (err) {
          results.errors.push({ stage: 'delete-users-duplicates', error: String(err) });
          results.deletedCollections['users_readable_duplicates'] = 0;
        }

      // 3) Delete auth user
      try {
        await admin.auth().deleteUser(uid);
        results.deletedAuth = true;
      } catch (err) {
        // If the auth user already removed, ignore
        console.warn('onUserDocDeleted - auth delete:', String(err).slice(0,200));
        results.errors.push({ stage: 'delete-auth', error: String(err) });
        results.deletedAuth = false;
      }

      console.log('onUserDocDeleted completed for', uid, results);
      return { ok: true, uid, results };

    } catch (error) {
      console.error('onUserDocDeleted error:', error);
      return { ok: false, error: String(error) };
    }
  });
