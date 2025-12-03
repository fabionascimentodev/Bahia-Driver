import { firestore, storage } from '../config/firebaseConfig';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword as firebaseCreateUser, signOut, signInWithPhoneNumber, PhoneAuthProvider, linkWithCredential, UserCredential, signInWithCredential, EmailAuthProvider } from 'firebase/auth';
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
    // Opcional: URL do documento do veículo (foto do CRV/CRLV, etc.)
    documentoUrl?: string;
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

        // Prepara payload básico, removendo campos undefined para evitar erro do Firestore
        const veiculoPayload: any = {};
        if (vehicleData.modelo !== undefined) veiculoPayload.modelo = vehicleData.modelo;
        if (vehicleData.placa !== undefined) veiculoPayload.placa = vehicleData.placa;
        if (vehicleData.cor !== undefined) veiculoPayload.cor = vehicleData.cor;
        if (vehicleData.ano !== undefined) veiculoPayload.ano = vehicleData.ano;
        if (vehicleData.fotoUrl) veiculoPayload.fotoUrl = vehicleData.fotoUrl;
        if (vehicleData.documentoUrl) veiculoPayload.documentoUrl = vehicleData.documentoUrl;
        if (vehicleData.cnhUrl) veiculoPayload.cnhUrl = vehicleData.cnhUrl;
        if (vehicleData.antecedenteFileUrl) veiculoPayload.antecedenteFileUrl = vehicleData.antecedenteFileUrl;

        const updatePayload: any = {
            'motoristaData.veiculo': veiculoPayload,
            'motoristaData.status': 'indisponivel',
            'motoristaData.isRegistered': true,
            updatedAt: new Date(),
        };

        // Se houver url de CNH ou antecedentes, também salve em campos de nível superior (opcional)
        if (vehicleData.cnhUrl) {
            updatePayload['motoristaData.cnhUrl'] = vehicleData.cnhUrl;
        }
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

    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao fazer upload para Firebase Storage', {
            error: error?.message || error,
            uid,
            placa
        });

        // Mapear erros de permissão do Storage para um código conhecido
        const msg = (error && (error.message || error.toString())) || 'Erro desconhecido';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
            const e: any = new Error('Sem permissão para fazer upload. Verifique as regras de segurança do Firebase Storage.');
            e.code = 'storage-unauthorized';
            throw e;
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
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao enviar avatar', error);
        const msg = (error && (error.message || error.toString())) || 'Erro desconhecido';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
            const e: any = new Error('Sem permissão para fazer upload do avatar. Verifique as regras de segurança do Firebase Storage.');
            e.code = 'storage-unauthorized';
            throw e;
        }
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
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao enviar CNH', error);
        const msg = (error && (error.message || error.toString())) || 'Erro desconhecido';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
            const e: any = new Error('Sem permissão para fazer upload da CNH. Verifique as regras de segurança do Firebase Storage.');
            e.code = 'storage-unauthorized';
            throw e;
        }
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
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao enviar arquivo de antecedentes', error);
        const msg = (error && (error.message || error.toString())) || 'Erro desconhecido';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
            const e: any = new Error('Sem permissão para fazer upload do arquivo de antecedentes. Verifique as regras de segurança do Firebase Storage.');
            e.code = 'storage-unauthorized';
            throw e;
        }
        throw error;
    }
}

/**
 * Solicita envio do OTP para um número de telefone. Retorna o `ConfirmationResult`
 * que deve ser usado posteriormente para confirmar o código OTP.
 */
export async function requestPhoneSignIn(phone: string): Promise<any> {
    try {
        logger.info('USER_SERVICE', 'Solicitando OTP para telefone', { phone });
        const confirmationResult = await signInWithPhoneNumber(auth, phone as any);
        logger.success('USER_SERVICE', 'OTP enviado', { phone });
        return confirmationResult;
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao solicitar OTP', error);
        throw error;
    }
}

/**
 * Confirma o OTP recebido (usado no fluxo de login por telefone).
 * Garante que exista um documento do usuário no Firestore (cria se necessário)
 * e inicializa `modoAtual` como 'passageiro' no primeiro acesso.
 */
