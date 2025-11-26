import { firestore, storage } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// 1. ✅ CORREÇÃO: Importar UserProfile do arquivo de tipos, não do store!
import { UserProfile } from '../types/UserTypes'; 
// (Assumindo que '../types/UserTypes' é o caminho correto)

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
    }
    
    await updateDoc(userRef, updateData);
}

/**
 * Atualiza o status de disponibilidade do motorista no Firestore.
 * @param uid ID do usuário
 * @param status Novo status ('disponivel' | 'indisponivel')
 */
export async function updateDriverAvailability(uid: string, status: 'disponivel' | 'indisponivel'): Promise<void> {
    const userRef = doc(firestore, 'users', uid);
    await updateDoc(userRef, {
        statusMotorista: status,
        lastStatusUpdate: new Date(),
    });
}

/**
 * Obtém o perfil completo do usuário pelo UID.
 * @param uid ID do usuário
 * @returns UserProfile ou null
 */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const userDocRef = doc(firestore, 'users', uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
        }
        return null;
    } catch (error) {
        console.error("Erro ao buscar perfil do usuário:", error);
        return null;
    }
}


/**
 * 🚗 Salva os dados do veículo e finaliza o cadastro do motorista.
 * @param uid ID do motorista
 * @param vehicleData Dados do veículo
 */
export async function saveDriverVehicleData(uid: string, vehicleData: VehicleData): Promise<void> {
    const userRef = doc(firestore, 'users', uid);
    
    await updateDoc(userRef, {
        veiculo: vehicleData,
        statusMotorista: 'indisponivel',
        isRegistered: true,
        updatedAt: new Date(),
    });
}


/**
 * 📸 Faz o upload da foto do veículo para o Firebase Storage.
 * @param uid ID do motorista
 * @param localUri URI local da imagem (ex: 'file:///data/user/0/...')
 * @param placa Placa do veículo (para nomear o arquivo)
 * @returns URL pública da imagem no Storage.
 */
export async function uploadVehiclePhoto(uid: string, localUri: string, placa: string): Promise<string> {
    
    // 1. Converte o URI local em um Blob
    const response = await fetch(localUri);
    const blob = await response.blob();

    // 2. Define o caminho no Storage (ex: vehicles/motoristaId/ABC1234.jpg)
    const storageRef = ref(storage, `vehicles/${uid}/${placa.toUpperCase()}.jpg`);
    
    // 3. Faz o upload do Blob
    const snapshot = await uploadBytes(storageRef, blob);
    
    // 4. Obtém e retorna a URL pública
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return downloadURL;
}