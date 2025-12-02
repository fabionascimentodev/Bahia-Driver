import { firestore } from '../config/firebaseConfig';
import {
  doc,
  getDoc,
  runTransaction,
  collection,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  PLATFORM_FEE_PERCENTAGE,
  TRANSACTIONS_COLLECTION,
  MAX_CONSECUTIVE_CASH_DAYS,
  DEBT_BLOCK_THRESHOLD,
} from '../config/financeConfig';

export type TransactionType =
  | 'credit'
  | 'fee'
  | 'debt_increase'
  | 'debt_decrease'
  | 'payout'
  | 'other';

export interface TransactionRecord {
  id?: string;
  driverId: string;
  rideId?: string | null;
  type: TransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  debtBefore: number;
  debtAfter: number;
  description?: string;
  paymentMethod?: 'cash' | 'digital' | 'pix' | null;
  createdAt?: any;
}

export async function recordTransaction(tx: any, record: TransactionRecord) {
  const transactionsCol = collection(firestore, TRANSACTIONS_COLLECTION);
  const newRef = doc(transactionsCol);
  const payload = {
    driverId: record.driverId,
    rideId: record.rideId || null,
    type: record.type,
    amount: Number(record.amount || 0),
    balanceBefore: Number(record.balanceBefore || 0),
    balanceAfter: Number(record.balanceAfter || 0),
    debtBefore: Number(record.debtBefore || 0),
    debtAfter: Number(record.debtAfter || 0),
    description: record.description || null,
    paymentMethod: record.paymentMethod || null,
    createdAt: serverTimestamp(),
  };

  if (tx) {
    tx.set(newRef, payload);
    return newRef.id;
  }

  await setDoc(newRef, payload);
  return newRef.id;
}

export async function processTripFinalization(
  rideId: string,
  options?: { paymentType?: 'cash' | 'digital'; totalAmount?: number }
) {
  const rideRef = doc(firestore, 'rides', rideId);

  return runTransaction(firestore, async (transaction) => {
    const rideSnap = await transaction.get(rideRef);
    if (!rideSnap.exists()) throw new Error('Ride not found');
    const rideData: any = rideSnap.data();

    const driverId = rideData.motoristaId;
    if (!driverId) throw new Error('Ride has no driver assigned');

    const usersRef = doc(firestore, 'users', driverId);
    const userSnap = await transaction.get(usersRef);
    if (!userSnap.exists()) throw new Error('Driver profile not found');
    const userData: any = userSnap.data();

    const motoristaData = userData.motoristaData || {};
    const balanceBefore = Number(motoristaData.balance || 0);
    const debtBefore = Number(motoristaData.debt || 0);

    const paymentType = options?.paymentType || (rideData.tipo_pagamento || 'digital');
    const totalAmount = Number(options?.totalAmount ?? (rideData.preçoEstimado ?? rideData.preçoEstimado ?? 0));

    const fee = Number((totalAmount * PLATFORM_FEE_PERCENTAGE));
    const driverGross = Number((totalAmount - fee).toFixed(2));

    let balanceAfter = balanceBefore;
    let debtAfter = debtBefore;

    const rideUpdate: any = {
      status: 'finalizada',
      horaFim: new Date().toISOString(),
      pago: paymentType === 'digital' ? true : false,
      valor_total: totalAmount,
      valor_taxa: fee,
      valor_motorista: driverGross,
      tipo_pagamento: paymentType,
      updatedAt: serverTimestamp(),
    };

    if (paymentType === 'digital') {
      if (debtBefore > 0) {
        if (driverGross >= debtBefore) {
          const remaining = Number((driverGross - debtBefore).toFixed(2));
          debtAfter = 0;
          balanceAfter = Number((balanceBefore + remaining).toFixed(2));

          await recordTransaction(transaction, {
            driverId,
            rideId,
            type: 'debt_decrease',
            amount: debtBefore,
            balanceBefore,
            balanceAfter,
            debtBefore,
            debtAfter,
            description: 'Abatimento automático de dívida por corrida digital',
            paymentMethod: 'digital',
          });
        } else {
          const remainingDebt = Number((debtBefore - driverGross).toFixed(2));
          debtAfter = remainingDebt;
          balanceAfter = balanceBefore;

          await recordTransaction(transaction, {
            driverId,
            rideId,
            type: 'debt_decrease',
            amount: driverGross,
            balanceBefore,
            balanceAfter,
            debtBefore,
            debtAfter,
            description: 'Abatimento parcial de dívida por corrida digital',
            paymentMethod: 'digital',
          });
        }
      } else {
        balanceAfter = Number((balanceBefore + driverGross).toFixed(2));
        debtAfter = debtBefore;
      }

      await recordTransaction(transaction, {
        driverId,
        rideId,
        type: 'fee',
        amount: fee,
        balanceBefore,
        balanceAfter,
        debtBefore,
        debtAfter,
        description: 'Taxa da plataforma retida (corrida digital)',
        paymentMethod: 'digital',
      });

      const credited = Number((balanceAfter - balanceBefore).toFixed(2));
      if (credited > 0) {
        await recordTransaction(transaction, {
          driverId,
          rideId,
          type: 'credit',
          amount: credited,
          balanceBefore,
          balanceAfter,
          debtBefore,
          debtAfter,
          description: 'Crédito ao motorista após corrida digital e abatimento de dívida',
          paymentMethod: 'digital',
        });
      }
    } else {
      debtAfter = Number((debtBefore + fee).toFixed(2));
      balanceAfter = balanceBefore;

      await recordTransaction(transaction, {
        driverId,
        rideId,
        type: 'debt_increase',
        amount: fee,
        balanceBefore,
        balanceAfter,
        debtBefore,
        debtAfter,
        description: 'Taxa da plataforma registrada como dívida (corrida em dinheiro)',
        paymentMethod: 'cash',
      });
    }

    let consecutiveCashDays = Number(motoristaData.consecutiveCashDays || 0);
    let blockedForCash = Boolean(motoristaData.blockedForCash || false);
    if (paymentType === 'cash') {
      consecutiveCashDays += 1;
    } else {
      consecutiveCashDays = 0;
    }

    if (debtAfter >= DEBT_BLOCK_THRESHOLD) blockedForCash = true;
    if (consecutiveCashDays >= MAX_CONSECUTIVE_CASH_DAYS) blockedForCash = true;

    const motoristaUpdate: any = {
      'motoristaData.balance': Number(balanceAfter.toFixed(2)),
      'motoristaData.debt': Number(debtAfter.toFixed(2)),
      'motoristaData.consecutiveCashDays': consecutiveCashDays,
      'motoristaData.blockedForCash': blockedForCash,
      updatedAt: serverTimestamp(),
    };

    transaction.update(usersRef, motoristaUpdate);
    transaction.update(rideRef, rideUpdate);

    return {
      success: true,
      driverId,
      balanceBefore,
      balanceAfter,
      debtBefore,
      debtAfter,
      fee,
      driverGross,
      paymentType,
    };
  });
}

