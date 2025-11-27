import { firestore } from '../config/firebaseConfig';
import { 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    query, 
    where, 
    getDocs, 
    limit, 
    Timestamp, 
    getDoc,
    orderBy,
    onSnapshot 
} from 'firebase/firestore';
import { Ride, RideCoords, RideStatus } from '../types/RideTypes';
import { sendPushNotification } from './notificationService';
import { logger } from './loggerService';

// 1. Função para criar uma nova solicitação de corrida
export async function createRideRequest(
  passageiroId: string, 
  passageiroNome: string,
  origem: RideCoords,
  destino: RideCoords,
  preçoEstimado: number,
  distanciaKm: number
): Promise<string> {
  
  try {
    logger.info('RIDE_SERVICE', 'Criando nova solicitação de corrida', {
      passageiroId,
      passageiroNome,
      origem: origem.nome,
      destino: destino.nome,
      preçoEstimado,
      distanciaKm
    });

    // ✅ Estrutura corrigida para corresponder ao Firestore
    const newRide = {
      // Informações do passageiro
      passageiro: {
        uid: passageiroId,
        nome: passageiroNome
      },
      
      // Localizações
      origem: {
        nome: origem.nome || 'Localização atual',
        latitude: origem.latitude,
        longitude: origem.longitude
      },
      destino: {
        nome: destino.nome || 'Destino',
        latitude: destino.latitude,
        longitude: destino.longitude
      },
      
      // Detalhes da corrida
      preco: preçoEstimado,
      distancia: distanciaKm,
      
      // Status e timestamps
      status: 'buscando_motorista' as RideStatus,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      
      // Campos com valores padrão
      motorista: null,
      horaInicio: null,
      horaAceite: null,
      horaFinalizacao: null,
      placaVeiculo: null,
      
      // Campos de pagamento e avaliação
      pago: false,
      avaliacao: null,
      comentario: null
    };

    logger.debug('RIDE_SERVICE', 'Dados da corrida preparados', newRide);

    const ridesCollection = collection(firestore, 'rides');
    const docRef = await addDoc(ridesCollection, newRide);
    
    logger.success('RIDE_SERVICE', 'Corrida criada com sucesso', { 
      rideId: docRef.id,
      status: 'buscando_motorista'
    });
    
    // Notificar motoristas disponíveis (assíncrono)
    notifyAvailableDrivers(docRef.id, origem, destino).catch(error => {
      logger.error('RIDE_SERVICE', 'Erro ao notificar motoristas', error);
    });
    
    return docRef.id;

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao criar solicitação de corrida', error);
    throw error;
  }
}

