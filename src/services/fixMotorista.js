import { 
  doc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  collection,
  query,
  where,
  limit
} from 'firebase/firestore';

import { firestore } from "../config/firebaseConfig";  // <- IMPORT CORRETO

/**
 * Corrige dados problemáticos de um motorista específico
 */
export const corrigirDadosMotorista = async (motoristaId) => {
  try {
    console.log('🛠️ Corrigindo dados do motorista:', motoristaId);

    // resolve user doc by uid: direct doc at users/{uid} or a migrated email-based id where field uid==motoristaId
    async function resolveUserRef(u) {
      const directRef = doc(firestore, 'users', u);
      const snap = await getDoc(directRef);
      if (snap.exists()) return directRef;
      const q = query(collection(firestore, 'users'), where('uid', '==', u), limit(1));
      const res = await getDocs(q);
      if (!res.empty) return res.docs[0].ref;
      return directRef;
    }

    const motoristaRef = await resolveUserRef(motoristaId);
    const motoristaSnap = await getDoc(motoristaRef);

    if (!motoristaSnap.exists()) {
      console.log('❌ Motorista não encontrado');
      return false;
    }

    const dados = motoristaSnap.data();
    console.log('📋 Dados atuais do motorista:', dados);

    // ❌ REMOVIDO: "const updates: any = {}"
    // ✔️ CORRETO:
    const updates = {};

    if (dados.expoPushToken === 'NÃO' || dados.expoPushToken === 'SIM') {
      updates.expoPushToken = '';
    }

    if (dados.pushToken === 'SIM' || dados.pushToken === 'NÃO') {
      updates.pushToken = '';
    }

    if (!Object.prototype.hasOwnProperty.call(dados, 'disponivel')) {
      updates.disponivel = true;
    }

    if (!dados.perfil) {
      updates.perfil = 'motorista';
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(motoristaRef, updates);
      console.log('✅ Dados corrigidos:', updates);
    }

    return true;

  } catch (error) {
    console.error('❌ Erro ao corrigir dados do motorista:', error);
    return false;
  }
};


/**
 * Corrige TODOS os motoristas com dados problemáticos
 */
export const corrigirTodosMotoristas = async () => {
  try {
    console.log('🛠️ Buscando todos os motoristas');

    const usersRef = collection(firestore, "users");
    const snapshot = await getDocs(usersRef);

    let correcoes = 0;

    for (const docSnap of snapshot.docs) {
      const dados = docSnap.data();

      if (
        dados.perfil === 'motorista' &&
        (dados.expoPushToken === 'NÃO' || dados.pushToken === 'SIM')
      ) {
        const resultado = await corrigirDadosMotorista(docSnap.id);
        if (resultado) correcoes++;
      }
    }

    console.log(`✅ Correção concluída: ${correcoes}`);
    return { total: snapshot.size, correcoes };

  } catch (error) {
    console.error('❌ Erro ao corrigir todos os motoristas:', error);
    return { total: 0, correcoes: 0, error: error.message };
  }
};


/**
 * Verificar status
 */
export const verificarStatusMotorista = async (motoristaId) => {
  try {
    const motoristaRef = doc(firestore, 'users', motoristaId);
    const motoristaSnap = await getDoc(motoristaRef);

    if (motoristaSnap.exists()) {
      return motoristaSnap.data();
    }

    return null;

  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    return null;
  }
};