export async function requestInstantPayout(driverId: string, amount: number) {
  return runTransaction(firestore, async (transaction) => {
    const userRef = doc(firestore, 'users', driverId);
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error('Driver not found');
    const data: any = snap.data();
    const balanceBefore = Number((data.motoristaData?.balance || 0));
    if (amount > balanceBefore) throw new Error('Insufficient balance');

    const fee = 0;
    const balanceAfter = Number((balanceBefore - amount - fee).toFixed(2));
    const debtBefore = Number((data.motoristaData?.debt || 0));
    const debtAfter = debtBefore;

    transaction.update(userRef, {
      'motoristaData.balance': balanceAfter,
      updatedAt: serverTimestamp(),
    });

    await recordTransaction(transaction, {
      driverId,
      rideId: null,
      type: 'payout',
      amount,
      balanceBefore,
      balanceAfter,
      debtBefore,
      debtAfter,
      description: 'Saque instantâneo via PIX',
      paymentMethod: 'pix',
    });

    return { success: true, balanceBefore, balanceAfter };
  });
}

export async function getEarningsSummary(driverId: string) {
  const { collection, query, where, getDocs, doc: docFn, getDoc } = require('firebase/firestore');
  const ridesCol = collection(firestore, 'rides');
  const q = query(ridesCol, where('motoristaId', '==', driverId), where('status', '==', 'finalizada'));
  const snap = await getDocs(q);

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const empty = { grossTotal: 0, driverGross: 0, platformFees: 0, ridesCount: 0 };
  const result = { daily: { ...empty }, weekly: { ...empty }, monthly: { ...empty } } as any;

  // Prepare weekday aggregation (last 7 days)
  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const earningsByWeekday: any = {}; // will hold totals for last 7 days by weekday
  weekdayNames.forEach((n) => (earningsByWeekday[n] = 0));

  snap.docs.forEach((d: any) => {
    const r: any = d.data();
    let when: Date = new Date();
    if (r.horaFim) {
      try { when = new Date(r.horaFim); } catch (e) { when = new Date(); }
    } else if (r.updatedAt && typeof r.updatedAt.toDate === 'function') {
      when = r.updatedAt.toDate();
    }

    const valorTotal = Number(r.valor_total ?? r.preçoEstimado ?? r.preçoEstimado ?? 0);
    const valorTaxa = Number(r.valor_taxa ?? 0) || 0;
    const valorMotorista = Number(r.valor_motorista ?? (valorTotal - valorTaxa));

    const addTo = (bucket: any) => {
      bucket.grossTotal += valorTotal;
      bucket.driverGross += valorMotorista;
      bucket.platformFees += valorTaxa;
      bucket.ridesCount += 1;
    };

    if (when >= dayAgo) addTo(result.daily);
    if (when >= weekAgo) addTo(result.weekly);
    if (when >= monthAgo) addTo(result.monthly);

    // If this ride falls within last week, add to weekday bucket
    if (when >= weekAgo) {
      try {
        const dayIndex = when.getDay(); // 0 (Sun) .. 6 (Sat)
        const dayName = weekdayNames[dayIndex];
        earningsByWeekday[dayName] = Number((earningsByWeekday[dayName] + valorMotorista).toFixed(2));
      } catch (e) {
        // ignore parsing errors
      }
    }
  });

  // current balance and debt
  const userRef = docFn(firestore, 'users', driverId);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() as any : {};
  const motoristaData = userData?.motoristaData || {};

  return {
    driverId,
    balance: Number(motoristaData.balance || 0),
    debt: Number(motoristaData.debt || 0),
    daily: result.daily,
    weekly: result.weekly,
    monthly: result.monthly,
    earningsByWeekday,
  };
}

export default {
  processTripFinalization,
  requestInstantPayout,
  getEarningsSummary,
};
