/**
 * Script de teste para o emulator: cria uma trip e depois marca como 'completed'
 * Uso:
 *   node scripts/test_trigger_trip.js [driverId] [paymentType] [valorTotal]
 * Exemplo:
 *   node scripts/test_trigger_trip.js driver123 digital 45.5
 *
 * Atenção: rode com os emuladores do Firebase ativos (firestore + functions).
 */

const admin = require('firebase-admin');

async function main() {
  // inicializa Admin SDK (no emulator ele funcionará sem credenciais extras)
  try { admin.initializeApp(); } catch (e) {}
  const db = admin.firestore();

  const driverId = process.argv[2] || 'driver_test_1';
  const paymentType = process.argv[3] || 'digital';
  const valor = Number(process.argv[4] || 25.0);

  const tripRef = db.collection('trips').doc('trip_test_' + Date.now());

  const trip = {
    motoristaId: driverId,
    status: 'ongoing',
    tipo_pagamento: paymentType,
    valor_total: valor,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  console.log('Criando trip de teste:', trip);
  await tripRef.set(trip);

  console.log('Aguardando 2s e atualizando para completed...');
  await new Promise((r) => setTimeout(r, 2000));

  await tripRef.update({ status: 'completed' });
  console.log('Trip atualizada para completed. Verifique logs do emulator para invocação da Function.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Erro no script:', err);
  process.exit(1);
});
