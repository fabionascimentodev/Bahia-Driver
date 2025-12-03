import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
} from 'react-native';
import { COLORS } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { firestore as db } from '../../config/firebaseConfig';
import { query, where, onSnapshot, updateDoc, doc, orderBy, collection, getDocs, getDoc } from 'firebase/firestore';
import { unifiedLocationService } from '../../services/unifiedLocationService';
import { calculateFare } from '../../utils/fareCalculator';
import { useUserStore } from '../../store/userStore';
import { calcularDistanciaKm } from '../../utils/calculoDistancia';
import { calculateEstimatedPrice } from '../../services/locationServices';
import { updateDriverAvailability, logoutUser, fetchUserProfile } from '../../services/userServices';
import { Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
const NAV_PENDING_KEY = '@bahia_driver_pending_nav';
import { startBroadcastLocation, stopBroadcastLocation, startDriverLocationTracking } from '../../services/driverLocationService';

const HomeScreenMotorista = ({ navigation }: any) => {
  const { user } = useUserStore();
  const theme = COLORS;
  const driverLocation = useUserStore(state => state.driverLocation);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const isDriverOnline = useUserStore(state => state.isDriverOnline);
  const setIsDriverOnline = useUserStore(state => state.setIsDriverOnline);
  const [refreshing, setRefreshing] = useState(false);
  const [floatingTextIndex, setFloatingTextIndex] = useState(0);
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // Guarda IDs já notificados para evitar alert duplicado
  const alertedCanceledIds = useRef(new Set<string>());

  // Busca as solicitações uma vez (usada pelo pull-to-refresh)
  const fetchSolicitacoes = async () => {
    if (!user?.uid) return;
    try {
      // Tenta a consulta com filtro composto (mais eficiente)
      try {
        const q = query(
          collection(db, 'rides'),
          where('status', '==', 'buscando'),
          where('visibleToDrivers', '==', true),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const novas: any[] = [];
        snap.forEach(d => novas.push({ id: d.id, ...d.data() }));
        setSolicitacoes(novas);
      } catch (innerErr: any) {
        // Se o Firestore exigir um índice, caímos para uma versão menos eficiente
        // que busca por status apenas e filtra/ordena no cliente.
        const msg = innerErr?.message || String(innerErr);
        console.warn('Consulta composta falhou, usando fallback sem índice:', msg);
        const q2 = query(
          collection(db, 'rides'),
          where('status', '==', 'buscando')
        );
        const snap2 = await getDocs(q2);
        const novas2: any[] = [];
        snap2.forEach(d => {
          const data = { id: d.id, ...d.data() } as any;
          if (data.visibleToDrivers !== false) {
            novas2.push(data);
          }
        });
        // ordenar por createdAt desc no cliente
        novas2.sort((a, b) => {
          const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return tb - ta;
        });
        setSolicitacoes(novas2);
      }
    } catch (err) {
      console.error('Erro ao buscar solicitações:', err);
    }
  };

  // Dimensões responsivas para a marca d'água (logo) - aumentadas
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const watermarkWidth = Math.min(1200, Math.round(screenWidth * 0.95));
  const watermarkHeight = Math.round(watermarkWidth * 0.6);
  // Calculate dynamic positions for watermark and footer for better responsiveness
  const watermarkTop = Math.round(Math.min(Math.max((screenHeight - watermarkHeight) / 2, 120), screenHeight * 0.85));
  const footerBottom = Math.max(48, Math.round(screenHeight * 0.04));
  const floatingMinWidth = Math.min(Math.round(screenWidth - 40), 320);

  // Função chamada pelo pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchSolicitacoes();
    } finally {
      setRefreshing(false);
    }
  };

  // Suaviza animação do botão flutuante: loop de scale+opacity + troca de texto em intervalos
  useEffect(() => {
    let interval: any = null;
    let loopAnim: Animated.CompositeAnimation | null = null;

    if (isDriverOnline) {
      setFloatingTextIndex(0);

      loopAnim = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 0.88,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1.04,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 1,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnim, {
              toValue: 1,
              duration: 650,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loopAnim.start();

      interval = setInterval(() => {
        setFloatingTextIndex((i) => (i + 1) % 2);
      }, 3200);
    } else {
      // reset
      if (loopAnim) loopAnim.stop();
      opacityAnim.setValue(1);
      scaleAnim.setValue(1);
      setFloatingTextIndex(0);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (loopAnim) loopAnim.stop();
    };
  }, [isDriverOnline, opacityAnim, scaleAnim]);

  // O listener de solicitações agora roda apenas quando o motorista está online
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe: (() => void) | null = null;

    if (isDriverOnline) {
      // Tenta registrar o listener com a consulta composta (mais eficiente)
      try {
        const q = query(
          collection(db, 'rides'),
          where('status', '==', 'buscando'),
          where('visibleToDrivers', '==', true),
          orderBy('createdAt', 'desc')
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
              // Detecta mudanças incrementais (removidos/cancelados)
              try {
                const changes = snapshot.docChanges();
                changes.forEach((change) => {
                  if (change.type === 'removed') {
                    const rideId = change.doc.id;
                    const data = change.doc.data() as any;
                    // Evita alert duplicado
                    if (!alertedCanceledIds.current.has(rideId)) {
                      // Mostrar alerta quando houver indício de cancelamento pelo passageiro
                      if (data?.status === 'cancelada' || data?.canceladoPor || data?.visibleToDrivers === false) {
                        alertedCanceledIds.current.add(rideId);
                        console.info('Corrida cancelada pelo passageiro - rideId:', rideId);
                      }
                    }
                  }
                });
              } catch (e) {
                // ignora se docChanges não estiver disponível
              }

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
            console.error('Erro no listener de solicitações (composto):', error);
            const msg = error?.message || String(error);
            // Se o erro for sobre índice, registramos um fallback que não exige índice
            if (msg.includes('requires an index') || msg.includes('índice')) {
              console.warn('Listener composto requisitou índice; usando listener fallback sem índice.');
              // unsubscribe do listener atual (se houver) e cria outro listener simples
              if (unsubscribe) unsubscribe();
              const qSimple = query(
                collection(db, 'rides'),
                where('status', '==', 'buscando')
              );
              unsubscribe = onSnapshot(qSimple, (snapshot2) => {
                try {
                  const changes2 = snapshot2.docChanges();
                  changes2.forEach((change) => {
                      if (change.type === 'removed') {
                        const rideId = change.doc.id;
                        const data = change.doc.data() as any;
                        if (!alertedCanceledIds.current.has(rideId)) {
                          if (data?.status === 'cancelada' || data?.canceladoPor || data?.visibleToDrivers === false) {
                          alertedCanceledIds.current.add(rideId);
                          console.info('Corrida cancelada pelo passageiro - rideId:', rideId);
                          }
                        }
                      }
                  });
                } catch (e) {
                  // ignore
                }

                const arr: any[] = [];
                snapshot2.forEach(doc2 => {
                  const data = { id: doc2.id, ...doc2.data() } as any;
                  if (data.visibleToDrivers !== false) arr.push(data);
                });
                // ordenar localmente por createdAt desc
                arr.sort((a, b) => {
                  const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                  const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                  return tb - ta;
                });
                setSolicitacoes(arr);
              }, (err2) => {
                console.error('Erro no listener fallback:', err2);
              });
            } else {
              Alert.alert(
                'Firestore - Índice necessário',
                'A consulta que busca solicitações requereu um índice inesperado. Verifique o console para mais detalhes.\n\nErro: ' + msg
              );
            }
          }
        );
      } catch (errListener) {
        console.error('Falha ao registrar listener composto, registrando fallback:', errListener);
        const qSimple = query(
          collection(db, 'rides'),
          where('status', '==', 'buscando')
        );
        unsubscribe = onSnapshot(qSimple, (snapshot2) => {
          const arr: any[] = [];
          snapshot2.forEach(doc2 => {
            const data = { id: doc2.id, ...doc2.data() } as any;
            if (data.visibleToDrivers !== false) arr.push(data);
          });
          arr.sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return tb - ta;
          });
          setSolicitacoes(arr);
        }, (err2) => {
          console.error('Erro no listener fallback (catch):', err2);
        });
      }
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

      // calcula um preço inicial baseado na distância
      let precoReal = calculateEstimatedPrice(distanciaKm);

      // Verifica documento atual: se o passageiro já forneceu um preço, respeitamos esse valor
      try {
        const rideRef = doc(db, 'rides', solicitacao.id);
        const snap = await getDoc(rideRef);
        const current: any = snap.exists() ? snap.data() : {};

        if (current.userProvidedEstimatedPrice && typeof current.preçoEstimado === 'number') {
          precoReal = Number(current.preçoEstimado);
        } else {
          // Se passageiro não forneceu, tentamos calcular rota para incluir tempo (minutes)
          try {
            if (origem && destino && origem.latitude && destino.latitude) {
              const route = await unifiedLocationService.calculateRoute(
                { latitude: origem.latitude, longitude: origem.longitude } as any,
                { latitude: destino.latitude, longitude: destino.longitude } as any
              );
              if (route) {
                const distanceKmRoute = (route.distance || 0) / 1000;
                const minutesRoute = route.duration ? Math.max(0, Math.ceil(route.duration / 60)) : 0;
                const fare = calculateFare({ km: distanceKmRoute, minutes: minutesRoute, highDemand: false });
                precoReal = fare.total;
              }
            }
          } catch (routeErr) {
            console.warn('Erro ao calcular rota no aceitarCorrida (driver):', routeErr);
          }
        }
      } catch (e) {
        console.warn('Erro ao verificar doc da corrida ao aceitar:', e);
      }

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

      // Monta payload de atualização mantendo preço do passageiro quando presente
      const updatePayload: any = {
        status: 'aceita',
        motoristaId: user.uid,
        motoristaNome: user.nome,
        motoristaAvatar: motoristaAvatar,
        motoristaVeiculo: motoristaVeiculo,
        aceitaEm: new Date(),
        distanciaKm: distanciaKm,
      };

      try {
        const rideRef = doc(db, 'rides', solicitacao.id);
        const snap = await getDoc(rideRef);
        const current: any = snap.exists() ? snap.data() : {};
        if (!current.userProvidedEstimatedPrice) {
          updatePayload.preçoEstimado = precoReal;
        } else {
          updatePayload.preçoEstimado = current.preçoEstimado;
        }
      } catch (e) {
        // se houver erro ao ler, aplica o preco calculado localmente
        updatePayload.preçoEstimado = precoReal;
      }

      await updateDoc(doc(db, 'rides', solicitacao.id), updatePayload);

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
            // marca que estamos abrindo navegação externa para retornar depois
            try { await AsyncStorage.setItem(NAV_PENDING_KEY, JSON.stringify({ rideId: solicitacao.id, ts: Date.now() })); } catch (e) {}
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
      // limpa store local — logging out the user store will re-render App.tsx and
      // show the Auth flow. Do not attempt to navigate to a non-registered route.
      const { logout } = require('../../store/userStore').useUserStore.getState();
      logout();
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
          <Text style={styles.preco}>R$ {((solicitacao.preçoEstimado ?? solicitacao.preçoEstimado) ? Number(solicitacao.preçoEstimado ?? solicitacao.preçoEstimado).toFixed(2) : '0.00')}</Text>
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
    <View style={[styles.container, { backgroundColor: theme.whiteAreia }] }>
      <View style={[styles.header, { backgroundColor: theme.blueBahia }]}>
        <View style={styles.headerLeftRow}>
          <View style={styles.headerLeftTexts}>
            <Text style={[styles.title, { color: theme.whiteAreia }]}>Corridas Disponíveis</Text>
            <Text style={[styles.subtitle, { color: theme.whiteAreia }] }>
              {solicitacoes.length} solicitação(ões) pendente(s)
            </Text>
          </View>

          {/* Online/Offline moved to floating footer button */}
        </View>

        {/* header actions handled via navigation options (headerRight) */}
      </View>

      <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: footerBottom + 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {solicitacoes.length === 0 ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../../assets/logo-bahia-driver-azul.png')}
              style={[
                styles.emptyWatermarkImage,
                { width: watermarkWidth, height: watermarkHeight, tintColor: theme.blueBahia, opacity: 0.22, top: '100%' }
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

      {/* Floating footer button for Online/Offline */}
      <View pointerEvents="box-none" style={[styles.footerContainer, { bottom: footerBottom }] as any}>
        <Animated.View style={[styles.floatingWrapper, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }] as any}>
          <TouchableOpacity onPress={toggleOnline} style={[styles.floatingButton, { backgroundColor: theme.blueBahia, minWidth: floatingMinWidth }]} accessibilityLabel="ToggleOnline">
            <Text style={[styles.floatingButtonText, { color: theme.whiteAreia }]}>
              {isDriverOnline ? (floatingTextIndex === 0 ? 'Você está online' : 'Buscando viagens...') : 'Offline - tocar para ficar online'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia
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
    paddingVertical: 8,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    },
    aceitarButton: {
    backgroundColor: COLORS.blueBahia,
    borderRadius: 30,
    paddingVertical: 10,
  },
  rejeitarButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 30,
    paddingVertical: 10,
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
    alignSelf: 'center',
    opacity: 0.18,
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
  footerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 48,
    alignItems: 'center',
    zIndex: 50,
    elevation: 10,
    pointerEvents: 'box-none'
  },
  floatingWrapper: {
    // wrapper to apply animation
  },
  floatingButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
    minWidth: 220,
  },
  floatingButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center'
  },
});

export default HomeScreenMotorista;