#!/usr/bin/env node
/**
 * Script de uso local (run-once) para setar a custom claim `admin: true` em um usuário
 * Requisitos:
 * - Ter o arquivo serviceAccountKey.json em functions/
 * - Node com dependências do projeto instaladas (npm install no diretório functions)
 * Uso:
 *   node scripts/setAdminClaim.js email@exemplo.com
 */
const admin = require('firebase-admin');
const path = require('path');

function loadServiceAccount() {
  try {
    const p = path.join(__dirname, '..', 'serviceAccountKey.json');
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(p);
  } catch (e) {
    console.error('Não encontrei serviceAccountKey.json em functions/. Coloque a chave de conta de serviço para rodar este script.');
    process.exit(2);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Uso: node scripts/setAdminClaim.js <email>');
    process.exit(1);
  }
  const email = args[0];

  const svc = loadServiceAccount();
  admin.initializeApp({ credential: admin.credential.cert(svc) });

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Claim 'admin' configurada para ${email} (uid=${user.uid}).`);
    console.log('Nota: o usuário pode precisar desconectar / reconectar para obter o token atualizado.');
  } catch (err) {
    console.error('Falha ao setar claim:', err.message || err);
    process.exit(3);
  }
}

main();
