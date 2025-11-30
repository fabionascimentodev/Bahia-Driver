import React, { useState, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  Alert,
  ScrollView,
  Dimensions,
  Image,
  RefreshControl,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore as db } from '../../config/firebaseConfig';
import { query, where, onSnapshot, updateDoc, doc, orderBy, collection, getDocs } from 'firebase/firestore';
import { useUserStore } from '../../store/userStore';
import { calcularDistanciaKm } from '../../utils/calculoDistancia';
import { calculateEstimatedPrice } from '../../services/locationServices';
import { updateDriverAvailability, logoutUser, fetchUserProfile } from '../../services/userServices';
import { Linking } from 'react-native';
import { startBroadcastLocation, stopBroadcastLocation, startDriverLocationTracking } from '../../services/driverLocationService';

const HomeScreenMotorista = ({ navigation }: any) => {
  const { user } = useUserStore();
  const driverLocation = useUserStore(state => state.driverLocation);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isDriverOnline = useUserStore(state => state.isDriverOnline);
  const setIsDriverOnline = useUserStore(state => state.setIsDriverOnline);
  const [refreshing, setRefreshing] = useState(false);

  // Busca as solicitações uma vez (usada pelo pull-to-refresh)
  const fetchSolicitacoes = async () => {
    if (!user?.uid) return;
    try {
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'buscando'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const novas: any[] = [];
      snap.forEach(d => novas.push({ id: d.id, ...d.data() }));
      setSolicitacoes(novas);
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    }
  };

  // Dimensões responsivas para a marca d'água (logo) - aumentadas
  const screenWidth = Dimensions.get('window').width;
  const watermarkWidth = Math.min(1200, Math.round(screenWidth * 0.95));
  const watermarkHeight = Math.round(watermarkWidth * 0.6);

  // Função chamada pelo pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSolicitacoes();
    } finally {
      setRefreshing(false);
    }
  };

  // O listener de solicitações agora roda apenas quando o motorista está online
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe: (() => void) | null = null;

    if (isDriverOnline) {
      const q = query(
        collection(db, 'rides'),
        where('status', '==', 'buscando'),
        orderBy('createdAt', 'desc')
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const novasSolicitacoes: any[] = [];
          snapshot.forEach((doc) => {
            novasSolicitacoes.push({
              id: doc.id,
              ...doc.data()
            });
          });
          setSolicitacoes(novasSolicitacoes);
        },
        (error) => {
          console.error('Erro no listener de solicitações:', error);
          const msg = error?.message || String(error);
          Alert.alert(
            'Firestore - Índice necessário',
            'A consulta que busca solicitações requer a criação de um índice no Firestore.\n\n' +
            'Abra o link fornecido no log do Metro para criar o índice ou acesse o Firebase Console -> Firestore -> Indexes.\n\n' +
            'Erro: ' + msg
          );
        }
      );
    } else {
      // quando ficar offline, limpamos a lista local para evitar confusão
      setSolicitacoes([]);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, isDriverOnline]);

  // Header icon to open driver profile (left margin 1)
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('DriverProfile')} style={{ marginLeft: 1, padding: 6 }} accessibilityLabel="Perfil">
          <Ionicons name="person-circle" size={22} color={COLORS.whiteAreia} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleLogout} style={{ marginRight: 1, padding: 6 }} accessibilityLabel="Sair">
          <Ionicons name="log-out" size={22} color={COLORS.whiteAreia} />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // ✅ FUNÇÃO PARA ACEITAR CORRIDA
  const aceitarCorrida = async (solicitacao: any) => {
    try {
      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado.');
        return;
      }
      setLoading(true);

      // Calcula distância entre origem e destino para preço real
      const origem = solicitacao.origem;
      const destino = solicitacao.destino;
      let distanciaKm = 0;
      try {
        if (origem && destino && origem.latitude && destino.latitude) {
          distanciaKm = calcularDistanciaKm({ latitude: origem.latitude, longitude: origem.longitude }, { latitude: destino.latitude, longitude: destino.longitude });
        }
      } catch (e) {
        console.warn('Erro ao calcular distância:', e);
      }

      const precoReal = calculateEstimatedPrice(distanciaKm);

      // Buscar dados do perfil para incluir avatar e dados do veículo
      let motoristaAvatar: string | null = null;
      let motoristaVeiculo: any = null;
      try {
        const profile = await fetchUserProfile(user.uid);
        if (profile) {
          motoristaAvatar = (profile as any).avatarUrl || null;
          motoristaVeiculo = (profile as any).motoristaData?.veiculo || null;
        }
      } catch (err) {
        console.warn('Falha ao buscar perfil do motorista para enriquecer a corrida:', err);
      }

      await updateDoc(doc(db, 'rides', solicitacao.id), {
        status: 'aceita',
        motoristaId: user.uid,
        motoristaNome: user.nome,
        motoristaAvatar: motoristaAvatar,
        motoristaVeiculo: motoristaVeiculo,
        aceitaEm: new Date(),
        distanciaKm: distanciaKm,
        precoEstimado: precoReal,
        preçoEstimado: precoReal,
      });

      // Inicia o rastreamento da localização do motorista ANTES de navegar
      try {
        await startDriverLocationTracking(solicitacao.id);
      } catch (e) {
        console.error('Erro ao iniciar rastreamento após aceitar corrida:', e);
        // Não impedimos a navegação caso o rastreamento falhe, apenas logamos
      }

      // Navegar para tela de ação da corrida
      navigation.navigate('RideAction', { rideId: solicitacao.id });

      // Abrir navegação externa para a origem (pickup)
      try {
        const lat = solicitacao.origem?.latitude;
        const lon = solicitacao.origem?.longitude;
        if (lat && lon) {
          // Prefer Waze, caso esteja instalado
          const wazeUrl = `waze://?ll=${lat},${lon}&navigate=yes`;
          const googleMapsApp = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
          const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

          const opened = await (async () => {
            try {
              const canWaze = await Linking.canOpenURL('waze://');
              if (canWaze) return await Linking.openURL(wazeUrl);
            } catch (e) {}
            try {
              const canGoogle = await Linking.canOpenURL('comgooglemaps://');
              if (canGoogle) return await Linking.openURL(googleMapsApp);
            } catch (e) {}
            return await Linking.openURL(googleMapsWeb);
          })();
        }
      } catch (e) {
        console.warn('Não foi possível abrir app de navegação externa:', e);
      }
      
    } catch (error) {
      console.error('Erro ao aceitar corrida:', error);
      Alert.alert('Erro', 'Não foi possível aceitar a corrida');
    } finally {
      setLoading(false);
    }
  };

  const toggleOnline = async () => {
    if (!user?.uid) return;
    try {
      if (!isDriverOnline) {
        // ir online: primeiro solicita permissão de localização, depois inicia broadcast e atualiza o status
        const { requestLocationPermission } = require('../../services/locationServices');
        const ok = await requestLocationPermission();
        if (!ok) {
          Alert.alert('Permissão necessária', 'Permissão de localização é necessária para ficar online.');
          return;
        }

        try {
          await startBroadcastLocation(user.uid);
        } catch (e) {
          console.error('Erro ao iniciar broadcast de localização:', e);
          Alert.alert('Erro', 'Não foi possível ativar o broadcast de localização.');
          return;
        }

        await updateDriverAvailability(user.uid, 'disponivel');
        setIsDriverOnline(true);
        // Sem alert — apenas atualiza visualmente o botão
      } else {
        // ir offline: para broadcast e atualiza status
        await stopBroadcastLocation();
        await updateDriverAvailability(user.uid, 'indisponivel');
        setIsDriverOnline(false);
        // Sem alert — apenas atualiza visualmente o botão
      }
    } catch (error) {
      console.error('Erro ao alternar online/offline:', error);
      Alert.alert('Erro', 'Não foi possível alterar seu status. Tente novamente.');
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      // limpa store local
      const { logout } = require('../../store/userStore').useUserStore.getState();
      logout();
      navigation.reset({ index: 0, routes: [{ name: 'Auth' as any }] });
    } catch (error) {
      console.error('Erro no logout:', error);
      Alert.alert('Erro', 'Não foi possível sair no momento.');
    }
  };

  // ✅ NOVA FUNÇÃO PARA REJEITAR CORRIDA
  const rejeitarCorrida = async (solicitacao: any) => {
    try {
      Alert.alert(
        'Rejeitar Corrida',
        `Tem certeza que deseja rejeitar a corrida para ${solicitacao.destino}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Rejeitar', 
            style: 'destructive',
            onPress: async () => {
              if (!user) {
                Alert.alert('Erro', 'Usuário não autenticado.');
                return;
              }
              await updateDoc(doc(db, 'rides', solicitacao.id), {
                status: 'rejeitada',
                motoristaRejeitouId: user.uid,
                motoristaRejeitouNome: user.nome,
                rejeitadaEm: new Date(),
                motivoRejeicao: 'Motorista rejeitou a corrida'
              });
              
              Alert.alert('✅', 'Corrida rejeitada com sucesso');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Erro ao rejeitar corrida:', error);
      Alert.alert('Erro', 'Não foi possível rejeitar a corrida');
    }
  };

  // ✅ RENDERIZAR CADA SOLICITAÇÃO (corrigido)
  const renderSolicitacao = (solicitacao: any) => {
    const origemText = typeof solicitacao.origem === 'string'
      ? solicitacao.origem
      : solicitacao.origem?.nome
        ? solicitacao.origem.nome
        : (solicitacao.origem?.latitude && solicitacao.origem?.longitude)
          ? `${Number(solicitacao.origem.latitude).toFixed(5)}, ${Number(solicitacao.origem.longitude).toFixed(5)}`
          : '';

    const destinoText = typeof solicitacao.destino === 'string'
      ? solicitacao.destino
      : solicitacao.destino?.nome
        ? solicitacao.destino.nome
        : (solicitacao.destino?.latitude && solicitacao.destino?.longitude)
          ? `${Number(solicitacao.destino.latitude).toFixed(5)}, ${Number(solicitacao.destino.longitude).toFixed(5)}`
          : '';

    return (
      <View key={solicitacao.id} style={styles.solicitacaoCard}>
        <View style={styles.solicitacaoHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {solicitacao.passageiroAvatar ? (
              <Image source={{ uri: solicitacao.passageiroAvatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                <Text>👤</Text>
              </View>
            )}
            <Text style={styles.passageiroNome}>{solicitacao.passageiroNome || 'Passageiro'}</Text>
          </View>
          <Text style={styles.preco}>R$ {((solicitacao.precoEstimado ?? solicitacao.preçoEstimado) ? Number(solicitacao.precoEstimado ?? solicitacao.preçoEstimado).toFixed(2) : '0.00')}</Text>
        </View>

        <View style={styles.rota}>
          <Text style={styles.rotaText}>🚩 <Text style={styles.strong}>Origem:</Text> {origemText}</Text>
          <Text style={styles.rotaText}>🎯 <Text style={styles.strong}>Destino:</Text> {destinoText}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.rejeitarButton]} onPress={() => rejeitarCorrida(solicitacao)} disabled={loading}>
            <Text style={styles.buttonText}>Rejeitar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.aceitarButton]} onPress={() => aceitarCorrida(solicitacao)} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? 'Aceitando...' : 'Aceitar'}</Text>
          </TouchableOpacity>
        </View>

        {driverLocation && solicitacao.origem?.latitude && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
            <Text style={{ color: '#666', fontSize: 13 }}>
              Distância até o passageiro: {calcularDistanciaKm({ latitude: driverLocation.latitude, longitude: driverLocation.longitude }, { latitude: solicitacao.origem.latitude, longitude: solicitacao.origem.longitude })} km
            </Text>
            {solicitacao.etaMinutes ? (
              <Text style={{ color: '#666', fontSize: 13 }}>ETA até destino (origem→destino): ~{solicitacao.etaMinutes} min</Text>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeftRow}>
          <View style={styles.headerLeftTexts}>
            <Text style={styles.title}>Corridas Disponíveis</Text>
            <Text style={styles.subtitle}>
              {solicitacoes.length} solicitação(ões) pendente(s)
            </Text>
          </View>

          <TouchableOpacity onPress={toggleOnline} style={{ marginRight: 1, padding: 6 }} accessibilityLabel="OnlineOffline">
            <Text style={{ color: isDriverOnline ? COLORS.success : COLORS.danger, fontWeight: '700', fontSize: 22 }}>{isDriverOnline ? 'Online' : 'Offline'}</Text>
          </TouchableOpacity>
        </View>

        {/* header actions handled via navigation options (headerRight) */}
      </View>

      <ScrollView style={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {solicitacoes.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../../assets/logo-bahia-driver-azul.png')}
              style={[
                styles.emptyWatermarkImage,
                { width: watermarkWidth, height: watermarkHeight, tintColor: COLORS.blueBahia, opacity: 0.22 }
              ]}
              resizeMode="contain"
              accessible
              accessibilityLabel="Marca d'água Bahia Driver"
            />

            <Text style={styles.emptyText}>Nenhuma corrida disponível no momento</Text>
            <Text style={styles.emptySubtext}>
              Novas corridas aparecerão aqui automaticamente
            </Text>
          </View>
        ) : (
          solicitacoes.map(renderSolicitacao)
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia,
  },
  header: {
    backgroundColor: COLORS.blueBahia,
    padding: 20,
    paddingTop: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative'
  },
  headerLeft: {
    
    // kept for backward compatibility (not used directly)
    paddingRight: 12,
  },
  headerLeftRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  headerLeftTexts: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.whiteAreia,
    marginBottom: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)'
  },
  controlsBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: 'transparent'
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  logoutButton: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  logoutText: {
    color: COLORS.whiteAreia,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.whiteAreia,
    opacity: 0.9,
  },
  list: {
    flex: 1,
    padding: 15,
  },
  solicitacaoCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.blueBahia,
  },
  solicitacaoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passageiroNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.blueBahia,
  },
  preco: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#27ae60',
  },
  rota: {
    marginBottom: 16,
  },
  rotaText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  strong: {
    fontWeight: '600',
    color: '#333',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aceitarButton: {
    backgroundColor: '#27ae60',
  },
  rejeitarButton: {
    backgroundColor: '#e74c3c',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyWatermark: {
    position: 'absolute',
    fontSize: 160,
    color: 'rgba(0,0,0,0.16)',
    top: '12%',
  },
  emptyWatermarkImage: {
    position: 'absolute',
    top: '75%',
    alignSelf: 'center',
    opacity: 0.22,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default HomeScreenMotorista;