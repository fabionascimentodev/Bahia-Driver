// src/types/UserTypes.ts

export interface Coords {
    latitude: number;
    longitude: number;
    nome?: string;
    timestamp?: number; 
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
        // Campos mantidos por compatibilidade com telas antigas
        modeloVeiculo?: string;
        placaVeiculo?: string;

        status?: 'disponivel' | 'indisponivel' | 'em_corrida';
        isRegistered?: boolean;
    };
    
    // Persistência do modo atual (útil para redirecionamento ao abrir o app)
    modoAtual?: 'passageiro' | 'motorista';

    createdAt?: Date;
    updatedAt?: Date;
}