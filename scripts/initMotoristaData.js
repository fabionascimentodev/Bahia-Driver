/**
 * Script de migração: inicializa motoristaData para usuários existentes.
 * Uso:
 * 1) Crie um service account JSON do Firebase e defina a variável de ambiente:
 *    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
 * 2) Rode:
 *    node scripts/initMotoristaData.js
 *
 * OBS: Este script usa o SDK Admin do Firebase e deve ser executado em ambiente seguro.
 */

const admin = require('firebase-admin');

try {
  admin.initializeApp({});
} catch (e) {
  // already initialized in some environments
}

const db = admin.firestore();

async function run() {
  console.log('Iniciando migração: inicializar motoristaData para usuários...');
  const usersSnap = await db.collection('users').get();
  console.log(`Encontrados ${usersSnap.size} usuários.`);

  let updated = 0;
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    const perfil = data.perfil || (data.motoristaData ? 'motorista' : null);
    // Só inicializa para documentos que parecem ser motoristas ou já têm motoristaData faltando
    const needsMotorista = perfil === 'motorista' || data.motoristaData == null;
    if (!needsMotorista) continue;

    const motoristaData = data.motoristaData || {};
    const updatedPayload = {
      motoristaData: {
        balance: typeof motoristaData.balance === 'number' ? motoristaData.balance : 0,
        debt: typeof motoristaData.debt === 'number' ? motoristaData.debt : 0,
        consecutiveCashDays: typeof motoristaData.consecutiveCashDays === 'number' ? motoristaData.consecutiveCashDays : 0,
        blockedForCash: typeof motoristaData.blockedForCash === 'boolean' ? motoristaData.blockedForCash : false,
        // preserve vehicle data if present
        veiculo: motoristaData.veiculo || null,
        isRegistered: motoristaData.isRegistered || false,
      }
    };

    await db.collection('users').doc(doc.id).set(updatedPayload, { merge: true });
    updated += 1;
    if (updated % 50 === 0) console.log(`${updated} usuários atualizados...`);
  }

  console.log(`Migração finalizada. Total atualizados: ${updated}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Erro durante migração:', err);
  process.exit(1);
});
