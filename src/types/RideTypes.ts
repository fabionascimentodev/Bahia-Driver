// src/types/RideTypes.ts (Corrigido)

// Importe Coords de onde ele está definido, geralmente um arquivo de tipos ou locationServices
import { Coords } from '../services/locationServices'; 

export interface RideCoords {
 latitude: number;
 longitude: number;
 nome: string; // Nome do local/endereço
}

/**
 * ✅ CORREÇÃO: Adicionando 'buscando' ao tipo RideStatus.
 */
export type RideStatus = 
    | 'buscando'       // 👈 Status durante a procura do motorista
    | 'pendente'       // Oferta de corrida enviada a motoristas
    | 'aceita'         // Motorista aceitou e está a caminho
    | 'chegou'         // Motorista chegou ao ponto de origem
    | 'em andamento'   // Viagem começou (substitui 'iniciada' para clareza)
    | 'finalizada'     
    | 'cancelada';

export interface Ride {
rideId: string;
 passageiroId: string;
 passageiroNome: string;
 origem: RideCoords;
 destino: RideCoords;
    // Mantemos ambos os nomes para compatibilidade entre telas
    precoEstimado?: number;
    preçoEstimado?: number;
 distanciaKm: number;
 status: RideStatus; // Tipo agora inclui 'buscando'
 
 // Data de criação (usamos string porque geralmente é armazenada como ISO string ou Timestamp)
 dataCriacao?: string;
 createdAt?: any;

 // Campos do Motorista (Opcionais/Null se a corrida for 'buscando' ou 'pendente')
 motoristaId: string | null;
 motoristaNome: string | null;
 placaVeiculo: string | null;

// Rastreamento
 motoristaLocalizacao: Coords | null;

 // ETA / Rota
    etaSeconds?: number | null;
    etaMinutes?: number | null;
    distanceMeters?: number | null;

 // Avatares e dados rápidos para exibição
    passageiroAvatar?: string | null;
    motoristaAvatar?: string | null;
    motoristaVeiculo?: {
        modelo?: string | null;
        placa?: string | null;
        cor?: string | null;
        ano?: number | null;
        fotoUrl?: string | null;
    } | null;
    // ETA específico do motorista (recalculado durante o rastreamento)
    driverEtaSeconds?: number | null;
    driverEtaMinutes?: number | null;

// Finalização e Avaliação
 horaInicio?: string;
 horaFim?: string;
 passageiroAvaliacao?: number;
 pago?: boolean;
 canceladoPor?: string;
}