export async function confirmPhoneSignIn(confirmationResult: any, verificationCode: string): Promise<UserCredential> {
    try {
        logger.info('USER_SERVICE', 'Confirmando OTP', {});
        const userCredential: UserCredential = await confirmationResult.confirm(verificationCode);
        const user = userCredential.user;

        logger.success('USER_SERVICE', 'Login por telefone confirmado', { uid: user.uid, phone: user.phoneNumber });

        // Garantir que o documento do usuário exista no Firestore
        const userRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            const userData: any = {
                uid: user.uid,
                email: user.email || '',
                nome: '',
                telefone: user.phoneNumber || '',
                modoAtual: 'passageiro',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await setDoc(userRef, userData);
            logger.success('USER_SERVICE', 'Perfil criado no Firestore para login por telefone', { uid: user.uid });
        } else {
            // Atualizar telefone e garantir modoAtual padrão
            const data = userDoc.data() as any;
            const updates: any = { updatedAt: new Date() };
            if (!data.telefone && user.phoneNumber) updates.telefone = user.phoneNumber;
            if (!data.modoAtual) updates.modoAtual = 'passageiro';
            if (Object.keys(updates).length > 1) {
                await setDoc(userRef, updates, { merge: true });
                logger.debug('USER_SERVICE', 'Perfil atualizado com telefone/modoAtual padrão', { uid: user.uid });
            }
        }

        return userCredential;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao confirmar OTP', error);
        const code = (error as any)?.code || (error as any)?.message || 'unknown';
        if (code === 'auth/account-exists-with-different-credential' || code === 'auth/credential-already-in-use' || code === 'auth/phone-number-already-exists') {
            throw { code: 'phone-linked-elsewhere', message: 'Este número de telefone já está associado a outra conta. Tente entrar com telefone ou com o e-mail associado.' };
        }
        throw error;
    }
}

/**
 * Vincula um telefone (verificação por OTP) à conta atualmente autenticada (link).
 * Recebe o verificationId (obtido ao enviar SMS) e o código OTP digitado.
 */
export async function linkPhoneToCurrentUser(verificationId: string, verificationCode: string): Promise<UserCredential> {
    try {
        if (!auth.currentUser) throw new Error('Usuário não autenticado para vincular telefone');
        logger.info('USER_SERVICE', 'Vinculando telefone à conta atual', { uid: auth.currentUser.uid });

        const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
        const linked = await linkWithCredential(auth.currentUser, credential as any);

        // Atualiza telefone no Firestore
        const userRef = doc(firestore, 'users', auth.currentUser.uid);
        await setDoc(userRef, { telefone: linked.user.phoneNumber, updatedAt: new Date() }, { merge: true });
        logger.success('USER_SERVICE', 'Telefone vinculado e salvo no Firestore', { uid: auth.currentUser.uid, phone: linked.user.phoneNumber });

        return linked;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao vincular telefone', error);
        // Mapear erros comuns para mensagens amigáveis
        const code = error?.code || error?.message || 'unknown';
        if (code === 'auth/credential-already-in-use' || code === 'auth/phone-number-already-exists') {
            // Telefone já está vinculado a outra conta
            throw { code: 'phone-already-linked', message: 'Este número de telefone já está vinculado a outra conta. Você pode entrar usando o telefone ou contatar o suporte.' };
        }
        if (code === 'auth/requires-recent-login') {
            throw { code: 'requires-recent-login', message: 'Para vincular o telefone, é necessária uma autenticação recente. Saia e entre novamente e tente novamente.' };
        }

        throw error;
    }
}

/**
 * Salva o `modoAtual` do usuário no Firestore.
 */
export async function setModoAtual(uid: string, modo: 'passageiro' | 'motorista'): Promise<void> {
    try {
        const userRef = doc(firestore, 'users', uid);
        await setDoc(userRef, { modoAtual: modo, updatedAt: new Date() }, { merge: true });
        logger.success('USER_SERVICE', 'modoAtual salvo no Firestore', { uid, modo });
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao salvar modoAtual', error);
        throw error;
    }
}

/**
 * Faz sign-in com o credential de telefone (usado para entrar na conta que já tem o telefone).
 */
export async function signInWithPhoneCredential(verificationId: string, verificationCode: string): Promise<UserCredential> {
    try {
        const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
        const userCredential = await signInWithCredential(auth, credential as any);
        logger.success('USER_SERVICE', 'Assinado com telefone (credential)', { uid: userCredential.user.uid });
        return userCredential;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao assinar com credential de telefone', error);
        throw error;
    }
}

