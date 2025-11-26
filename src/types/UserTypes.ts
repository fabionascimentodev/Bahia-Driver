// src/types/UserTypes.ts

export interface Coords {
    latitude: number;
    longitude: number;
}

// ✨ Interface principal do perfil do usuário
export interface UserProfile { 
    uid: string;
    email: string;
    nome: string;
    
    // Propriedade que resolveu os erros anteriores:
    perfil?: 'passageiro' | 'motorista'; 
    
    // Dados específicos do motorista (opcional)
    motoristaData?: {
        placaVeiculo: string;
        modeloVeiculo: string;
        corVeiculo: string;
        status: 'online' | 'offline'; 
    };
    
    // Outras propriedades...
}