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
    preçoEstimado: number;
    distanciaKm: number;
    status: RideStatus; // Tipo agora inclui 'buscando'
    
    // Data de criação (usamos string porque geralmente é armazenada como ISO string ou Timestamp)
    dataCriacao: string; 

    // Campos do Motorista (Opcionais/Null se a corrida for 'buscando' ou 'pendente')
    motoristaId: string | null;
    motoristaNome: string | null;
    placaVeiculo: string | null;

    // Rastreamento
    motoristaLocalizacao: Coords | null;

    // Finalização e Avaliação
    horaInicio?: string;
    horaFim?: string;
    passageiroAvaliacao?: number;
    pago?: boolean;
    canceladoPor?: string;
}