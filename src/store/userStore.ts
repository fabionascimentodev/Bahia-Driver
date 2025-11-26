import { create } from 'zustand';
import { UserProfile } from '../types/UserTypes'; 
import { Coords } from '../services/locationServices'; 

/**
 * Interface que define a estrutura do estado global do usuário.
 */
export interface UserStoreState {
    user: UserProfile | null | undefined; // 'undefined' para indicar estado inicial de checagem
    driverLocation: Coords | null;
    isDriverOnline: boolean; 

    // ✅ PROPRIEDADES ADICIONADAS PARA O GERENCIAMENTO DE CARREGAMENTO
    isLoading: boolean; 

    // Ações (Mutators)
    setUser: (user: UserProfile | null | undefined) => void;
    setLoading: (loading: boolean) => void; // ✅ Método adicionado
    setDriverLocation: (location: Coords | null) => void;
    setIsDriverOnline: (isOnline: boolean) => void;
    logout: () => void;
}

export const useUserStore = create<UserStoreState>((set) => ({
    // Estado Inicial
    user: undefined, // Inicializa como 'undefined' para indicar que a checagem do Firebase não ocorreu
    driverLocation: null,
    isDriverOnline: false,
    
    // ✅ PROPRIEDADE INICIALIZADA
    isLoading: true, // Começa como 'true' para mostrar a tela de carregamento do App.tsx

    // Funções de Ação
    setUser: (user) => set({ user }),

    // ✅ IMPLEMENTAÇÃO DO MÉTODO
    setLoading: (loading) => set({ isLoading: loading }),

    setDriverLocation: (location) => set({ driverLocation: location }),

    setIsDriverOnline: (isOnline) => set({ isDriverOnline: isOnline }),
    
    logout: () => set({ 
        user: null, 
        driverLocation: null, 
        isDriverOnline: false,
        isLoading: false // Garante que o estado seja 'false' após o logout
    }),
}));