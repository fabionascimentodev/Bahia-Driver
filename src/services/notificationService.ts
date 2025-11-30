import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { logger } from './loggerService';

/**
 * Registra o dispositivo para receber push notifications e salva o token no Firestore.
 * Esta função é segura: em Expo Go ela NÃO tentará registrar e retornará null.
 */
export async function registerForPushNotificationsAsync(uid: string): Promise<string | null> {
  try {
    logger.debug('NOTIFICATIONS', 'Iniciando registro de push (wrapper seguro)', { uid });

    // Detecta Expo Go — nesse caso, não tentamos registrar (não suportado)
    if (Constants.appOwnership === 'expo') {
      logger.warn('NOTIFICATIONS', 'Expo Go detectado — registro de push não suportado aqui. Use um development build (EAS) para testar push.');
      return null;
    }

    // Somente em dispositivos físicos Android/iOS
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      logger.warn('NOTIFICATIONS', 'Registro de push disponível apenas em Android/iOS físicos.');
      return null;
    }

    // Importar dinamicamente `expo-notifications` apenas quando necessário (evita aviso no Expo Go)
    const Notifications = await import('expo-notifications');

    // Permissões
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.warn('NOTIFICATIONS', 'Permissão de notificações negada pelo usuário');
      return null;
    }

    // Obter token Expo Push
    let token: string | null = null;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      token = tokenData.data;
      logger.info('NOTIFICATIONS', 'Token Expo obtido', { tokenPreview: token?.substring(0, 20) });
    } catch (err) {
      logger.error('NOTIFICATIONS', 'Erro ao obter token Expo', err);
      return null;
    }

    // Salvar no Firestore
    if (token) {
      try {
        await updateDoc(doc(firestore, 'users', uid), {
          expoPushToken: token,
          pushToken: token,
          updatedAt: new Date(),
        });
        logger.success('NOTIFICATIONS', 'Token salvo no Firestore', { uid });
      } catch (fireErr) {
        logger.error('NOTIFICATIONS', 'Erro ao salvar token no Firestore', fireErr);
      }
    }

    return token;
  } catch (error) {
    logger.error('NOTIFICATIONS', 'Erro no registro de push (wrapper)', error);
    return null;
  }
}

/**
 * Função para enviar notificações push via Expo Push API
 */
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  try {
    logger.debug('NOTIFICATIONS', 'Enviando notificação', { title, body, tokenPreview: expoPushToken.substring(0, 20) + '...' });

    const message = {
      to: expoPushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (response.ok) {
      logger.success('NOTIFICATIONS', '✅ Notificação enviada com sucesso');
      return true;
    } else {
      const errorText = await response.text();
      logger.error('NOTIFICATIONS', '❌ Erro ao enviar notificação', { 
        status: response.status,
        error: errorText 
      });
      return false;
    }

  } catch (error) {
    logger.error('NOTIFICATIONS', '❌ Erro de rede ao enviar notificação', error);
    return false;
  }
}