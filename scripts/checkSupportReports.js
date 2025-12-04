const admin = require('firebase-admin');
const path = require('path');

// Ajuste o caminho para sua service account caso necessário
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (e) {
  // já inicializado possivelmente
  try { admin.app(); } catch (_) { /* ignore */ }
}

const db = admin.firestore();

async function main() {
  console.log('Buscando últimos 10 supportReports...');
  try {
    const q = db.collection('supportReports').orderBy('createdAt', 'desc').limit(10);
    const snap = await q.get();
    if (snap.empty) {
      console.log('Nenhum documento encontrado em supportReports.');
      return;
    }
    snap.forEach(doc => {
      const d = doc.data();
      const createdAt = d.createdAt && d.createdAt.toDate ? d.createdAt.toDate().toISOString() : String(d.createdAt || '');
      console.log('---');
      console.log('id:', doc.id);
      console.log('userId:', d.userId || '—');
      console.log('userName:', d.userName || '—');
      console.log('subject:', d.subject || '—');
      console.log('contactEmail:', d.contactEmail || '—');
      console.log('status:', d.status || '—');
      console.log('createdAt:', createdAt);
      if (d.mailInfo) console.log('mailInfo:', d.mailInfo);
      if (d.error) console.log('error:', d.error);
      if (d.message) console.log('message (preview):', (d.message || '').slice(0, 200));
    });
  } catch (err) {
    console.error('Erro ao buscar supportReports:', err);
    process.exit(1);
  }
}

main();
