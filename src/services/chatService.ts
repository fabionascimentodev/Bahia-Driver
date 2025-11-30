import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';

export type ChatMessage = {
  id?: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string | null;
  text: string;
  createdAt?: any;
};

export const chatService = {
  async sendMessage(rideId: string, message: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const messagesRef = collection(firestore, 'rides', rideId, 'messages');
    const toSave = {
      ...message,
      createdAt: serverTimestamp(),
    };
    const msgDocRef = await addDoc(messagesRef, toSave);

    // Atualiza o documento da corrida com metadados do último recado e timestamp,
    // para suportar indicador de mensagens não lidas.
    try {
      const rideRef = doc(firestore, 'rides', rideId);
      await updateDoc(rideRef, {
        lastMessageAt: serverTimestamp(),
        lastMessageText: message.text,
        lastMessageSenderId: message.senderId,
      });
    } catch (e) {
      console.warn('Falha ao atualizar metadados da corrida com último recado:', e);
    }

    return msgDocRef;
  },

  listenToMessages(rideId: string, onUpdate: (msgs: ChatMessage[]) => void) {
    const messagesRef = collection(firestore, 'rides', rideId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      onUpdate(msgs);
    }, (err) => {
      console.error('Erro ao escutar mensagens do chat:', err);
    });

    return unsubscribe;
  }
};

// Marca as mensagens como lidas para o usuário no documento da corrida
export async function markMessagesAsRead(rideId: string, userId: string) {
  try {
    const rideRef = doc(firestore, 'rides', rideId);
    await updateDoc(rideRef, {
      [`lastRead.${userId}`]: serverTimestamp()
    });
  } catch (e) {
    console.error('Erro ao marcar mensagens como lidas:', e);
  }
}
