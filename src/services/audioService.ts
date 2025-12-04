import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@bahia_driver_sound_settings';

type SoundType = 'online' | 'offline' | 'new_request';

export interface SoundSettings {
  enabled: boolean;
  volume: number; // 0.0 - 1.0
}

const DEFAULT_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 1.0,
};

class AudioService {
  private sounds: Partial<Record<SoundType, Audio.Sound>> = {};
  private isPlaying = false;
  private settings: SoundSettings = DEFAULT_SETTINGS;
  private initialized = false;

  async init() {
    if (this.initialized) return;
    try {
      // Configure audio to play in background / silent-mode where supported
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false,
      });

      const loadedSettings = await this.loadSettings();
      this.settings = { ...DEFAULT_SETTINGS, ...(loadedSettings || {}) };

      // Preload local sounds if they exist (user should place files in assets/sounds)
      try {
        // These require() will fail early if files are missing — we catch and ignore
        const online = require('../../../assets/sounds/online.wav');
        const offline = require('../../../assets/sounds/offline.wav');
        const newReq = require('../../../assets/sounds/new_request.wav');

        await this.loadSound('online', online);
        await this.loadSound('offline', offline);
        await this.loadSound('new_request', newReq);
      } catch (e) {
        // ignore missing assets — library still works with remote URLs when using playFromURL
        // console.warn('Some local sound assets were not found in assets/sounds/', e);
      }

      this.initialized = true;
    } catch (err) {
      console.warn('AudioService.init() falhou:', err);
    }
  }

  private async loadSound(type: SoundType, source: any) {
    try {
      // unload previous if any
      if (this.sounds[type]) {
        try { await this.sounds[type]!.unloadAsync(); } catch (e) {}
        this.sounds[type] = undefined;
      }

      const { sound } = await Audio.Sound.createAsync(source, { volume: this.settings.volume });
      this.sounds[type] = sound;
    } catch (err) {
      console.warn('Falha ao carregar som', type, err);
    }
  }

  // Play local sound that was preloaded, or play remote url
  async play(type: SoundType | { url: string }) {
    try {
      if (!this.settings.enabled) return;

      // if an object with url provided, play that url
      if (typeof type === 'object' && 'url' in type) {
        await this.playFromUrl(type.url);
        return;
      }

      const soundType = type as SoundType;

      // stop previous sound to avoid overlap
      await this.stop();

      if (this.sounds[soundType]) {
        const s = this.sounds[soundType]!;
        await s.setStatusAsync({ volume: this.settings.volume, shouldPlay: true });
        this.isPlaying = true;
        s.setOnPlaybackStatusUpdate((status) => {
          if (!status || status.didJustFinish) {
            this.isPlaying = false;
          }
        });
        return;
      }

      // fallback: try explicit requires (metro bundler doesn't allow dynamic require())
      try {
        let res: any | null = null;
        if (soundType === 'online') {
          try { res = require('../../../assets/sounds/online.wav'); } catch (e) { res = null; }
        } else if (soundType === 'offline') {
          try { res = require('../../../assets/sounds/offline.wav'); } catch (e) { res = null; }
        } else if (soundType === 'new_request') {
          try { res = require('../../../assets/sounds/new_request.wav'); } catch (e) { res = null; }
        }

        if (res) {
          const { sound } = await Audio.Sound.createAsync(res, { volume: this.settings.volume });
          this.sounds[soundType] = sound;
          this.isPlaying = true;
          sound.setOnPlaybackStatusUpdate((status) => {
            if (!status || status.didJustFinish) this.isPlaying = false;
          });
        }
      } catch (err) {
        // nothing else to try
      }
    } catch (err) {
      console.warn('AudioService.play() erro:', err);
    }
  }

  private async playFromUrl(url: string) {
    try {
      await this.stop();
      const { sound } = await Audio.Sound.createAsync({ uri: url }, { volume: this.settings.volume });
      this.isPlaying = true;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status || status.didJustFinish) this.isPlaying = false;
      });
      // store in sounds map under a temporary key
      this.sounds['new_request'] = sound; // keep reference so stop() can unload
    } catch (err) {
      console.warn('Falha ao tocar URL', url, err);
    }
  }

  async stop() {
    try {
      if (this.isPlaying) {
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
    } catch (err) {
      console.warn('AudioService.stop() erro:', err);
    }
  }

  async setVolume(volume: number) {
    try {
      this.settings.volume = Math.max(0, Math.min(1, volume));
      await this.saveSettings();
      // update any loaded sounds
      for (const k of Object.keys(this.sounds) as SoundType[]) {
        const s = this.sounds[k];
        if (s) await s.setStatusAsync({ volume: this.settings.volume });
      }
    } catch (err) {
      console.warn('AudioService.setVolume erro:', err);
    }
  }

  async setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    await this.saveSettings();
    if (!enabled) {
      await this.stop();
    }
  }

  getSettings() {
    return this.settings;
  }

  async loadSettings(): Promise<SoundSettings | null> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as SoundSettings;
    } catch (err) {
      return null;
    }
  }

  async saveSettings() {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (err) {
      // ignore
    }
  }
}

export default new AudioService();
