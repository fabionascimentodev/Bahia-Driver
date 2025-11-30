import { firestore, storage } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword as firebaseCreateUser, signOut } from 'firebase/auth';
import { auth } from '../config/firebaseConfig';
import { logger } from './loggerService';
import { UserProfile } from '../types/UserTypes';

// Tipagem básica para os dados do veículo
export interface VehicleData {
    modelo: string;
    placa: string;
    cor: string;
    ano: number;
    fotoUrl?: string;
    // Opcional: URL da foto da CNH (documento do motorista)
    cnhUrl?: string;
    // Opcional: URL do arquivo de antecedentes criminais (PDF / imagem)
    antecedenteFileUrl?: string;
}

/**
 * ✅ NOVA FUNÇÃO: Cadastrar novo usuário
 */
export async function createUserWithEmailAndPassword(
    email: string, 
    password: string, 
    nome: string, 
    telefone: string,
    perfil?: 'passageiro' | 'motorista'
): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Cadastrando novo usuário', { email, nome, perfil: perfil || 'não definido' });

        // 1. Criar usuário no Authentication
        const userCredential = await firebaseCreateUser(auth, email, password);
        const user = userCredential.user;
        
        logger.success('USER_SERVICE', 'Usuário criado no Auth', { uid: user.uid });

        // 2. Criar perfil no Firestore (perfil pode ser undefined neste momento)
        const userRef = doc(firestore, 'users', user.uid);
        const userData: any = {
            uid: user.uid,
            email: email,
            nome: nome,
            telefone: telefone,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Adiciona perfil apenas se foi definido
        if (perfil) {
            userData.perfil = perfil;
        }

        await setDoc(userRef, userData);
        
        logger.success('USER_SERVICE', 'Perfil criado no Firestore', { perfil: perfil || 'pendente' });

        return user.uid;

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao cadastrar usuário', error);
        throw error;
    }
}

/**
 * ✅ CORRIGIDO: Criar/Atualizar perfil do usuário
 */
export async function updateUserProfileType(
    uid: string,
    perfil: 'passageiro' | 'motorista',
    nome: string,
    telefone: string
): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Criando/atualizando perfil do usuário', { uid, perfil, nome });

        const userRef = doc(firestore, 'users', uid);
        
        const userData: any = {
            uid: uid,
            nome: nome,
            telefone: telefone,
            perfil: perfil,
            updatedAt: new Date(),
        };

        // ✅ ADICIONAR createdAt apenas na primeira vez
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            userData.createdAt = new Date();
        }

        // ✅ USAR setDoc com merge para criar/atualizar
        await setDoc(userRef, userData, { merge: true });
        
        // ✅ Configurações específicas para motorista
        if (perfil === 'motorista') {
            await updateDoc(userRef, {
                'motoristaData.isRegistered': false,
                'motoristaData.status': 'indisponivel',
            });
            logger.debug('USER_SERVICE', 'Perfil de motorista inicializado');
        }
        
        logger.success('USER_SERVICE', 'Perfil do usuário salvo com sucesso', { perfil });

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao salvar perfil do usuário', error);
        throw error;
    }
}

/**
 * Atualiza o status de disponibilidade do motorista no Firestore.
 */
export async function updateDriverAvailability(uid: string, status: 'disponivel' | 'indisponivel'): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Atualizando disponibilidade do motorista', { uid, status });

        const userRef = doc(firestore, 'users', uid);
        await updateDoc(userRef, {
            'motoristaData.status': status,
            updatedAt: new Date(),
        });

        logger.success('USER_SERVICE', `Motorista marcado como ${status}`);

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao atualizar disponibilidade', error);
        throw error;
    }
}

/**
 * Obtém o perfil completo do usuário pelo UID.
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
 * ✅ CORRIGIDO: Salvar dados do veículo
 */
export async function saveDriverVehicleData(uid: string, vehicleData: VehicleData): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Salvando dados do veículo', { 
            uid, 
            modelo: vehicleData.modelo,
            placa: vehicleData.placa 
        });

        const userRef = doc(firestore, 'users', uid);
        
        // Prepara payload básico
        const updatePayload: any = {
            'motoristaData.veiculo': vehicleData,
            'motoristaData.status': 'indisponivel',
            'motoristaData.isRegistered': true,
            updatedAt: new Date(),
        };

        // Se houver foto da CNH, salva no nível motoristaData.cnhUrl
        if (vehicleData.cnhUrl) {
            updatePayload['motoristaData.cnhUrl'] = vehicleData.cnhUrl;
        }

        // Se houver arquivo de antecedentes, salva também
        if (vehicleData.antecedenteFileUrl) {
            updatePayload['motoristaData.antecedenteFileUrl'] = vehicleData.antecedenteFileUrl;
        }

        await updateDoc(userRef, updatePayload);

        logger.success('USER_SERVICE', 'Dados do veículo salvos com sucesso', { placa: vehicleData.placa });

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao salvar dados do veículo', error);
        throw error;
    }
}