// 2. Função para aceitar a corrida (chamada pelo Motorista)
export async function acceptRide(rideId: string, motoristaId: string, motoristaNome: string, placaVeiculo: string) {
  try {
    logger.info('RIDE_SERVICE', 'Motorista aceitando corrida', { 
      rideId, 
      motoristaId, 
      motoristaNome 
    });

    const rideRef = doc(firestore, 'rides', rideId);
    
    await updateDoc(rideRef, {
      'motorista.uid': motoristaId,
      'motorista.nome': motoristaNome,
      placaVeiculo: placaVeiculo,
      status: 'aceita',
      horaAceite: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    
    logger.success('RIDE_SERVICE', 'Corrida aceita com sucesso', { rideId });
    
    // Notificar o Passageiro sobre o aceite
    await notifyPassenger(rideId, 'Corrida Aceita! 🚗', 'Seu motorista está a caminho!', {
      driverId: motoristaId,
      status: 'aceita'
    });

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao aceitar corrida', error);
    throw error;
  }
}

// 3. Função auxiliar para notificar motoristas (COMPLETAMENTE CORRIGIDA)
async function notifyAvailableDrivers(rideId: string, origem: RideCoords, destino: RideCoords) {
  try {
    logger.debug('RIDE_SERVICE', 'Notificando motoristas disponíveis', { rideId });

    // ✅ CORREÇÃO CRÍTICA: Validação antecipada e robusta das coordenadas
    const safeOrigem = {
      nome: origem?.nome || 'Localização atual',
      latitude: origem?.latitude ?? -12.974722,
      longitude: origem?.longitude ?? -38.476665
    };

    const safeDestino = {
      nome: destino?.nome || 'Destino',
      latitude: destino?.latitude ?? -12.974722,  
      longitude: destino?.longitude ?? -38.476665
    };

    logger.debug('RIDE_SERVICE', 'Coordenadas validadas para notificação', {
      origem: safeOrigem,
      destino: safeDestino
    });

    // ✅ CORREÇÃO: Busca por motoristas com estrutura correta baseada no seu Firestore
    // Primeiro, vamos buscar TODOS os motoristas para debug
    const allDriversQuery = query(
      collection(firestore, 'users'), 
      where('perfil', '==', 'motorista')
    );

    logger.debug('RIDE_SERVICE', 'Buscando TODOS os motoristas para análise...');

    const allDriversSnapshot = await getDocs(allDriversQuery);
    
    logger.debug('RIDE_SERVICE', 'Análise de todos os motoristas encontrados', {
      totalMotoristas: allDriversSnapshot.size,
      motoristas: allDriversSnapshot.docs.map(doc => ({
        id: doc.id,
        data: {
          perfil: doc.data().perfil,
          nome: doc.data().nome,
          motoristaData: doc.data().motoristaData,
          pushToken: doc.data().pushToken ? 'SIM' : 'NÃO'
        }
      }))
    });

    // Agora vamos tentar diferentes queries para encontrar motoristas disponíveis
    let driversQuery;
    let queryType = '';
    
    // Tentativa 1: Buscar por motoristaData.disponivel = true
    driversQuery = query(
      collection(firestore, 'users'), 
      where('perfil', '==', 'motorista'),
      where('motoristaData.disponivel', '==', true),
      limit(10)
    );
    queryType = 'motoristaData.disponivel = true';

    let driverSnapshot = await getDocs(driversQuery);
    
    // Se não encontrar, tentar outra estrutura
    if (driverSnapshot.empty) {
      logger.debug('RIDE_SERVICE', 'Nenhum motorista com motoristaData.disponivel = true, tentando buscar todos os motoristas...');
      
      // Tentativa 2: Buscar apenas por perfil = motorista (sem filtro de disponibilidade)
      driversQuery = query(
        collection(firestore, 'users'), 
        where('perfil', '==', 'motorista'),
        limit(10)
      );
      queryType = 'apenas perfil = motorista';
      
      driverSnapshot = await getDocs(driversQuery);
    }
    
    logger.debug('RIDE_SERVICE', `Resultado da busca por motoristas (${queryType})`, {
      totalEncontrado: driverSnapshot.size,
      motoristas: driverSnapshot.docs.map(doc => ({
        id: doc.id,
        nome: doc.data().nome,
        possuiToken: !!doc.data().pushToken
      }))
    });
    
    if (driverSnapshot.empty) {
      logger.warn('RIDE_SERVICE', 'Nenhum motorista encontrado no Firestore após todas as tentativas');
      return;
    }

    const origemText = safeOrigem.nome;
    const destinoText = safeDestino.nome;
    
    const notificationMessage = `Nova corrida: ${origemText} para ${destinoText}.`;

    let notificacoesEnviadas = 0;
    let errosNotificacao = 0;
    let motoristasSemToken = 0;

    const notificationPromises = driverSnapshot.docs.map(async (driverDoc) => {
      const driverData = driverDoc.data();
      const driverId = driverDoc.id;
      
      logger.debug('RIDE_SERVICE', 'Processando motorista', {
        driverId,
        nome: driverData.nome,
        possuiToken: !!driverData.pushToken
      });

      if (driverData.pushToken) {
        try {
          await sendPushNotification(
            driverData.pushToken,
            '🚗 Nova Corrida Disponível!',
            notificationMessage,
            { 
              type: 'new_ride', 
              rideId: rideId,
              origem: safeOrigem.nome,
              destino: safeDestino.nome
            }
          );
          notificacoesEnviadas++;
          logger.debug('RIDE_SERVICE', 'Notificação enviada com sucesso para motorista', {
            driverId,
            nome: driverData.nome
          });
        } catch (notificationError) {
          errosNotificacao++;
          logger.error('RIDE_SERVICE', 'Erro ao enviar notificação para motorista', {
            driverId,
            nome: driverData.nome,
            error: notificationError
          });
        }
      } else {
        motoristasSemToken++;
        logger.debug('RIDE_SERVICE', 'Motorista sem push token', {
          driverId,
          nome: driverData.nome
        });
      }
    });

    await Promise.all(notificationPromises);
    
    logger.info('RIDE_SERVICE', 'Processo de notificação concluído', { 
      totalMotoristas: driverSnapshot.size,
      notificacoesEnviadas,
      errosNotificacao,
      motoristasSemToken
    });

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao notificar motoristas', error);
  }
}

// 4. Função auxiliar para notificar um passageiro
async function notifyPassenger(rideId: string, title: string, body: string, data = {}) {
  try {
    const rideDocRef = doc(firestore, 'rides', rideId);
    const rideSnap = await getDoc(rideDocRef);

    if (!rideSnap.exists()) {
      logger.error('RIDE_SERVICE', `Corrida ${rideId} não encontrada para notificar passageiro`);
      return;
    }

    const rideData = rideSnap.data();
    const passageiroId = rideData.passageiro?.uid;

    if (!passageiroId) {
      logger.error('RIDE_SERVICE', `Passageiro ID não encontrado na corrida ${rideId}`);
      return;
    }

    const userDocRef = doc(firestore, 'users', passageiroId); 
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      logger.error('RIDE_SERVICE', `Passageiro ${passageiroId} não encontrado`);
      return;
    }

    const passageiroToken = userSnap.data().pushToken;

    if (passageiroToken) {
      await sendPushNotification(
        passageiroToken, 
        title, 
        body, 
        { type: 'ride_update', rideId: rideId, ...data }
      );
      logger.info('RIDE_SERVICE', 'Passageiro notificado com sucesso', { rideId });
    } else {
      logger.warn('RIDE_SERVICE', 'Passageiro sem push token', { passageiroId });
    }

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao notificar passageiro', error);
  }
}

// 5. Funções de atualização de status (Motorista)
export async function updateRideStatus(rideId: string, status: RideStatus) {
  try {
    logger.info('RIDE_SERVICE', 'Atualizando status da corrida', { rideId, status });

    const rideRef = doc(firestore, 'rides', rideId);
    const updateData: any = { 
      status: status,
      updatedAt: Timestamp.now()
    };
    
    if (status === 'aceita') {
      // Já tratado na função acceptRide
    } else if (status === 'chegou') {
      await notifyPassenger(rideId, 'Motorista Chegou!', 'Seu motorista está esperando no local de origem.');
    } else if (status === 'em andamento') {
      updateData.horaInicio = Timestamp.now();
      await notifyPassenger(rideId, 'Corrida Iniciada!', 'Sua viagem começou.');
    } else if (status === 'finalizada') {
      updateData.horaFinalizacao = Timestamp.now();
      await notifyPassenger(rideId, 'Corrida Finalizada!', 'Por favor, avalie e prossiga para o pagamento.');
    } else if (status === 'cancelada') {
      await notifyPassenger(rideId, 'Corrida Cancelada', 'A corrida foi cancelada.');
    }

    await updateDoc(rideRef, updateData);
    logger.success('RIDE_SERVICE', 'Status da corrida atualizado', { rideId, status });

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao atualizar status da corrida', error);
    throw error;
  }
}

/**
 * ⭐️ Registra a avaliação e a confirmação de pagamento do passageiro
 */
export async function finalizeRide(rideId: string, nota: number, comentario: string) {
  try {
    logger.info('RIDE_SERVICE', 'Finalizando corrida com avaliação', { rideId, nota });

    const rideRef = doc(firestore, 'rides', rideId);
    
    // 1. Atualiza o documento da corrida
    await updateDoc(rideRef, {
      avaliacao: {
        nota: nota,
        comentario: comentario,
        avaliadoEm: Timestamp.now(),
      },
      status: 'finalizada',
      updatedAt: Timestamp.now()
    });

    // 2. Lógica Simples de Pagamento/Comissão
    const rideDoc = await getDoc(rideRef);
    if (rideDoc.exists()) {
      const rideData = rideDoc.data();
      const motoristaId = rideData.motorista?.uid;
      const precoTotal = rideData.preco; 
      
      if (motoristaId && precoTotal) {
        const comissaoApp = precoTotal * 0.20; // 20% de comissão
        const valorMotorista = precoTotal - comissaoApp;

        const driverRef = doc(firestore, 'users', motoristaId);
        const driverSnap = await getDoc(driverRef);

        if (driverSnap.exists()) {
          const driverData = driverSnap.data();
          await updateDoc(driverRef, {
            'motoristaData.saldo': (driverData.motoristaData?.saldo || 0) + valorMotorista, 
            'motoristaData.totalCorridas': (driverData.motoristaData?.totalCorridas || 0) + 1,
            updatedAt: Timestamp.now()
          });
        }

        logger.info('RIDE_SERVICE', 'Pagamento processado', { 
          rideId, 
          valorMotorista, 
          comissaoApp 
        });
      }
    }

    logger.success('RIDE_SERVICE', 'Corrida finalizada com sucesso', { rideId });

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao finalizar corrida', error);
    throw error;
  }
}

/**
 * Busca corridas disponíveis para motoristas
 */
export async function getAvailableRides(): Promise<Ride[]> {
  try {
    logger.debug('RIDE_SERVICE', 'Buscando corridas disponíveis');

    const q = query(
      collection(firestore, 'rides'),
      where('status', '==', 'buscando_motorista'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const rides: Ride[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as any;

      const ride: Ride = {
        rideId: doc.id,
        passageiroId: data.passageiro?.uid || '',
        passageiroNome: data.passageiro?.nome || '',
        origem: {
          nome: data.origem?.nome || 'Localização atual',
          latitude: data.origem?.latitude,
          longitude: data.origem?.longitude
        } as RideCoords,
        destino: {
          nome: data.destino?.nome || 'Destino',
          latitude: data.destino?.latitude,
          longitude: data.destino?.longitude
        } as RideCoords,
        preco: data.preco,
        distancia: data.distancia,
        status: data.status as RideStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        motoristaId: data.motorista?.uid || null,
        motoristaNome: data.motorista?.nome || null,
        horaInicio: data.horaInicio || null,
        horaAceite: data.horaAceite || null,
        horaFinalizacao: data.horaFinalizacao || null,
        placaVeiculo: data.placaVeiculo || null,
        pago: data.pago || false,
        avaliacao: data.avaliacao || null,
        comentario: data.comentario || null
      } as unknown as Ride;

      rides.push(ride);
    });

    logger.info('RIDE_SERVICE', 'Corridas disponíveis encontradas', { 
      count: rides.length 
    });

    return rides;

  } catch (error) {
    logger.error('RIDE_SERVICE', 'Erro ao buscar corridas disponíveis', error);
    throw error;
  }
}

/**
 * Escuta mudanças em uma corrida específica
 */
export const listenToRide = (rideId: string, callback: (ride: Ride | null) => void) => {
  logger.debug('RIDE_SERVICE', 'Escutando mudanças na corrida', { rideId });

  const rideRef = doc(firestore, 'rides', rideId);
  
  return onSnapshot(rideRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data() as any;
      const rideData: Ride = {
        rideId: docSnapshot.id,
        passageiroId: data.passageiro?.uid || '',
        passageiroNome: data.passageiro?.nome || '',
        origem: {
          nome: data.origem?.nome || 'Localização atual',
          latitude: data.origem?.latitude,
          longitude: data.origem?.longitude
        } as RideCoords,
        destino: {
          nome: data.destino?.nome || 'Destino',
          latitude: data.destino?.latitude,
          longitude: data.destino?.longitude
        } as RideCoords,
        preco: data.preco,
        distancia: data.distancia,
        status: data.status as RideStatus,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        motoristaId: data.motorista?.uid || null,
        motoristaNome: data.motorista?.nome || null,
        horaInicio: data.horaInicio || null,
        horaAceite: data.horaAceite || null,
        horaFinalizacao: data.horaFinalizacao || null,
        placaVeiculo: data.placaVeiculo || null,
        pago: data.pago || false,
        avaliacao: data.avaliacao || null,
        comentario: data.comentario || null
      } as unknown as Ride;
      logger.debug('RIDE_SERVICE', 'Corrida atualizada', { 
        rideId, 
        status: rideData.status 
      });
      callback(rideData);
    } else {
      logger.warn('RIDE_SERVICE', 'Corrida não encontrada', { rideId });
      callback(null);
    }
  }, (error) => {
    logger.error('RIDE_SERVICE', 'Erro ao escutar corrida', error);
    callback(null);
  });
};