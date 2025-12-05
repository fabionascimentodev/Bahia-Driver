// src/services/AudioService.ts
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@bahia_driver_sound_settings';

type SoundType = 'online' | 'offline' | 'new_request';

// ✅ APENAS enabled - volume é controlado pelo sistema
export interface SoundSettings {
  enabled: boolean;
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
};

// URLs dos sons externos (fallback se não houver arquivos locais)
const EXTERNAL_SOUND_URLS = {
  ONLINE: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3',
  OFFLINE: 'https://assets.mixkit.co/sfx/preview/mixkit-warning-alarm-buzzer-1250.mp3',
  NEW_REQUEST: 'https://assets.mixkit.co/sfx/preview/mixkit-racing-countdown-timer-1051.mp3',
  
  // URLs alternativas caso as principais falhem
  ONLINE_ALT: 'https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3',
  OFFLINE_ALT: 'https://assets.mixkit.co/sfx/preview/mixkit-retro-game-emergency-alarm-1000.mp3',
};

class AudioService {
  private sounds: Partial<Record<SoundType, Audio.Sound>> = {};
  private isPlaying = false;
  private settings: SoundSettings = DEFAULT_SETTINGS;
  private initialized = false;

  /**
   * Inicializa o serviço de áudio
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    try {
      console.log('🔊 AudioService: Inicializando...');
      
      // Configura para usar volume do sistema
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Carrega configurações salvas
      const loadedSettings = await this.loadSettings();
      this.settings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

      // ✅ TENTA CARREGAR ARQUIVOS LOCAIS PRIMEIRO
      try {
        console.log('🔊 Tentando carregar sons locais...');
        
        // Importa os arquivos locais - verifique os nomes exatos dos seus arquivos
        const onlineSound = require('../../assets/sounds/online.wav');
        const offlineSound = require('../../assets/sounds/offline.wav');
        const newRequestSound = require('../../assets/sounds/new_request.wav');

        await this.loadSound('online', onlineSound);
        await this.loadSound('offline', offlineSound);
        await this.loadSound('new_request', newRequestSound);
        
        console.log('✅ Sons locais carregados com sucesso');
      } catch (e: any) {
        console.log('⚠️ Sons locais não encontrados ou erro:', e.message);
        console.log('🔊 Usando URLs externas como fallback');
      }

      this.initialized = true;
      console.log('✅ AudioService: Inicializado com sucesso');
    } catch (err: any) {
      console.error('❌ AudioService.init() falhou:', err.message);
    }
  }

  /**
   * Carrega um som específico
   */
  private async loadSound(type: SoundType, source: any): Promise<void> {
    try {
      // Limpa som anterior se existir
      if (this.sounds[type]) {
        try { await this.sounds[type]!.unloadAsync(); } catch (e) {}
        this.sounds[type] = undefined;
      }

      // Carrega sem definir volume (usa volume do sistema)
      console.log(`🔊 Carregando som "${type}"...`);
      const { sound } = await Audio.Sound.createAsync(source);
      this.sounds[type] = sound;
      
      console.log(`✅ Som "${type}" carregado com sucesso`);
    } catch (err: any) {
      console.error(`❌ Falha ao carregar som "${type}":`, err.message);
    }
  }

  /**
   * Tenta carregar um som local dinamicamente
   */
  private async tryLoadLocalSound(type: SoundType): Promise<any> {
    try {
      console.log(`🔊 Tentando carregar ${type} dinamicamente...`);
      
      // ❌ NÃO USAR require dinâmico com variáveis
      // Em vez disso, use switch/case para cada tipo
      
      switch (type) {
        case 'online':
          try {
            return require('../../assets/sounds/online.wav');
          } catch {
            try {
              return require('../../assets/sounds/online.wav');
            } catch {
              return null;
            }
          }
          
        case 'offline':
          try {
            return require('../../assets/sounds/offline.wav');
          } catch {
            try {
              return require('../../assets/sounds/offline.wav');
            } catch {
              return null;
            }
          }
          
        case 'new_request':
          try {
            return require('../../assets/sounds/new_request.wav');
          } catch {
            try {
              return require('../../assets/sounds/new_request.wav');
            } catch {
              return null;
            }
          }
          
        default:
          return null;
      }
      
    } catch (err: any) {
      console.log(`⚠️ Erro ao carregar ${type} localmente:`, err.message);
      return null;
    }
  }