/**
 * ✅ CORRIGIDO: Upload da foto do veículo para Firebase Storage
 * Agora com tratamento de erro mais robusto e validação de permissões
 */
export async function uploadVehiclePhoto(uid: string, localUri: string, placa: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload para Firebase Storage', { uid, placa });

        // ✅ VALIDAÇÃO: Verificar se o usuário está autenticado
        if (!auth.currentUser) {
            throw new Error('Usuário não autenticado');
        }

        // ✅ VALIDAÇÃO: Verificar se o UID corresponde ao usuário logado
        if (auth.currentUser.uid !== uid) {
            throw new Error('UID do usuário não corresponde ao usuário autenticado');
        }

        // 1. Converte o URI local em um Blob
        logger.debug('USER_SERVICE', 'Convertendo foto para blob');
        const response = await fetch(localUri);
        
        if (!response.ok) {
            throw new Error(`Falha ao carregar imagem: ${response.status}`);
        }
        
        const blob = await response.blob();
        logger.debug('USER_SERVICE', 'Blob criado', { size: blob.size });

        // ✅ VALIDAÇÃO: Verificar tamanho do arquivo (máximo 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (blob.size > maxSize) {
            throw new Error('A imagem é muito grande. Tamanho máximo: 5MB');
        }

        // 2. Define o caminho no Storage com sanitização
        const sanitizedPlaca = placa.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
        const fileName = `veiculo_${sanitizedPlaca}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `vehicles/${uid}/${fileName}`);
        
        logger.debug('USER_SERVICE', 'Caminho do storage definido', { fileName });
        
        // 3. Configura metadata para melhor organização
        const metadata = {
            customMetadata: {
                owner: uid,
                placa: sanitizedPlaca,
                uploadedAt: new Date().toISOString(),
                app: 'BahiaDriver'
            }
        };
        
        // 4. Faz o upload do Blob para Firebase Storage
        logger.info('USER_SERVICE', 'Fazendo upload para Firebase Storage...');
        const snapshot = await uploadBytes(storageRef, blob, metadata);
        logger.success('USER_SERVICE', 'Upload para Storage concluído', {
            bytesTransferred: snapshot.metadata.size
        });
        
        // 5. Obtém e retorna a URL pública do Storage
        logger.debug('USER_SERVICE', 'Obtendo URL pública do Storage');
        const downloadURL = await getDownloadURL(snapshot.ref);
        logger.success('USER_SERVICE', 'Foto do veículo disponível no Storage', { 
            url: downloadURL.substring(0, 50) + '...',
            fullPath: snapshot.metadata.fullPath
        });
        
        return downloadURL;

    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao fazer upload para Firebase Storage', {
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            uid,
            placa
        });
        
        // ✅ TRATAMENTO ESPECÍFICO PARA ERRO DE PERMISSÃO
        if (error instanceof Error && error.message.includes('unauthorized')) {
            throw new Error('Sem permissão para fazer upload. Verifique as regras de segurança do Firebase Storage.');
        }
        
        throw error;
    }
}

/**
 * ✅ NOVA FUNÇÃO: Fazer logout do usuário
 */
export async function logoutUser(): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Fazendo logout do usuário');
        await signOut(auth);
        logger.success('USER_SERVICE', 'Logout realizado com sucesso');
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao fazer logout', error);
        throw error;
    }
}

/**
 * ✅ NOVA FUNÇÃO: Verificar permissões do Storage
 */
export async function checkStoragePermissions(uid: string): Promise<boolean> {
    try {
        logger.debug('USER_SERVICE', 'Verificando permissões do Storage', { uid });
        
        const testRef = ref(storage, `vehicles/${uid}/test_permission_${Date.now()}.txt`);
        const testBlob = new Blob(['test'], { type: 'text/plain' });
        
        await uploadBytes(testRef, testBlob);
        await getDownloadURL(testRef);
        
        logger.success('USER_SERVICE', 'Permissões do Storage verificadas com sucesso');
        return true;
    } catch (error) {
        logger.error('USER_SERVICE', 'Falha na verificação de permissões do Storage', error);
        return false;
    }
}

/**
 * Faz upload do avatar do usuário e salva a URL no documento do usuário.
 */
export async function uploadUserAvatar(uid: string, localUri: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload de avatar', { uid });

        // Pode haver uma pequena janela onde auth.currentUser ainda não foi preenchido
        // após a criação do usuário. Tentamos aguardar rapidamente por até 2 segundos.
        const waitForAuth = async (expectedUid: string, timeout = 2000) => {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                if (auth.currentUser && auth.currentUser.uid === expectedUid) return true;
                // eslint-disable-next-line no-await-in-loop
                await new Promise(res => setTimeout(res, 200));
            }
            return !!(auth.currentUser && auth.currentUser.uid === expectedUid);
        };

        const authReady = await waitForAuth(uid, 2000);
        if (!authReady) {
            logger.warn('USER_SERVICE', 'auth.currentUser não estava pronto antes do upload de avatar; continuando mesmo assim', { uid, authUid: auth.currentUser?.uid });
        }

        const response = await fetch(localUri);
        if (!response.ok) throw new Error('Falha ao carregar imagem local');
        const blob = await response.blob();

        // Use nome fixo para o avatar para evitar acumular arquivos antigos
        const fileName = `avatar.jpg`;
        const storageRef = ref(storage, `avatars/${uid}/${fileName}`);

        const metadata = { contentType: 'image/jpeg', customMetadata: { owner: uid, uploadedAt: new Date().toISOString() } };

        // Faz upload (sobrescreve se já existir)
        const snapshot = await uploadBytes(storageRef, blob, metadata as any);
        const downloadURL = await getDownloadURL(snapshot.ref);

        // Log do caminho completo no Storage para facilitar depuração
        logger.debug('USER_SERVICE', 'Upload concluído no Storage', { fullPath: snapshot.metadata.fullPath });

        // Salva a URL no perfil do usuário (usando setDoc merge para garantir que o documento seja criado/atualizado)
        const userRef = doc(firestore, 'users', uid);
        try {
            // setDoc com merge: true evita falha caso o documento não exista e preserva outros campos
            await setDoc(userRef, { avatarUrl: downloadURL, updatedAt: new Date() }, { merge: true });
            logger.success('USER_SERVICE', 'avatarUrl salvo no Firestore', { uid, avatarUrl: downloadURL.substring(0, 80) + '...' });
        } catch (e) {
            logger.error('USER_SERVICE', 'Falha ao salvar avatarUrl no Firestore', e);
            // Ainda retornamos a URL do Storage — o arquivo já está lá.
        }

        logger.success('USER_SERVICE', 'Avatar enviado e salvo', { uid, url: downloadURL.substring(0, 80) + '...' });
        return downloadURL;
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao enviar avatar', error);
        throw error;
    }
}

/**
 * Faz upload da foto da CNH para o Firebase Storage e retorna a URL pública.
 */
export async function uploadCnhPhoto(uid: string, localUri: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload de CNH para Firebase Storage', { uid });

        if (!auth.currentUser) throw new Error('Usuário não autenticado');
        if (auth.currentUser.uid !== uid) throw new Error('UID do usuário não corresponde ao usuário autenticado');

        const response = await fetch(localUri);
        if (!response.ok) throw new Error('Falha ao carregar imagem local');
        const blob = await response.blob();

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (blob.size > maxSize) throw new Error('A imagem da CNH é muito grande. Máx 5MB');

        const fileName = `cnh_${Date.now()}.jpg`;
        const storageRef = ref(storage, `cnhs/${uid}/${fileName}`);

        const metadata = { contentType: 'image/jpeg', customMetadata: { owner: uid, uploadedAt: new Date().toISOString() } };
        const snapshot = await uploadBytes(storageRef, blob, metadata as any);
        const downloadURL = await getDownloadURL(snapshot.ref);

        logger.success('USER_SERVICE', 'CNH enviada para Storage', { uid, path: snapshot.metadata.fullPath });
        return downloadURL;
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao enviar CNH', error);
        throw error;
    }
}

/**
 * Faz upload de um arquivo de antecedentes (PDF / imagem) para o Firebase Storage e retorna a URL pública.
 */
export async function uploadAntecedenteFile(uid: string, localUri: string, fileName?: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload de arquivo de antecedentes para Firebase Storage', { uid });

        if (!auth.currentUser) throw new Error('Usuário não autenticado');
        if (auth.currentUser.uid !== uid) throw new Error('UID do usuário não corresponde ao usuário autenticado');

        const response = await fetch(localUri);
        if (!response.ok) throw new Error('Falha ao carregar arquivo local');
        const blob = await response.blob();

        const maxSize = 10 * 1024 * 1024; // 10MB para documentos
        if (blob.size > maxSize) throw new Error('O arquivo é muito grande. Máx 10MB');

        const safeName = fileName ? fileName.replace(/[^a-zA-Z0-9_.-]/g, '_') : `antecedente_${Date.now()}`;
        const ext = (safeName.includes('.') ? safeName.split('.').pop() : 'pdf') || 'pdf';
        const finalName = `${safeName}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, `antecedentes/${uid}/${finalName}`);

        const metadata = { contentType: blob.type || 'application/octet-stream', customMetadata: { owner: uid, uploadedAt: new Date().toISOString() } };
        const snapshot = await uploadBytes(storageRef, blob, metadata as any);
        const downloadURL = await getDownloadURL(snapshot.ref);

        logger.success('USER_SERVICE', 'Arquivo de antecedentes enviado para Storage', { uid, path: snapshot.metadata.fullPath });
        return downloadURL;
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao enviar arquivo de antecedentes', error);
        throw error;
    }
}