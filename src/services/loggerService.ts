import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS';
  module: string;
  message: string;
  data?: any;
  error?: string;
}

class LoggerService {
  private logs: LogEntry[] = [];
  private maxLogs = 100;
  private isInitialized = false;

  /**
   * Inicializa o serviço de logging
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('✅ LoggerService já inicializado');
      return;
    }
    
    try {
      console.log('🔧 Inicializando LoggerService...');
      
      // ✅ PRIMEIRO carrega logs existentes do AsyncStorage
      await this.loadLogs();
      
      // ✅ DEPOIS loga a inicialização
      this.log('LOGGER', 'INFO', '=== SERVIÇO DE LOGGER INICIALIZADO ===');
      this.isInitialized = true;
      
      // ✅ LOGS DE TESTE PARA VERIFICAR FUNCIONAMENTO
      this.success('LOGGER', 'LoggerService pronto para uso');
      this.info('LOGGER', `Plataforma: ${Platform.OS}`);
      this.warn('LOGGER', 'Sistema de logs ativo');
      
      console.log('✅ LoggerService inicializado com sucesso');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar Logger:', error);
      // Mesmo com erro, marca como inicializado para não bloquear
      this.isInitialized = true;
    }
  }

  /**
   * Registra um log genérico
   */
  private log(module: string, level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SUCCESS', message: string, data?: any) {
    // ✅ PERMITE LOGS MESMO SEM INICIALIZAÇÃO COMPLETA
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data,
    };

    this.logs.push(entry);

    // Manter apenas os últimos N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output com cor/formatação
    this.printToConsole(entry);
  }

  /**
   * Log de informação
   */
  info(module: string, message: string, data?: any) {
    this.log(module, 'INFO', message, data);
  }

  /**
   * Log de sucesso
   */
  success(module: string, message: string, data?: any) {
    this.log(module, 'SUCCESS', message, data);
  }

  /**
   * Log de aviso
   */
  warn(module: string, message: string, data?: any) {
    this.log(module, 'WARN', message, data);
  }

  /**
   * Log de erro
   */
  error(module: string, message: string, error?: any) {
    const errorString = error instanceof Error ? error.message : String(error);
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      module,
      message,
      error: errorString,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.printToConsole(entry);
  }

  /**
   * Log de debug
   */
  debug(module: string, message: string, data?: any) {
    this.log(module, 'DEBUG', message, data);
  }

  /**
   * Imprime no console com formatação
   */
  private printToConsole(entry: LogEntry) {
    const { timestamp, level, module, message, data, error } = entry;
    const time = new Date(timestamp).toLocaleTimeString();
    
    const levelColors: Record<string, string> = {
      INFO: '🔵',
      SUCCESS: '✅',
      WARN: '⚠️',
      ERROR: '❌',
      DEBUG: '🔍',
    };

    const icon = levelColors[level] || '📝';
    const logPrefix = `${icon} [${time}] [${module}] ${message}`;

    if (data) {
      console.log(logPrefix, data);
    } else if (error) {
      console.error(logPrefix, error);
    } else {
      console.log(logPrefix);
    }
  }

  /**
   * Obtém todos os logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Obtém logs filtrados
   */
  getLogsByLevel(level: string): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Obtém logs filtrados por módulo
   */
  getLogsByModule(module: string): LogEntry[] {
    return this.logs.filter(log => log.module === module);
  }

  /**
   * Limpa todos os logs
   */
  clearLogs() {
    this.logs = [];
    console.log('📋 Logs limpos');
  }

  /**
   * Salva logs no AsyncStorage
   */
  async saveLogs() {
    try {
      const logsJson = JSON.stringify(this.logs);
      await AsyncStorage.setItem('@bahia_driver_logs', logsJson);
    } catch (error) {
      console.error('Erro ao salvar logs:', error);
    }
  }

  /**
   * Carrega logs do AsyncStorage
   */
  async loadLogs() {
    try {
      const logsJson = await AsyncStorage.getItem('@bahia_driver_logs');
      if (logsJson) {
        const savedLogs = JSON.parse(logsJson);
        this.logs = savedLogs.slice(-this.maxLogs); // Mantém apenas os últimos
        console.log(`📁 ${savedLogs.length} logs carregados do storage`);
      } else {
        console.log('📁 Nenhum log anterior encontrado no storage');
      }
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  }

  /**
   * Exporta logs em formato de texto
   */
  exportLogs(): string {
    const header = `=== BAHIA DRIVER - LOG REPORT ===\nData: ${new Date().toLocaleString()}\nPlataforma: ${Platform.OS}\nTotal de Logs: ${this.logs.length}\n\n`;
    
    const logLines = this.logs.map(log => {
      const { timestamp, level, module, message, data, error } = log;
      let line = `[${timestamp}] ${level.padEnd(7)} | ${module.padEnd(15)} | ${message}`;
      
      if (data) {
        line += ` | Data: ${JSON.stringify(data)}`;
      }
      if (error) {
        line += ` | Erro: ${error}`;
      }
      
      return line;
    }).join('\n');

    return header + logLines;
  }

  /**
   * Imprime resumo dos logs no console
   */
  printSummary() {
    const errorLogs = this.getLogsByLevel('ERROR');
    const warnLogs = this.getLogsByLevel('WARN');
    const successLogs = this.getLogsByLevel('SUCCESS');
    
    console.log('\n📊 === RESUMO DE LOGS ===');
    console.log(`✅ Sucessos: ${successLogs.length}`);
    console.log(`⚠️  Avisos: ${warnLogs.length}`);
    console.log(`❌ Erros: ${errorLogs.length}`);
    console.log(`📝 Total: ${this.logs.length}`);
    console.log('========================\n');

    if (errorLogs.length > 0) {
      console.log('❌ Últimos erros:');
      errorLogs.slice(-3).forEach(log => {
        console.log(`  - ${log.message}: ${log.error}`);
      });
    }
  }
}

// Singleton
export const logger = new LoggerService();