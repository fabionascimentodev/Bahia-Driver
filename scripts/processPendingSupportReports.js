const admin = require('firebase-admin');
const path = require('path');

// Ajuste o caminho para sua service account caso necessário
const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

try {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
  });
} catch (e) {
  try { admin.app(); } catch (_) { /* ignore */ }
}

const db = admin.firestore();

async function main() {
  console.log('Processando supportReports pendentes (status: new, pending_no_smtp)...');

  let nodemailer;
  try {
    nodemailer = require('nodemailer');
  } catch (e) {
    console.error('Módulo nodemailer não encontrado. Instale com `npm i nodemailer` no diretório onde rodará este script.');
    process.exit(1);
  }

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const supportEmail = process.env.SUPPORT_EMAIL || 'bahia-driver@gmail.com';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error('Variáveis SMTP ausentes. Configure SMTP_HOST, SMTP_USER, SMTP_PASS antes de executar.');
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpSecure, auth: { user: smtpUser, pass: smtpPass } });

  try {
    const q = db.collection('supportReports').where('status', 'in', ['new', 'pending_no_smtp']).orderBy('createdAt', 'asc').limit(200);
    const snap = await q.get();
    if (snap.empty) {
      console.log('Nenhum supportReport pendente encontrado.');
      return;
    }

    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      console.log('Processando', id, 'subject:', d.subject || '—', 'user:', d.userName || '—');

      const subject = `[Suporte Bahia Driver] ${d.subject || 'Relato de usuário'}`;
      const body = `Relato ID: ${id}\nUsuário: ${d.userName || '—'} (${d.role || '—'})\nE-mail: ${d.contactEmail || '—'}\n\n--- Mensagem ---\n${d.message || ''}\n`;

      try {
        const info = await transporter.sendMail({ from: `${d.userName || 'Relato Bahia Driver'} <${smtpUser}>`, to: supportEmail, subject, text: body });
        await doc.ref.update({ status: 'sent', sentAt: admin.firestore.FieldValue.serverTimestamp(), mailInfo: { messageId: info.messageId } });
        console.log('Enviado:', info.messageId);
      } catch (err) {
        console.error('Falha ao enviar', id, err && err.message ? err.message : err);
        try {
          await doc.ref.update({ status: 'failed', processedAt: admin.firestore.FieldValue.serverTimestamp(), error: String(err) });
        } catch (e) { console.error('Falha ao atualizar status do doc', id, e); }
      }
    }

    console.log('Processamento concluído.');
  } catch (err) {
    console.error('Erro ao buscar supportReports:', err);
    process.exit(1);
  }
}

main();
