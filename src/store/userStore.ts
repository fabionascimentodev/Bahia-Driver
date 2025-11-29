import { create } from "zustand";
import { UserProfile } from "../types/UserTypes";
import { Coords } from "../services/locationServices";

/**
 * Interface que define a estrutura do estado global do usuário.
 */
export interface UserStoreState {
  user: UserProfile | null | undefined; // undefined = checando autenticação inicial
  driverLocation: Coords | null;        // ← CORRIGIDO: Estava dentro do comentário
  isDriverOnline: boolean;

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
  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ isLoading: loading }),

  setDriverLocation: (location) => set({ driverLocation: location }),

  setIsDriverOnline: (isOnline) => set({ isDriverOnline: isOnline }),

  logout: () =>
    set({
      user: null,
      driverLocation: null,
      isDriverOnline: false,
      isLoading: false,
    }),
}));
