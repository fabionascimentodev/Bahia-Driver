// src/config/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
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
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rnAuth = require('firebase/auth/react-native');

  if (rnAuth && typeof rnAuth.initializeAuth === 'function' && typeof rnAuth.getReactNativePersistence === 'function') {
    // Inicializa o Auth com persistência baseada em AsyncStorage
    rnAuth.initializeAuth(app, { persistence: rnAuth.getReactNativePersistence(AsyncStorage) });
    // Obtém a instância após inicializar
    auth = getAuth(app);
  } else {
    // Fallback: obtém a instância padrão
    auth = getAuth(app);
  }
} catch (e) {
  // Se algo falhar ao tentar usar a integração React Native,
  // caímos para o getAuth padrão. Não lançamos para não interromper
  // execução em ambientes como web ou CI.
  // eslint-disable-next-line no-console
  console.warn('firebase/react-native persistence not available, using default getAuth', e);
  auth = getAuth(app);
}

export { auth };
export const firestore = getFirestore(app);
export const storage = getStorage(app);

export default app;