/**
 * Vincula a credencial de email (email+senha) à conta atualmente autenticada (geralmente a conta por telefone após sign-in).
 */
export async function linkEmailToCurrentUser(email: string, password: string): Promise<UserCredential> {
    try {
        if (!auth.currentUser) throw new Error('Usuário não autenticado para vincular email');
        const credential = EmailAuthProvider.credential(email, password);
        const linked = await linkWithCredential(auth.currentUser, credential as any);
        logger.success('USER_SERVICE', 'Email vinculado à conta atual', { uid: linked.user.uid, email });
        return linked;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao vincular email à conta atual', error);
        throw error;
    }
}

/**
 * Encontra UID do usuário pelo telefone armazenado no Firestore (campo `telefone`).
 */
export async function findUidByPhone(phone: string): Promise<string | null> {
    try {
        // consulta simples por igualdade usando modular Firestore
        const { query: qf, where: wf, collection: cf, getDocs } = await Promise.resolve(require('firebase/firestore')) as any;
        const col = cf(firestore, 'users');
        const q = qf(col, wf('telefone', '==', phone));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        const doc0 = snap.docs[0];
        return doc0.id;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao buscar UID por telefone', error);
        return null;
    }
}

/**
 * Mescla perfis do usuário: copia campos do `sourceUid` para `targetUid` (não destrutivo) e marca o documento fonte como mesclado.
 * Opcionalmente transfere corridas (rides) do firestore atualizando passageiroId/motoristaId.
 */
export async function mergeUserAccounts(sourceUid: string, targetUid: string, transferRides = false): Promise<void> {
    try {
        const sourceRef = doc(firestore, 'users', sourceUid);
        const targetRef = doc(firestore, 'users', targetUid);
        const [srcSnap, tgtSnap] = await Promise.all([getDoc(sourceRef), getDoc(targetRef)]);
        if (!srcSnap.exists()) throw new Error('Perfil fonte não encontrado');
        const src = srcSnap.data() as any;
        const tgt = tgtSnap.exists() ? (tgtSnap.data() as any) : {};

        // Campos que copiamos: nome, avatarUrl, motoristaData (merge), telefone (preferir target se já existir), modoAtual
        const merged: any = { ...(tgt || {}) };
        if (src.nome && !merged.nome) merged.nome = src.nome;
        if (src.avatarUrl && !merged.avatarUrl) merged.avatarUrl = src.avatarUrl;
        // merge motoristaData: preferir target values, mas copy missing
        merged.motoristaData = { ...(src.motoristaData || {}), ...(tgt.motoristaData || {}) };
        if (!merged.telefone && src.telefone) merged.telefone = src.telefone;
        // modoAtual: preferir target, senão source
        merged.modoAtual = tgt.modoAtual || src.modoAtual || 'passageiro';
        merged.updatedAt = new Date();

        await setDoc(targetRef, merged, { merge: true });

        // marcar fonte como mesclada
        await setDoc(sourceRef, { mergedTo: targetUid, mergedAt: new Date() }, { merge: true });

        logger.success('USER_SERVICE', 'Perfis mesclados com sucesso', { sourceUid, targetUid });

        if (transferRides) {
            try {
                const { collection: cf, query: qf, where: wf, getDocs, updateDoc } = await Promise.resolve(require('firebase/firestore')) as any;
                const ridesCol = cf(firestore, 'rides');
                // transfer passenger rides
                const qPass = qf(ridesCol, wf('passageiroId', '==', sourceUid));
                const snapPass = await getDocs(qPass);
                const promises: Promise<any>[] = [];
                snapPass.forEach((d: any) => {
                    promises.push(updateDoc(d.ref, { passageiroId: targetUid }));
                });
                // transfer driver rides
                const qDrv = qf(ridesCol, wf('motoristaId', '==', sourceUid));
                const snapDrv = await getDocs(qDrv);
                snapDrv.forEach((d: any) => {
                    promises.push(updateDoc(d.ref, { motoristaId: targetUid }));
                });
                await Promise.all(promises);
                logger.success('USER_SERVICE', 'Corridas transferidas para o novo UID', { sourceUid, targetUid });
            } catch (e) {
                logger.warn('USER_SERVICE', 'Falha ao transferir corridas durante merge (continuando)', e);
            }
        }
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao mesclar contas', error);
        throw error;
    }
}

