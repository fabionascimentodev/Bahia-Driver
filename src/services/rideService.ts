// rideService.ts
// Serviço atualizado e compatível com o novo tipo Ride (com distanciaKm)

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  runTransaction,
} from "firebase/firestore";
import { firestore } from "../config/firebaseConfig";
import { Ride, RideStatus } from "../types/RideTypes";
import { calcularDistanciaKm } from "../utils/calculoDistancia";
import { calculateFare } from '../utils/fareCalculator';
import { Coords } from "../services/locationServices";
import { unifiedLocationService } from './unifiedLocationService';
import { fetchUserProfile } from './userServices';

// ===============================
// Criar nova corrida
// ===============================
export async function criarCorrida(
  passageiroId: string,
  passageiroNome: string,
  origem: Coords,
  destino: Coords,
  precoEstimado?: number,
  distanciaKmParam?: number
) {
  const distanciaKm = typeof distanciaKmParam === 'number' ? distanciaKmParam : calcularDistanciaKm(origem, destino);

  // Criamos inicialmente a corrida com campos mínimos para que a operação seja rápida.
  // Cálculo de rota/ETA e enrich de dados serão realizados em background e atualizados depois.
  const novaCorrida: Partial<Ride> = {
    rideId: "", // será definido pelo Firestore
    passageiroId,
    passageiroNome,
    origem: {
      latitude: origem.latitude,
      longitude: origem.longitude,
      nome: origem.nome || "Origem",
    },
    destino: {
      latitude: destino.latitude,
      longitude: destino.longitude,
      nome: destino.nome || "Destino",
    },
    precoEstimado: typeof precoEstimado === 'number' ? precoEstimado : calculateFare({ km: distanciaKm, minutes: 0 }).total,
    preçoEstimado: typeof precoEstimado === 'number' ? precoEstimado : calculateFare({ km: distanciaKm, minutes: 0 }).total,
    distanciaKm: distanciaKm,
    status: "buscando",
    dataCriacao: new Date().toISOString(),
    motoristaId: null,
    motoristaNome: null,
    placaVeiculo: null,
    motoristaLocalizacao: null,
    etaSeconds: null,
    etaMinutes: null,
    distanceMeters: null,
    passageiroAvatar: null,
  };

  // Grava rápido o documento mínimo
  const ref = await addDoc(collection(firestore, "rides"), {
    ...novaCorrida,
    createdAt: serverTimestamp(),
    timestamp: serverTimestamp(),
  });

  await updateDoc(ref, { rideId: ref.id });

  // Em background: calcular rota/ETA e buscar avatar do passageiro, atualizando o documento
  (async () => {
    try {
      // 1) Calcular rota (pode falhar, não afeta o retorno rápido)
      try {
        const route = await unifiedLocationService.calculateRoute(origem, destino);
        if (route) {
          const etaSeconds = Math.round(route.duration);
          const distanceMeters = Math.round(route.distance);
          await updateDoc(ref, {
            etaSeconds,
            etaMinutes: etaSeconds ? Math.ceil(etaSeconds / 60) : null,
            distanceMeters,
            updatedAt: new Date(),
          });

          try {
            const distanceKmRoute = distanceMeters / 1000;
            const minutesRoute = etaSeconds ? Math.ceil(etaSeconds / 60) : 0;
            const fare = calculateFare({ km: distanceKmRoute, minutes: minutesRoute, highDemand: false });
            await updateDoc(ref, {
              precoEstimado: fare.total,
              preçoEstimado: fare.total,
              fareBreakdown: fare,
              updatedAt: new Date(),
            });
          } catch (fareErr) {
            console.warn('Falha ao atualizar precoEstimado após calcular rota:', fareErr);
          }
        }
      } catch (routeErr) {
        console.warn('Falha ao calcular rota em background:', routeErr);
      }

      // 2) Buscar avatar do passageiro e atualizar
      try {
        const profile = await fetchUserProfile(passageiroId);
        if (profile && (profile as any).avatarUrl) {
          await updateDoc(ref, { passageiroAvatar: (profile as any).avatarUrl, updatedAt: new Date() });
        }
      } catch (profileErr) {
        console.warn('Falha ao buscar avatar do passageiro em background:', profileErr);
      }
    } catch (bgErr) {
      console.error('Erro em tarefas de background após criar corrida:', bgErr);
    }
  })();

  return ref.id;
}

// Compatibilidade com nomes usados em algumas telas (inglês)
export const createRideRequest = criarCorrida;

// ===============================
// Buscar corrida específica
// ===============================
export async function obterCorrida(rideId: string) {
  const ref = doc(firestore, "rides", rideId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data() as Ride;
}

// ===============================
// Listar corridas de um passageiro
// ===============================
export async function listarCorridasDoPassageiro(passageiroId: string) {
  const q = query(
    collection(firestore, "rides"),
    where("passageiroId", "==", passageiroId)
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => d.data() as Ride);
}

// ===============================
// Motorista aceita corrida
// ===============================
export async function motoristaAceitarCorrida(
  rideId: string,
  motoristaId: string,
  motoristaNome: string,
  placaVeiculo: string
) {
  const ref = doc(firestore, "rides", rideId);

  // Tenta obter dados do perfil do motorista para incluir avatar e dados do veículo
  let motoristaAvatar: string | null = null;
  let motoristaVeiculo: any = null;
  try {
    const profile = await fetchUserProfile(motoristaId);
    if (profile) {
      motoristaAvatar = (profile as any).avatarUrl || null;
      motoristaVeiculo = (profile as any).motoristaData?.veiculo || null;
    }
  } catch (e) {
    // ignore
  }

  // Usar transação para garantir que apenas um motorista consiga aceitar
  try {
    await runTransaction(firestore, async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) {
        throw new Error('Corrida não encontrada');
      }

      const data = snap.data() as any;
      // Se já houver um motorista ou status diferente de pendente/buscando, rejeita
      if (data.motoristaId) {
        throw new Error('Corrida já foi aceita por outro motorista');
      }
      if (data.status && data.status !== 'pendente' && data.status !== 'buscando') {
        throw new Error('Corrida não está mais disponível');
      }

      transaction.update(ref, {
        status: 'aceita' as RideStatus,
        motoristaId,
        motoristaNome,
        placaVeiculo,
        acceptedAt: serverTimestamp(),
        motoristaAvatar: motoristaAvatar,
        motoristaVeiculo: motoristaVeiculo,
      });
    });
    return { success: true };
  } catch (e) {
    // Repassa o erro para o chamador para que possa exibir alert
    return { success: false, error: (e instanceof Error) ? e.message : String(e) };
  }
}

// ===============================
// Atualizar localização do motorista
// ===============================
export async function atualizarLocalizacaoMotorista(
  rideId: string,
  localizacao: Coords
) {
  const ref = doc(firestore, "rides", rideId);

  await updateDoc(ref, {
    motoristaLocalizacao: localizacao,
  });
}

// ===============================
// Finalizar corrida
// ===============================
export async function finalizarCorrida(rideId: string) {
  const ref = doc(firestore, "rides", rideId);

  await updateDoc(ref, {
    status: "finalizada" as RideStatus,
    horaFim: new Date().toISOString(),
    pago: true,
  });
}

// ===============================
// Cancelar corrida
// ===============================
export async function cancelarCorrida(rideId: string, canceladoPor: string) {
  const ref = doc(firestore, "rides", rideId);

  await updateDoc(ref, {
    status: "cancelada" as RideStatus,
    canceladoPor,
  });
}
