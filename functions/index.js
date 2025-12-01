const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializa o Admin SDK (usado no Cloud Functions environment)
try {
  admin.initializeApp();
} catch (e) {
  // já inicializado
}

const db = admin.firestore();

// --- Configuráveis ---
const PLATFORM_FEE_PERCENTAGE = 0.10; // 10%
const DEBT_BLOCK_THRESHOLD = 500.0; // se dívida >= bloqueia cash
const MAX_CASH_RIDES_PER_DAY = 3; // limite corridas em dinheiro por dia
const MIN_PAYOUT_AMOUNT = 20.0; // exemplo para saque via PIX

// helper: round to 2 decimals
function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

// Registra uma transação para auditoria
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

// Função que processa quando uma trip é finalizada
exports.onTripCompleted = functions.firestore
  .document('trips/{tripId}')
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // somente agir quando existir after e status for 'completed' e antes não era 'completed'
    if (!after) return null;
    const statusAfter = after.status;
    const statusBefore = before ? before.status : null;
    if (statusAfter !== 'completed') return null;
    if (statusBefore === 'completed') return null; // já processado

    const tripId = context.params.tripId;
    const driverId = after.driverId;
    const tipoPagamento = after.tipo_pagamento || after.paymentType || 'digital';
    const valorTotal = Number(after.valor_total ?? after.preçoEstimado ?? 0);

    if (!driverId) {
      console.warn('Trip completed without driverId:', tripId);
      return null;
    }

    // run transaction to safely update driver doc and record transactions
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

      // always record tax transaction for platform revenue (even for cash, it becomes debt)
      await recordTransaction(tx, {
        driverId,
        tripId,
        type: 'tax',
        amount: fee,
        meta: { tripId, valorTotal, tipoPagamento },
      });

      if (tipoPagamento === 'digital') {
        // platform received the payment; abate dívida automaticamente
        if (debtBefore > 0) {
          if (valorMotorista >= debtBefore) {
            const remaining = round2(valorMotorista - debtBefore);
            debtAfter = 0;
            balanceAfter = round2(balanceBefore + remaining);

            // record debt decrease (full)
            await recordTransaction(tx, {
              driverId,
              tripId,
              type: 'debit',
              amount: debtBefore,
              meta: { reason: 'debt_decrease_full', tripId },
            });
          } else {
            // partial payment: reduce debt, no balance change
            const remainingDebt = round2(debtBefore - valorMotorista);
            debtAfter = remainingDebt;
            balanceAfter = balanceBefore;

            await recordTransaction(tx, {
              driverId,
              tripId,
              type: 'debit',
              amount: valorMotorista,
              meta: { reason: 'debt_decrease_partial', tripId },
            });
          }
        } else {
          // no debt: credit full driverGross
          balanceAfter = round2(balanceBefore + valorMotorista);
        }

        // credit to driver (if any)
        const credited = round2(balanceAfter - balanceBefore);
        if (credited > 0) {
          await recordTransaction(tx, {
            driverId,
            tripId,
            type: 'credit',
            amount: credited,
            meta: { reason: 'digital_trip_credit', tripId },
          });
        }
      } else {
        // cash payment: driver received 100% in hand, platform registers debt
        debtAfter = round2(debtBefore + fee);
        balanceAfter = balanceBefore;

        await recordTransaction(tx, {
          driverId,
          tripId,
          type: 'debt',
          amount: fee,
          meta: { reason: 'cash_trip_fee', tripId },
        });

          // Update cash rides count for the day to limit excessive cash-only behavior
          const todayStr = new Date().toISOString().slice(0, 10);
          const cashRidesDate = motoristaData.cashRidesDate || null;
          let cashRidesToday = Number(motoristaData.cashRidesToday || 0);
          if (cashRidesDate === todayStr) {
            cashRidesToday += 1;
          } else {
            cashRidesToday = 1;
          }

          // store these values after computing debt/block below
          // will update user doc including these
          motoristaData.cashRidesDate = todayStr;
          motoristaData.cashRidesToday = cashRidesToday;
      }

      // Business rules: block driver for cash if debt too high or too many cash rides
      let blockedForCash = Boolean(motoristaData.blockedForCash || false);
      if (debtAfter >= DEBT_BLOCK_THRESHOLD) blockedForCash = true;
      if ((motoristaData.cashRidesToday || 0) >= MAX_CASH_RIDES_PER_DAY) blockedForCash = true;

      // Prepare update payload
      const updatePayload = {
        'motoristaData.balance': balanceAfter,
        'motoristaData.debt': debtAfter,
        'motoristaData.blockedForCash': blockedForCash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // preserve cash counters if set
      if (motoristaData.cashRidesDate) updatePayload['motoristaData.cashRidesDate'] = motoristaData.cashRidesDate;
      if (typeof motoristaData.cashRidesToday !== 'undefined') updatePayload['motoristaData.cashRidesToday'] = motoristaData.cashRidesToday;

      tx.update(userRef, updatePayload);

      // also update trip doc to ensure values stored
      const tripRef = db.collection('trips').doc(tripId);
      tx.update(tripRef, {
        valor_taxa: fee,
        valor_motorista: valorMotorista,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, driverId, tripId, balanceBefore, balanceAfter, debtBefore, debtAfter };
    });
  });

// Export helper http endpoints for admin actions (optional)
exports.health = functions.https.onRequest((req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
