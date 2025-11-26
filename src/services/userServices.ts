import { firestore, storage } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { logger } from './loggerService';

// 1. ✅ CORREÇÃO: Importar UserProfile do arquivo de tipos, não do store!
import { UserProfile } from '../types/UserTypes';

// Tipagem básica para os dados do veículo
export interface VehicleData {
    modelo: string;
    placa: string;
    cor: string;
    ano: number;
    fotoUrl?: string; // Adicionado para armazenar a URL da foto
}

/**
 * 👤 FUNÇÃO ADICIONADA: Atualiza o tipo de perfil do usuário (Passageiro ou Motorista)
 * e salva os dados básicos restantes.
 * @param uid ID do usuário
 * @param perfil O novo tipo de perfil ('passageiro' | 'motorista')
 * @param nome Nome completo
 * @param telefone Telefone
 */
export async function updateUserProfileType(
    uid: string,
    // 2. ✅ CORREÇÃO: Mudar 'tipo' para 'perfil' (para bater com UserProfile)
    perfil: 'passageiro' | 'motorista',
    nome: string,
    telefone: string
): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Atualizando tipo de perfil', { uid, perfil, nome });

        const userRef = doc(firestore, 'users', uid);
        
        const updateData: any = {
            // 2. ✅ CORREÇÃO: Mudar campo 'tipo' para 'perfil' no Firestore
            perfil: perfil,
            nome: nome,
            telefone: telefone,
            updatedAt: new Date(),
        };

        // Se for motorista, inicializa o status
        if (perfil === 'motorista') {
            updateData.isRegistered = false; // Indica que ainda falta o cadastro do veículo
            updateData.statusMotorista = 'indisponivel';
            logger.debug('USER_SERVICE', 'Inicializando perfil de motorista');
        }
        
        await updateDoc(userRef, updateData);
        logger.success('USER_SERVICE', 'Perfil atualizado com sucesso', { perfil });

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao atualizar perfil', error);
        throw error;
    }
}

/**
 * Atualiza o status de disponibilidade do motorista no Firestore.
 * @param uid ID do usuário
 * @param status Novo status ('disponivel' | 'indisponivel')
 */
export async function updateDriverAvailability(uid: string, status: 'disponivel' | 'indisponivel'): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Atualizando disponibilidade do motorista', { uid, status });

        const userRef = doc(firestore, 'users', uid);
        await updateDoc(userRef, {
            statusMotorista: status,
            lastStatusUpdate: new Date(),
        });

        logger.success('USER_SERVICE', `Motorista marcado como ${status}`);

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao atualizar disponibilidade', error);
        throw error;
    }
}

/**
 * Obtém o perfil completo do usuário pelo UID.
 * @param uid ID do usuário
 * @returns UserProfile ou null
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        logger.debug('USER_SERVICE', 'Buscando perfil do usuário', { uid });

        const userDocRef = doc(firestore, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
            logger.success('USER_SERVICE', 'Perfil carregado', { 
                uid, 
                perfil: userData.perfil,
                nome: userData.nome 
            });
            return userData;
        }

        logger.warn('USER_SERVICE', 'Perfil do usuário não encontrado', { uid });
        return null;

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao buscar perfil', error);
        return null;
    }
}


/**
 * 🚗 Salva os dados do veículo e finaliza o cadastro do motorista.
 * @param uid ID do motorista
 * @param vehicleData Dados do veículo
 */
export async function saveDriverVehicleData(uid: string, vehicleData: VehicleData): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Salvando dados do veículo', { 
            uid, 
            modelo: vehicleData.modelo,
            placa: vehicleData.placa 
        });

        const userRef = doc(firestore, 'users', uid);
        
        await updateDoc(userRef, {
            veiculo: vehicleData,
            statusMotorista: 'indisponivel',
            isRegistered: true,
            updatedAt: new Date(),
        });

        logger.success('USER_SERVICE', 'Dados do veículo salvos', { placa: vehicleData.placa });

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao salvar dados do veículo', error);
        throw error;
    }
}


/**
 * 📸 Faz o upload da foto do veículo para o Firebase Storage.
 * @param uid ID do motorista
 * @param localUri URI local da imagem (ex: 'file:///data/user/0/...')
 * @param placa Placa do veículo (para nomear o arquivo)
 * @returns URL pública da imagem no Storage.
 */
export async function uploadVehiclePhoto(uid: string, localUri: string, placa: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload de foto do veículo', { uid, placa });

        // 1. Converte o URI local em um Blob
        logger.debug('USER_SERVICE', 'Convertendo foto para blob');
        const response = await fetch(localUri);
        const blob = await response.blob();
        logger.debug('USER_SERVICE', 'Blob criado', { size: blob.size });

        // 2. Define o caminho no Storage (ex: vehicles/motoristaId/ABC1234.jpg)
        const storageRef = ref(storage, `vehicles/${uid}/${placa.toUpperCase()}.jpg`);
        logger.debug('USER_SERVICE', 'Caminho do storage definido');
        
        // 3. Faz o upload do Blob
        logger.info('USER_SERVICE', 'Fazendo upload...');
        const snapshot = await uploadBytes(storageRef, blob);
        logger.success('USER_SERVICE', 'Upload concluído');
        
        // 4. Obtém e retorna a URL pública
        logger.debug('USER_SERVICE', 'Obtendo URL pública');
        const downloadURL = await getDownloadURL(snapshot.ref);
        logger.success('USER_SERVICE', 'Foto do veículo disponível', { url: downloadURL.substring(0, 50) + '...' });
        
        return downloadURL;

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao fazer upload da foto', error);
        throw error;
    }
}
