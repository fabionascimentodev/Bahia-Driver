import { firestore } from '../config/firebaseConfig';
import { collection, doc, addDoc, updateDoc, query, where, getDocs, limit, Timestamp, getDoc } from 'firebase/firestore';
import { Ride, RideCoords, RideStatus } from '../types/RideTypes';
import { sendPushNotification } from './notificationService';

// 1. Função para criar uma nova solicitação de corrida
// ⚠️ ESTA DEFINIÇÃO REQUER 6 ARGUMENTOS!
export async function createRideRequest(
  passageiroId: string, 
  passageiroNome: string, // Argumento 2
  origem: RideCoords,     // Argumento 3
  destino: RideCoords,    // Argumento 4
  preçoEstimado: number,  // Argumento 5
  distanciaKm: number     // Argumento 6
): Promise<string> {
  
  // Omissão de 'rideId' é correta para o Firestore
  const newRide: Omit<Ride, 'rideId'> = {
    passageiroId,
    passageiroNome,
    motoristaId: null,
    motoristaNome: null,
    placaVeiculo: null,
    status: 'buscando',
    origem,
    destino,
    preçoEstimado,
    distanciaKm,
    motoristaLocalizacao: null,
    dataCriacao: Timestamp.now().toDate().toISOString(),
    horaInicio: undefined,
    horaFim: undefined,
    pago: false,
    canceladoPor: undefined,
    passageiroAvaliacao: undefined,
  };

  const ridesCollection = collection(firestore, 'rides');
  const docRef = await addDoc(ridesCollection, newRide as any); 
  
  // Notificar motoristas disponíveis (assíncrono)
  notifyAvailableDrivers(docRef.id, origem, destino).catch(console.error);
  
  return docRef.id;
}

// 2. Função para aceitar a corrida (chamada pelo Motorista)
export async function acceptRide(rideId: string, motoristaId: string, motoristaNome: string, placaVeiculo: string) {
  const rideRef = doc(firestore, 'rides', rideId);
  
  await updateDoc(rideRef, {
    motoristaId: motoristaId,
    motoristaNome: motoristaNome,
    placaVeiculo: placaVeiculo,
    status: 'aceita',
    // Assumindo que você quer salvar o horário de aceite
    dataAceite: Timestamp.now(), 
  });
  
  // Notificar o Passageiro sobre o aceite
  notifyPassenger(rideId, 'Corrida Aceita! 🚗', 'Seu motorista está a caminho!', {
      driverId: motoristaId,
      status: 'aceita'
  }).catch(console.error);
}

// 3. Função auxiliar para notificar motoristas (SIMULAÇÃO)
async function notifyAvailableDrivers(rideId: string, origem: RideCoords, destino: RideCoords) {
  const driversQuery = query(
    collection(firestore, 'users'), 
    // ✅ CORREÇÃO: Usando 'perfil' em vez de 'tipo'
    where('perfil', '==', 'motorista'),
    where('statusMotorista', '==', 'disponivel'),
    limit(5)
  );

  const driverSnapshot = await getDocs(driversQuery);
  
  if (driverSnapshot.empty) {
    console.log('Nenhum motorista disponível encontrado.');
    return;
  }

  driverSnapshot.forEach(async (d) => {
    const driverData = d.data();
    if (driverData.pushToken) {
      await sendPushNotification(
        driverData.pushToken,
        'Nova Solicitação de Corrida!',
        `Busque passageiro em ${origem.nome || origem.latitude.toFixed(4)} com destino a ${destino.nome || destino.latitude.toFixed(4)}.`,
        { type: 'new_ride', rideId: rideId }
      );
    }
  });
}

