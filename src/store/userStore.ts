import { create } from "zustand";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from "../types/UserTypes";
import { Coords } from "../services/locationServices";

/**
 * Interface que define a estrutura do estado global do usuário.
 */
export interface UserStoreState {
  user: UserProfile | null | undefined; // undefined = checando autenticação inicial
  driverLocation: Coords | null;        // ← CORRIGIDO: Estava dentro do comentário
  isDriverOnline: boolean;
  // (dark-mode support removed)

  // Controle de carregamento global
  isLoading: boolean;

  // Ações (Mutators)
  setUser: (user: UserProfile | null | undefined) => void;
  setLoading: (loading: boolean) => void;
  setDriverLocation: (location: Coords | null) => void;
  setIsDriverOnline: (isOnline: boolean) => void;
  
  logout: () => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
  // Estado inicial
  user: undefined,           // ainda carregando usuário do Firebase
  driverLocation: null,      // localização inicial do motorista
  isDriverOnline: false,

  isLoading: true,           // exibe loading global no App.tsx até o Firebase responder

  // Ações
  setUser: (user) => {
    set({ user });
    // Persistir perfil no AsyncStorage para restauração rápida ao reabrir o app
    try {
      if (user === undefined) {
        // não sobrescrever quando ainda estiver carregando
        return;
      }
      if (user === null) {
        AsyncStorage.removeItem('@bahia_driver_user').catch(() => {});
      } else {
        AsyncStorage.setItem('@bahia_driver_user', JSON.stringify(user)).catch(() => {});
      }
    } catch (e) {
      // ignore erros de persistência local
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setDriverLocation: (location) => set({ driverLocation: location }),

  setIsDriverOnline: (isOnline) => set({ isDriverOnline: isOnline }),

  logout: () => {
    set({
      user: null,
      driverLocation: null,
      isDriverOnline: false,
      isLoading: false,
    });
    AsyncStorage.removeItem('@bahia_driver_user').catch(() => {});
  },
}));
