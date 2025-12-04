// src/config/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, type Auth, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { connectAuthEmulator } from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCIV-l5roJ4OE7cmaNsfc3HkSn4jDmA9gA",
  authDomain: "bahia-driver-477a9.firebaseapp.com",
  projectId: "bahia-driver-477a9",
  storageBucket: "bahia-driver-477a9.firebasestorage.app",
  messagingSenderId: "580143189282",
  appId: "1:580143189282:web:5a92fdfb09ea993119697b",
  measurementId: "G-T64GBPF6ZD"
};

// Inicializa o app Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços
// Tentativa de configurar persistência no React Native usando
// `initializeAuth` e `getReactNativePersistence` de
// 'firebase/auth/react-native'. Fazemos isso antes de criar a
// instância de `auth` para evitar que a instância padrão seja
// criada sem persistência (o que gera o aviso no runtime).
let auth: Auth;
try {
  // Se possível, inicializa o Auth com persistência React Native (AsyncStorage).
  // `getReactNativePersistence` pode não existir em algumas instalações/types —
  // tentamos carregar dinamicamente e cair para getAuth() caso não esteja disponível.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rnAuth = require('firebase/auth/react-native');
    if (rnAuth && typeof rnAuth.getReactNativePersistence === 'function') {
      const pers = rnAuth.getReactNativePersistence(AsyncStorage);
      initializeAuth(app, { persistence: pers });
      auth = getAuth(app);
    } else {
      // fallback
      auth = getAuth(app);
    }
  } catch (innerErr) {
    // Fallback para getAuth padrão se initializeAuth não funcionar
    // eslint-disable-next-line no-console
    console.warn('firebase/react-native persistence initialization failed or module not present — falling back to getAuth', innerErr);
    auth = getAuth(app);
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('firebase/react-native persistence not available, using default getAuth', e);
  auth = getAuth(app);
}

// === Conectar ao Firebase Auth Emulator automaticamente em dev ===
// Isso permite testar Phone Auth sem habilitar o provedor no Console (sem custos).
// NOTE: chamar `connectAuthEmulator` quando o emulador não está rodando causa
// erros de rede como `auth/network-request-failed`. Para evitar isso testamos
// se o host do emulador responde antes de conectar.
try {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const host = Platform.OS === 'android' ? 'http://10.0.2.2:9099' : 'http://localhost:9099';

    // Faz uma tentativa rápida de fetch no host do emulator. Se falhar, não conectamos.
    // Não aguardamos o resultado com await no topo de módulo; usamos promise handlers.
    fetch(host, { method: 'GET' })
      .then((res) => {
        // Se o emulador respondeu com qualquer status, assumimos que está rodando e conectamos
        try {
          connectAuthEmulator(auth, host, { disableWarnings: true });
          // eslint-disable-next-line no-console
          console.warn('[Firebase] Auth conectado ao emulator em', host);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('[Firebase] falha ao conectar ao Auth Emulator', err);
        }
      })
      .catch((err) => {
        // Se o fetch falhar (host não alcançável), não tentamos conectar — evita erros de rede.
        // eslint-disable-next-line no-console
        console.warn('[Firebase] Auth emulator não alcançável — pulando conexão ao emulator', host, err);
      });
  }
} catch (e) {
  // eslint-disable-next-line no-console
  console.warn('[Firebase] não foi possível verificar/conectar ao Auth Emulator', e);
}

export { auth };
export const firestore = getFirestore(app);
export const storage = getStorage(app);

export default app;