// 4. Função auxiliar para notificar um passageiro
async function notifyPassenger(rideId: string, title: string, body: string, data = {}) {
    const rideDocRef = doc(firestore, 'rides', rideId);
    const rideSnap = await getDoc(rideDocRef);

    if (!rideSnap.exists() || !rideSnap.data()) {
        console.error(`Corrida ${rideId} não encontrada para notificar passageiro.`);
        return;
    }
    const passageiroId = rideSnap.data().passageiroId;

    // ✅ CORREÇÃO: Usando getDoc em vez de query+getDocs, se o ID do passageiro já estiver disponível.
    // Assumindo que o ID do documento do usuário é o mesmo que o passageiroId
    const userDocRef = doc(firestore, 'users', passageiroId); 
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
        console.error(`Passageiro ${passageiroId} não encontrado.`);
        return;
    }
    const passageiroToken = userSnap.data().pushToken;

    if (passageiroToken) {
        await sendPushNotification(passageiroToken, title, body, { type: 'ride_update', rideId: rideId, ...data });
    }
}

// 5. Funções de atualização de status (Motorista)
export async function updateRideStatus(rideId: string, status: RideStatus) { // Removido userId não usado
    // ✅ CORREÇÃO: Padronizando a referência ao Firestore para 'firestore'
    const rideRef = doc(firestore, 'rides', rideId);
    const updateData: any = { status: status };
    
    if (status === 'aceita' && !updateData['dataAceite']) {
        // Notifica o passageiro que o motorista está a caminho (ou já aceitou)
        notifyPassenger(rideId, 'Motorista a Caminho!', 'Acompanhe a chegada no mapa.').catch(console.error);
    } else if (status === 'chegou') {
        notifyPassenger(rideId, 'Motorista Chegou!', 'Seu motorista está esperando no local de origem.').catch(console.error);
    } else if (status === 'em andamento') { // ✅ CORREÇÃO: Status consistente com RideTypes.ts
        updateData.horaInicio = Timestamp.now().toDate().toISOString();
        notifyPassenger(rideId, 'Corrida Iniciada!', 'Sua viagem começou.').catch(console.error);
    } else if (status === 'finalizada') {
        updateData.horaFim = Timestamp.now().toDate().toISOString();
        // Notificação: Corrida finalizada (leva para a tela de avaliação)
        notifyPassenger(rideId, 'Corrida Finalizada!', 'Por favor, avalie e prossiga para o pagamento.').catch(console.error);
    } else if (status === 'cancelada') {
        notifyPassenger(rideId, 'Corrida Cancelada', 'A corrida foi cancelada.').catch(console.error);
    }

    await updateDoc(rideRef, updateData);
}

/**
 * ⭐️ Registra a avaliação e a confirmação de pagamento do passageiro.
 * @param rideId ID da corrida
 * @param nota Nota dada ao motorista (1 a 5)
 * @param comentario Comentário opcional
 */
export async function finalizeRide(rideId: string, nota: number, comentario: string) {
    const rideRef = doc(firestore, 'rides', rideId);
    
    // 1. Atualiza o documento da corrida
    await updateDoc(rideRef, {
        avaliacaoPassageiro: {
            nota: nota,
            comentario: comentario,
            avaliadoEm: Timestamp.now(),
        },
        passageiroAvaliou: true,
        status: 'finalizada' // ✅ CORREÇÃO: Usando 'finalizada' para consistência, o pagamento é implícito ou em uma etapa separada.
    });

    // 2. Lógica Simples de Pagamento/Comissão (SIMULAÇÃO)
    const rideDoc = await getDoc(rideRef);
    if (rideDoc.exists()) {
        const rideData = rideDoc.data();
        const motoristaId = rideData.motoristaId;
        const precoTotal = rideData.preçoEstimado; 
        const comissaoApp = precoTotal * 0.20; // 20% de comissão
        const valorMotorista = precoTotal - comissaoApp;

        // ✅ CORREÇÃO: Padronizando a referência ao Firestore para 'firestore' e usando o ID do motorista
        const driverRef = doc(firestore, 'users', motoristaId);
        const driverSnap = await getDoc(driverRef);

        if (driverSnap.exists()) {
            const driverData = driverSnap.data();
            await updateDoc(driverRef, {
                saldoSimulado: (driverData.saldoSimulado || 0) + valorMotorista, 
                totalCorridas: (driverData.totalCorridas || 0) + 1,
            });
        }

        console.log(`Corrida ${rideId} paga. Motorista recebeu R$ ${valorMotorista.toFixed(2)}.`);
    }
}