  /**
   * Toca um som por tipo ou URL
   */
  async play(type: SoundType | { url: string }): Promise<void> {
    try {
      // Verifica se sons estão habilitados
      if (!this.settings.enabled) {
        console.log('🔊 Sons desabilitados, ignorando play');
        return;
      }

      // Para qualquer som atual para evitar sobreposição
      await this.stop();

      // Se for uma URL, toca diretamente
      if (typeof type === 'object' && 'url' in type) {
        await this.playFromUrlWithFallback(type.url, 'custom');
        return;
      }

      const soundType = type as SoundType;
      console.log(`🔊 Tentando tocar som: ${soundType}`);

      // Tenta tocar som pré-carregado
      if (this.sounds[soundType]) {
        const s = this.sounds[soundType]!;
        await s.playAsync(); // ✅ Sem volume definido - usa volume do sistema
        this.isPlaying = true;
        
        // Configura callback para quando terminar
        s.setOnPlaybackStatusUpdate((status: any) => {
          if (status?.didJustFinish) {
            this.isPlaying = false;
          }
        });
        
        console.log(`✅ Tocando som local "${soundType}"`);
        return;
      }

      // Fallback: tenta carregar localmente dinamicamente
      const localSource = await this.tryLoadLocalSound(soundType);
      if (localSource) {
        try {
          const { sound } = await Audio.Sound.createAsync(localSource);
          this.sounds[soundType] = sound;
          await sound.playAsync();
          this.isPlaying = true;
          
          sound.setOnPlaybackStatusUpdate((status: any) => {
            if (status?.didJustFinish) this.isPlaying = false;
          });
          
          console.log(`✅ Tocando som local carregado dinamicamente "${soundType}"`);
          return;
        } catch (err: any) {
          console.log(`⚠️ Falha ao tocar ${soundType} localmente:`, err.message);
        }
      }

      // Usa URL externa como último recurso
      console.log(`🔊 Usando URL externa para "${soundType}"`);
      await this.playExternalSound(soundType);
      
    } catch (err: any) {
      console.error('❌ AudioService.play() erro:', err.message);
    }
  }

  /**
   * Toca som externo baseado no tipo
   */
  private async playExternalSound(type: SoundType): Promise<void> {
    let url = '';
    switch(type) {
      case 'online': 
        url = EXTERNAL_SOUND_URLS.ONLINE;
        break;
      case 'offline': 
        url = EXTERNAL_SOUND_URLS.OFFLINE;
        break;
      case 'new_request': 
        url = EXTERNAL_SOUND_URLS.NEW_REQUEST;
        break;
    }
    
    if (url) {
      console.log(`🔊 Tocando som externo "${type}" de ${url}`);
      await this.playFromUrlWithFallback(url, type);
    }
  }

