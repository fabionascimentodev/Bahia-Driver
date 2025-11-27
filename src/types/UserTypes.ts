// src/types/UserTypes.ts

export interface Coords {
    latitude: number;
    longitude: number;
}

export interface UserProfile { 
    uid: string;
    email: string;
    nome: string;
    telefone: string;
    perfil?: 'passageiro' | 'motorista'; 
    
    // ✅ ESTRUTURA CORRIGIDA - motoristaData agora é obrigatório para motoristas
    motoristaData?: {
        veiculo?: {
            modelo: string;
            placa: string;
            cor: string;
            ano: number;
            fotoUrl?: string;
        };
        status?: 'disponivel' | 'indisponivel' | 'em_corrida';
        isRegistered?: boolean;
    };
    
    createdAt?: Date;
    updatedAt?: Date;
}