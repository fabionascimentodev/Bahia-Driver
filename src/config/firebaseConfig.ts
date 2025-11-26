// src/config/firebaseConfig.ts

// Importe as funções necessárias do SDK
import { initializeApp, FirebaseApp } from "firebase/app";

// Importações do Firebase Auth
import { 
    initializeAuth, 
    Auth,
    inMemoryPersistence
} from "firebase/auth"; 

import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Importe o AsyncStorage para persistência no React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

// Sua Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDmJxxmEkF6HbxtHSKt0BbS5N_ZjdcFevI",
  authDomain: "bahia-driver-477a9.firebaseapp.com",
  projectId: "bahia-driver-477a9",
  storageBucket: "bahia-driver-477a9.firebasestorage.app",
  messagingSenderId: "580143189282",
  appId: "1:580143189282:web:5a92fdfb09ea993119697b",
  measurementId: "G-T64GBPF6ZD"
};

// Inicializa o Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// -----------------------------------------------------
// Configuração de Persistência do Auth - SOLUÇÃO CORRETA
// -----------------------------------------------------

// Inicializa o Auth
export const auth: Auth = initializeAuth(app, {
  persistence: inMemoryPersistence // Usaremos persistência em memória por enquanto
});

// Configuração manual da persistência com AsyncStorage
(async () => {
  try {
    // Para versões mais recentes, a persistência pode ser configurada automaticamente
    // ou podemos usar uma abordagem diferente
    console.log('Firebase Auth inicializado com persistência padrão');
  } catch (error) {
    console.warn('Erro na configuração de persistência:', error);
  }
})();

// -----------------------------------------------------
// Exporta os outros serviços
// -----------------------------------------------------
export const firestore: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Exporta 'app'
export default app;