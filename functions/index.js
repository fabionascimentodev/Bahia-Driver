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
