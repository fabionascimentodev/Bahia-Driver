import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { firestore } from '../config/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { logger } from './loggerService';

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
  
  try {
    logger.debug('NOTIFICATIONS', 'Iniciando registro de notificações push');

    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      logger.debug('NOTIFICATIONS', `Plataforma detectada: ${Platform.OS}`);
      
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      logger.debug('NOTIFICATIONS', `Status de permissão atual: ${existingStatus}`);
      
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        logger.info('NOTIFICATIONS', 'Solicitando permissão de notificações...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        logger.debug('NOTIFICATIONS', `Novo status: ${status}`);
      }

      if (finalStatus !== 'granted') {
        logger.warn('NOTIFICATIONS', 'Permissão de notificações negada');
        return null;
      }
      
      const pushToken = await Notifications.getExpoPushTokenAsync();
      token = pushToken.data;
      logger.info('NOTIFICATIONS', 'Token de notificação obtido', { token: token.substring(0, 20) + '...' });
      
      // Salva o token no Firestore
      if (token) {
        await updateDoc(doc(firestore, 'users', uid), {
          pushToken: token,
          updatedAt: new Date(),
        });
        logger.success('NOTIFICATIONS', 'Token salvo no Firestore');
      }

    } else {
      logger.warn('NOTIFICATIONS', 'Notificações push disponíveis apenas em dispositivos físicos');
    }

    // Configurações específicas para Android (canais de notificação)
    if (Platform.OS === 'android') {
      logger.debug('NOTIFICATIONS', 'Configurando canal de notificações para Android');
      
      // Definimos o canal principal de notificações de corridas
      await Notifications.setNotificationChannelAsync('ride_channel', {
        name: 'Corridas Bahia Driver',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
      
      logger.success('NOTIFICATIONS', 'Canal de notificações configurado');
    }

    return token;

  } catch (error) {
    logger.error('NOTIFICATIONS', 'Erro ao registrar notificações', error);
    return null;
  }
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
    logger.debug('NOTIFICATIONS', 'Enviando notificação', { title, body });
    
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    logger.success('NOTIFICATIONS', 'Notificação enviada');

  } catch (error) {
    logger.error('NOTIFICATIONS', 'Erro ao enviar notificação', error);
  }
}