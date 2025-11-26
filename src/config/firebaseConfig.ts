// src/config/firebaseConfig.ts

// Importe as funções necessárias do SDK
import { initializeApp, FirebaseApp } from "firebase/app";

// ✨ Importações do Firebase Auth:
// getReactNativePersistence NÃO é exportado daqui, mas initializeAuth e Auth são.
import { 
    initializeAuth, 
    Auth,
    // Removendo getReactNativePersistence daqui
} from "firebase/auth"; 

import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Importe o AsyncStorage para persistência no React Native
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'; 

// ----------------------------------------------------------------------
// ✅ SOLUÇÃO DEFINITIVA: Usar 'require' para contornar o erro de Bundling
// ----------------------------------------------------------------------

// O Metro não consegue resolver o caminho de importação estática.
// Usamos 'require' para obter o getReactNativePersistence dinamicamente.
// @ts-ignore: Ignoramos temporariamente o erro de tipagem no require, pois sabemos que a função existe.
const { getReactNativePersistence } = require('firebase/auth/react-native');


// Sua Configuração do Firebase (Substitua pelos seus dados!)
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
// Configuração de Persistência do Auth
// -----------------------------------------------------

// Inicializa o Auth usando initializeAuth e fornece o AsyncStorage para persistência
export const auth: Auth = initializeAuth(app, {
    // getReactNativePersistence agora é resolvido via require
    persistence: getReactNativePersistence(ReactNativeAsyncStorage) 
});

// -----------------------------------------------------
// Exporta os outros serviços
// -----------------------------------------------------
export const firestore: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Exporta 'app'
export default app;