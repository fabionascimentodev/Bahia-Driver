import { 
  doc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  collection 
} from 'firebase/firestore';
import { firestore } from "../config/firebaseConfig"; // <- adicione


export const limparCorridasAntigas = async () => {
  try {
    console.log('🧹 Iniciando limpeza de corridas antigas...');
    
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutos atrás
    
    // ✅ AGORA USANDO OS ÍNDICES QUE VOCÊ JÁ TEM!
    const q = query(
      collection(firestore, 'rides'),
      where('status', 'in', ['buscando', 'pendente']),
      where('createdAt', '<', Timestamp.fromDate(cutoffTime))
      // ✅ ORDENAÇÃO REMOVIDA PARA EVITAR NOVOS ÍNDICES
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✅ Nenhuma corrida antiga para limpar');
      return 0;
    }
    
    const batch = writeBatch(firestore);
    let contador = 0;
    
    snapshot.forEach((docSnap) => {
      batch.update(doc(firestore, 'rides', docSnap.id), { 
        status: 'expirada',
        motivoExpiracao: 'Tempo limite excedido',
        updatedAt: Timestamp.now()
      });
      contador++;
    });
    
    await batch.commit();
    console.log(`✅ ${contador} corridas antigas marcadas como expiradas`);
    return contador;
    
  } catch (error) {
    console.error('❌ Erro ao limpar corridas antigas:', error);
    
    // ✅ SE AINDA DER ERRO, TENTA MÉTODO ALTERNATIVO
    if (error.code === 'failed-precondition') {
      console.log('⚠️ Tentando método alternativo...');
      return await limparCorridasAlternativo();
    }
    
    return 0;
  }
};

// ✅ MÉTODO ALTERNATIVO MAIS SIMPLES
export const limparCorridasAlternativo = async () => {
  try {
    console.log('🔄 Usando método alternativo de limpeza...');
    
    // Busca apenas por status (sem filtro de data)
    const q = query(
      collection(firestore, 'rides'),
      where('status', 'in', ['buscando', 'pendente'])
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✅ Nenhuma corrida para limpar');
      return 0;
    }
    
    const batch = writeBatch(firestore);
    let contador = 0;
    const agora = new Date();
    
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      const diferencaMinutos = (agora - createdAt) / (1000 * 60);
      
      // Limpa apenas corridas com mais de 30 minutos
      if (diferencaMinutos > 30) {
        batch.update(doc(firestore, 'rides', docSnap.id), { 
          status: 'expirada',
          motivoExpiracao: 'Limpeza automática - tempo excedido',
          updatedAt: Timestamp.now()
        });
        contador++;
      }
    });
    
    if (contador > 0) {
      await batch.commit();
    }
    
    console.log(`✅ ${contador} corridas limpas (método alternativo)`);
    return contador;
    
  } catch (error) {
    console.error('❌ Erro no método alternativo:', error);
    return 0;
  }
};

export const limpezaManualCompleta = async () => {
  try {
    console.log('🧹🧹 LIMPEZA MANUAL COMPLETA INICIADA...');
    
    // Busca TODAS as corridas independente do status
    const q = query(collection(firestore, 'rides'));
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✅ Nenhuma corrida para limpar');
      return 0;
    }
    
    const batch = writeBatch(firestore);
    let contador = 0;
    const agora = new Date();
    const cutoffTime = new Date(agora.getTime() - 24 * 60 * 60 * 1000); // 24 horas
    
    snapshot.forEach((docSnap) => {
      const dados = docSnap.data();
      const createdAt = dados.createdAt?.toDate?.() || new Date();
      
      // Limpa corridas antigas ou com status problemáticos
      if (createdAt < cutoffTime && 
          (dados.status === 'buscando' || dados.status === 'pendente')) {
        
        batch.update(doc(firestore, 'rides', docSnap.id), { 
          status: 'expirada',
          motivoExpiracao: 'Limpeza manual - corrida muito antiga',
          updatedAt: Timestamp.now()
        });
        contador++;
      }
    });
    
    if (contador > 0) {
      await batch.commit();
      console.log(`✅ LIMPEZA MANUAL: ${contador} corridas expiradas`);
    } else {
      console.log('✅ Nenhuma corrida antiga encontrada para limpeza manual');
    }
    
    return contador;
    
  } catch (error) {
    console.error('❌ Erro na limpeza manual:', error);
    return 0;
  }
};

export const limparCorridasRejeitadas = async () => {
  try {
    console.log('🗑️ Limpando corridas rejeitadas...');
    
    const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // 10 minutos atrás
    
    const q = query(
      collection(firestore, 'rides'),
      where('status', '==', 'rejeitada'),
      where('rejeitadaEm', '<', Timestamp.fromDate(cutoffTime))
    );
    
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      console.log('✅ Nenhuma corrida rejeitada para limpar');
      return 0;
    }
    
    const batch = writeBatch(firestore);
    let contador = 0;
    
    snapshot.forEach((docSnap) => {
      batch.update(doc(firestore, 'rides', docSnap.id), {
        status: 'expirada',
        motivoExpiracao: 'Corrida rejeitada removida',
        updatedAt: Timestamp.now()
      });
      contador++;
    });
    
    await batch.commit();
    console.log(`✅ ${contador} corridas rejeitadas limpas`);
    return contador;
    
  } catch (error) {
    console.error('❌ Erro ao limpar corridas rejeitadas:', error);
    return 0;
  }
};

export const iniciarLimpezaAutomatica = () => {
  console.log('🔄 Serviço de limpeza automática iniciado');
  
  // Executar após 5 segundos do app carregar
  setTimeout(() => {
    limparCorridasAntigas().catch(console.error);
    limparCorridasRejeitadas().catch(console.error);
  }, 5000);
  
  // Configurar intervalos
  const intervaloCorridas = setInterval(() => {
    limparCorridasAntigas().catch(console.error);
  }, 10 * 60 * 1000); // A cada 10 minutos
  
  const intervaloRejeitadas = setInterval(() => {
    limparCorridasRejeitadas().catch(console.error);
  }, 5 * 60 * 1000); // A cada 5 minutos
  
  return () => {
    clearInterval(intervaloCorridas);
    clearInterval(intervaloRejeitadas);
  };
};