/**
 * Salva um registro no collection `motoristas/{uid}` e marca o usuário como motorista.
 * Define `isMotorista: true` no documento de usuário e cria/atualiza o documento em `motoristas`.
 */
export async function saveMotoristaRecord(uid: string, vehicleData: VehicleData): Promise<void> {
    try {
        logger.info('USER_SERVICE', 'Salvando registro em /motoristas', { uid, placa: vehicleData.placa });

        const motoristaRef = doc(firestore, 'motoristas', uid);
        // Sanitiza vehicleData para não incluir campos undefined (causa erro no Firestore)
        const veiculoPayload: any = {};
        if (vehicleData.modelo !== undefined) veiculoPayload.modelo = vehicleData.modelo;
        if (vehicleData.placa !== undefined) veiculoPayload.placa = vehicleData.placa;
        if (vehicleData.cor !== undefined) veiculoPayload.cor = vehicleData.cor;
        if (vehicleData.ano !== undefined) veiculoPayload.ano = vehicleData.ano;
        if (vehicleData.fotoUrl) veiculoPayload.fotoUrl = vehicleData.fotoUrl;
        if (vehicleData.documentoUrl) veiculoPayload.documentoUrl = vehicleData.documentoUrl;
        if (vehicleData.cnhUrl) veiculoPayload.cnhUrl = vehicleData.cnhUrl;
        if (vehicleData.antecedenteFileUrl) veiculoPayload.antecedenteFileUrl = vehicleData.antecedenteFileUrl;

        const payload: any = {
            uid,
            veiculo: veiculoPayload,
            isMotorista: true,
            updatedAt: new Date(),
        };

        // Criar ou atualizar registro do motorista
        await setDoc(motoristaRef, payload, { merge: true });

        // Também marcar no documento de usuário para consultas rápidas
        const userRef = doc(firestore, 'users', uid);
        await setDoc(userRef, { isMotorista: true, 'motoristaData.isRegistered': true, updatedAt: new Date() }, { merge: true });

        logger.success('USER_SERVICE', 'Registro de motorista salvo com sucesso', { uid });
    } catch (error) {
        logger.error('USER_SERVICE', 'Erro ao salvar registro de motorista', error);
        throw error;
    }
}

/**
 * Faz upload de uma foto do documento do veículo (CRV/CRLV/etc.) e retorna a URL pública.
 */
export async function uploadVehicleDocument(uid: string, localUri: string, placa?: string): Promise<string> {
    try {
        logger.info('USER_SERVICE', 'Iniciando upload de documento do veículo para Firebase Storage', { uid, placa });

        if (!auth.currentUser) throw new Error('Usuário não autenticado');
        if (auth.currentUser.uid !== uid) throw new Error('UID do usuário não corresponde ao usuário autenticado');

        const response = await fetch(localUri);
        if (!response.ok) throw new Error('Falha ao carregar imagem local');
        const blob = await response.blob();

        const maxSize = 10 * 1024 * 1024; // 10MB para documentos
        if (blob.size > maxSize) throw new Error('O documento é muito grande. Máx 10MB');

        const sanitizedPlaca = placa ? placa.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase() : `doc_${Date.now()}`;
        const fileName = `documento_${sanitizedPlaca}_${Date.now()}.jpg`;
        const storageRef = ref(storage, `vehicle_documents/${uid}/${fileName}`);

        const metadata = { contentType: 'image/jpeg', customMetadata: { owner: uid, placa: sanitizedPlaca, uploadedAt: new Date().toISOString() } } as any;
        const snapshot = await uploadBytes(storageRef, blob, metadata);
        const downloadURL = await getDownloadURL(snapshot.ref);

        logger.success('USER_SERVICE', 'Documento do veículo enviado para Storage', { uid, path: snapshot.metadata.fullPath });
        return downloadURL;
    } catch (error: any) {
        logger.error('USER_SERVICE', 'Erro ao enviar documento do veículo', error);
        const msg = (error && (error.message || error.toString())) || 'Erro desconhecido';
        if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('permission')) {
            const e: any = new Error('Sem permissão para fazer upload do documento do veículo. Verifique as regras de segurança do Firebase Storage.');
            e.code = 'storage-unauthorized';
            throw e;
        }
        throw error;
    }
}