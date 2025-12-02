import { firestore } from '../config/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Linking } from 'react-native';

const SUPPORT_EMAIL = 'suporte.bahia.driver@gmail.com';

export async function submitSupportReport(payload: {
  userId?: string | null;
  userName?: string | null;
  role?: string | null;
  subject: string;
  message: string;
  contactEmail?: string | null;
}) {
  try {
    const reports = collection(firestore, 'supportReports');
    const docRef = await addDoc(reports, {
      userId: payload.userId || null,
      userName: payload.userName || null,
      role: payload.role || null,
      subject: payload.subject,
      message: payload.message,
      contactEmail: payload.contactEmail || null,
      status: 'new',
      createdAt: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  } catch (e) {
    console.error('Erro ao gravar supportReport:', e);
    return { success: false, error: (e as Error).message || String(e) };
  }
}

export async function openMailClient(subject: string, body: string, to = SUPPORT_EMAIL) {
  try {
    const encodedSubject = encodeURIComponent(subject);
    const encodedBody = encodeURIComponent(body);
    const url = `mailto:${to}?subject=${encodedSubject}&body=${encodedBody}`;
    const can = await Linking.canOpenURL(url);
    if (can) {
      return Linking.openURL(url);
    }
    // fallback: try plain mailto without encoding
    return Linking.openURL(`mailto:${to}`);
  } catch (e) {
    console.warn('openMailClient failed:', e);
    return Promise.reject(e);
  }
}

export default { submitSupportReport, openMailClient };
