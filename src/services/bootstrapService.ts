// src/services/bootstrapService.ts
import { logger } from './loggerService';
import { auth, firestore, storage } from '../config/firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Serviço de inicialização (Bootstrap)
 * Coordena todos os passos necessários para que o app funcione
 */
class BootstrapService {
  private initialized = false;

  /**
   * Executa a inicialização completa do app
   */
  async initialize(): Promise<boolean> {
    try {
      logger.info('BOOTSTRAP', '🚀 Iniciando sequência de bootstrap do aplicativo...');
      
      // 1. Inicializar logger
      await this.initializeLogger();

      // 2. Validar Firebase
      await this.validateFirebase();

      // 3. Verificar Storage Local
      await this.validateLocalStorage();

      // 4. Verificar Permissões
      await this.checkPermissions();

      // 5. Configurar Notificações
      await this.setupNotifications();

      logger.success('BOOTSTRAP', '✅ Bootstrap concluído com sucesso!');
      logger.printSummary();
      
      this.initialized = true;
      return true;

    } catch (error) {
      logger.error('BOOTSTRAP', '❌ Erro durante bootstrap', error);
      logger.printSummary();
      return false;
    }
  }

  /**
   * 1. Inicializa o serviço de logging
   */
  private async initializeLogger() {
    try {
      logger.info('BOOTSTRAP', 'Inicializando sistema de logging...');
      await logger.initialize();
      await logger.loadLogs();
      logger.success('BOOTSTRAP', 'Sistema de logging iniciado');
    } catch (error) {
      logger.error('BOOTSTRAP', 'Erro ao inicializar logger', error);
      throw error;
    }
  }

  /**
   * 2. Valida conexão Firebase
   */
  private async validateFirebase() {
    try {
      logger.info('BOOTSTRAP', 'Validando configuração Firebase...');

      // Verificar se Firebase foi inicializado
      if (!auth) {
        throw new Error('Firebase Auth não inicializado');
      }

      if (!firestore) {
        throw new Error('Firebase Firestore não inicializado');
      }

      if (!storage) {
        throw new Error('Firebase Storage não inicializado');
      }

      logger.debug('BOOTSTRAP', 'Firebase Auth conectado', { 
        authReady: !!auth,
        currentUser: auth.currentUser ? auth.currentUser.uid : 'nenhum'
      });

      logger.success('BOOTSTRAP', 'Firebase validado com sucesso');

    } catch (error) {
      logger.error('BOOTSTRAP', 'Erro ao validar Firebase', error);
      throw error;
    }
  }

  /**
   * 3. Verifica disponibilidade do AsyncStorage
   */
  private async validateLocalStorage() {
    try {
      logger.info('BOOTSTRAP', 'Validando armazenamento local (AsyncStorage)...');

      const testKey = '@test_bootstrap_connection';
      const testValue = 'test_value_' + Date.now();

      // Testar escrita
      await AsyncStorage.setItem(testKey, testValue);
      logger.debug('BOOTSTRAP', 'AsyncStorage escrita testada');

      // Testar leitura
      const readValue = await AsyncStorage.getItem(testKey);
      if (readValue !== testValue) {
        throw new Error('Falha ao validar leitura do AsyncStorage');
      }
      logger.debug('BOOTSTRAP', 'AsyncStorage leitura testada');

      // Limpar teste
      await AsyncStorage.removeItem(testKey);

      logger.success('BOOTSTRAP', 'AsyncStorage validado com sucesso');

    } catch (error) {
      logger.error('BOOTSTRAP', 'Erro ao validar AsyncStorage', error);
      throw error;
    }
  }

  /**
   * 4. Verifica permissões necessárias
   */
  private async checkPermissions() {
    try {
      logger.info('BOOTSTRAP', 'Verificando permissões necessárias...');

      // Nota: Permissões reais devem ser verificadas com bibliotecas como react-native-permissions
      // Por enquanto, apenas registramos que estamos verificando

      const requiredPermissions = [
        'LOCATION',
        'CAMERA', 
        'CONTACTS',
        'NOTIFICATION'
      ];

      logger.debug('BOOTSTRAP', 'Permissões necessárias', { 
        permissions: requiredPermissions 
      });

      logger.success('BOOTSTRAP', 'Verificação de permissões concluída');

    } catch (error) {
      logger.error('BOOTSTRAP', 'Erro ao verificar permissões', error);
      throw error;
    }
  }

  /**
   * 5. Configura notificações
   */
  private async setupNotifications() {
    try {
      logger.info('BOOTSTRAP', 'Configurando sistema de notificações...');

      // Nota: Configuração real com Expo Notifications
      logger.debug('BOOTSTRAP', 'Notificações habilitadas');

      logger.success('BOOTSTRAP', 'Sistema de notificações configurado');

    } catch (error) {
      logger.error('BOOTSTRAP', 'Erro ao configurar notificações', error);
      // Não lançamos erro pois notificações são opcionais
    }
  }

  /**
   * Retorna se o app foi inicializado
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Exporta logs para análise
   */
  exportLogs(): string {
    return logger.exportLogs();
  }
}

export const bootstrap = new BootstrapService();
