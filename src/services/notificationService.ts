import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { firestore } from '../config/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';

// Configuração para exibir alertas mesmo quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // CORREÇÃO: Substituindo shouldShowAlert pelos novos campos:
    shouldShowBanner: true, // Mostra a notificação como um banner no topo da tela
    shouldShowList: true,   // Mostra a notificação na lista/central de notificações
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Função para registrar e salvar o token de notificação do dispositivo.
 * @param uid UID do usuário logado.
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<string | null> {
  let token: string | null = null;
  
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Falha ao obter o token de notificação: Permissão não concedida!');
      return null;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('FCM Token obtido:', token);
    
    // Salva o token no Firestore
    if (token) {
      await updateDoc(doc(firestore, 'users', uid), {
        pushToken: token,
        updatedAt: new Date(),
      });
      console.log('Token salvo no Firestore.');
    }

  } else {
    console.log('As notificações Push funcionam apenas em dispositivos físicos (iOS/Android).');
  }

  // Configurações específicas para Android (canais de notificação)
  if (Platform.OS === 'android') {
    // Definimos o canal principal de notificações de corridas
    Notifications.setNotificationChannelAsync('ride_channel', {
        name: 'Corridas Bahia Driver',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
    });
  }

  return token;
}

/**
 * Função de SIMULAÇÃO de Backend para Envio de Notificação via Expo.
 */
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title: title,
    body: body,
    data: data,
    _displayInForeground: true,
    // Garante que o canal certo seja usado no Android
    channelId: 'ride_channel', 
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (e) {
      console.error("Erro ao enviar notificação via Expo:", e);
  }
}