  /**
   * Toca som a partir de uma URL com fallback
   */
  private async playFromUrlWithFallback(url: string, type: SoundType | 'custom'): Promise<void> {
    try {
      console.log(`🔊 Tentando URL: ${url}`);
      
      // Primeira tentativa com timeout
      const timeout = 8000; // 8 segundos
      const soundPromise = Audio.Sound.createAsync({ uri: url });
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout ao carregar áudio')), timeout)
      );
      
      const { sound } = await Promise.race([soundPromise, timeoutPromise]) as any;
      this.isPlaying = true;
      
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status?.didJustFinish) this.isPlaying = false;
      });
      
      await sound.playAsync();
      console.log(`✅ URL tocada com sucesso: ${url}`);
      
      // Guarda referência para poder parar depois
      this.sounds['new_request'] = sound;
      
    } catch (err: any) {
      console.error(`❌ Falha na URL principal (${url}):`, err.message);
      
      // Tenta URL alternativa apenas se for um tipo conhecido
      if (type !== 'custom') {
        await this.tryAlternativeUrl(type as SoundType);
      }
    }
  }

  /**
   * Método playFromUrl simples (para compatibilidade)
   */
  private async playFromUrl(url: string): Promise<void> {
    return this.playFromUrlWithFallback(url, 'custom');
  }

  /**
   * Tenta URL alternativa
   */
  private async tryAlternativeUrl(type: SoundType): Promise<void> {
    try {
      console.log(`🔊 Tentando URL alternativa para ${type}...`);
      
      let altUrl = '';
      switch(type) {
        case 'online': altUrl = EXTERNAL_SOUND_URLS.ONLINE_ALT; break;
        case 'offline': altUrl = EXTERNAL_SOUND_URLS.OFFLINE_ALT; break;
        case 'new_request': altUrl = EXTERNAL_SOUND_URLS.NEW_REQUEST; break;
      }
      
      if (!altUrl) {
        console.log(`❌ Nenhuma URL alternativa para ${type}`);
        return;
      }
      
      const { sound } = await Audio.Sound.createAsync({ uri: altUrl });
      await sound.playAsync();
      console.log(`✅ URL alternativa tocada para ${type}`);
      
    } catch (altError: any) {
      console.error(`❌ Falha na URL alternativa para ${type}:`, altError.message);
      
      // Tenta criar um som de beep como último recurso
      await this.playEmergencyBeep();
    }
  }

  /**
   * Toca um beep de emergência (último recurso)
   */
  private async playEmergencyBeep(): Promise<void> {
    try {
      console.log('🔊 Tocando beep de emergência...');
      
      // Cria um som de beep simples
      // Em último caso, podemos pular - o importante é não travar o app
      console.log('⚠️ Não foi possível tocar som externo');
      
    } catch (error: any) {
      console.error('❌ Não foi possível tocar nenhum som:', error.message);
    }
  }

  /**
   * Para todos os sons
   */
  async stop(): Promise<void> {
    try {
      if (this.isPlaying) {
        console.log('🔊 Parando todos os sons...');
        for (const k of Object.keys(this.sounds) as SoundType[]) {
          const s = this.sounds[k];
          if (s) {
            try { await s.stopAsync(); } catch (e) {}
            try { await s.unloadAsync(); } catch (e) {}
            this.sounds[k] = undefined;
          }
        }
      }
      this.isPlaying = false;
    } catch (err: any) {
      console.error('❌ AudioService.stop() erro:', err.message);
    }
  }

  /**
   * Habilita/desabilita sons
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.settings.enabled = enabled;
    await this.saveSettings();
    if (!enabled) {
      await this.stop();
    }
    console.log(`🔊 Sons ${enabled ? 'habilitados' : 'desabilitados'}`);
  }

  /**
   * Retorna configurações atuais
   */
  getSettings(): SoundSettings {
    return this.settings;
  }

  /**
   * Verifica se está inicializado
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Carrega configurações do AsyncStorage
   */
  private async loadSettings(): Promise<SoundSettings | null> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SoundSettings;
    } catch (err: any) {
      console.error('❌ AudioService: Erro ao carregar configurações', err.message);
      return null;
    }
  }

  /**
   * Salva configurações no AsyncStorage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (err: any) {
      console.error('❌ AudioService: Erro ao salvar configurações', err.message);
    }
  }

  // ========== MÉTODOS CONVÊNIENTE ==========

  /**
   * Toca som de motorista ONLINE
   */
  async playDriverOnline(): Promise<void> {
    console.log('🎵 AudioService.playDriverOnline() chamado');
    try {
      if (!this.initialized) {
        console.log('🔊 AudioService não inicializado, inicializando...');
        await this.init();
      }
      await this.play('online');
      console.log('✅ playDriverOnline concluído');
    } catch (error: any) {
      console.error('❌ ERRO em playDriverOnline:', error.message);
    }
  }

  /**
   * Toca som de motorista OFFLINE
   */
  async playDriverOffline(): Promise<void> {
    console.log('🎵 AudioService.playDriverOffline() chamado');
    try {
      if (!this.initialized) {
        console.log('🔊 AudioService não inicializado, inicializando...');
        await this.init();
      }
      await this.play('offline');
      console.log('✅ playDriverOffline concluído');
    } catch (error: any) {
      console.error('❌ ERRO em playDriverOffline:', error.message);
    }
  }

  /**
   * Toca som de NOVA CORRIDA disponível
   */
  async playNewRideAvailable(): Promise<void> {
    console.log('🎵 AudioService.playNewRideAvailable() chamado');
    try {
      if (!this.initialized) {
        console.log('🔊 AudioService não inicializado, inicializando...');
        await this.init();
      }
      await this.play('new_request');
      console.log('✅ playNewRideAvailable concluído');
    } catch (error: any) {
      console.error('❌ ERRO em playNewRideAvailable:', error.message);
    }
  }

  /**
   * Toca som baseado no status
   */
  async playDriverStatusSound(status: 'online' | 'offline'): Promise<void> {
    console.log(`🎵 playDriverStatusSound: ${status}`);
    if (status === 'online') {
      await this.playDriverOnline();
    } else {
      await this.playDriverOffline();
    }
  }

  /**
   * Método de teste para verificar se o áudio funciona
   */
  async testAudio(): Promise<boolean> {
    try {
      console.log('🧪 Testando funcionalidade de áudio...');
      
      if (!this.initialized) {
        await this.init();
      }
      
      // Tenta carregar um som local primeiro
      try {
        const testSound = require('../../assets/sounds/online.wav');
        const { sound } = await Audio.Sound.createAsync(testSound);
        await sound.playAsync();
        await new Promise(resolve => setTimeout(resolve, 500));
        await sound.stopAsync();
        await sound.unloadAsync();
        console.log('✅ Teste de áudio LOCAL passou');
        return true;
      } catch (localError: any) {
        console.log('⚠️ Teste local falhou:', localError.message);
      }
      
      // Tenta URL externa
      try {
        const { sound } = await Audio.Sound.createAsync({
          uri: 'https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3'
        });
        await sound.playAsync();
        await new Promise(resolve => setTimeout(resolve, 500));
        await sound.stopAsync();
        await sound.unloadAsync();
        console.log('✅ Teste de áudio EXTERNO passou');
        return true;
      } catch (externalError: any) {
        console.error('❌ Teste externo falhou:', externalError.message);
        return false;
      }
      
    } catch (error: any) {
      console.error('❌ Teste de áudio falhou completamente:', error.message);
      return false;
    }
  }

  /**
   * Limpa recursos
   */
  async cleanup(): Promise<void> {
    await this.stop();
    this.initialized = false;
    console.log('🔊 AudioService: Recursos liberados');
  }
}

// ✅ Exporta instância singleton
export const audioService = new AudioService();
export default audioService;