import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, Alert, TouchableOpacity, Image, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { Ride } from '../../types/RideTypes';
import MapViewComponent, { MapMarker } from '../../components/common/MapViewComponent'; // Importando MapMarker
import { Ionicons } from '@expo/vector-icons';
import { unifiedLocationService } from '../../services/unifiedLocationService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { useUserStore } from '../../store/userStore';
import { useWindowDimensions } from 'react-native';


// Tipagem de navegação para o Passageiro
type PassengerStackParamList = {
    HomePassageiro: undefined;
    RideTracking: { rideId: string };
    PostRide: { rideId: string };
    Chat: { rideId: string };
};

type Props = NativeStackScreenProps<PassengerStackParamList, 'RideTracking'>;

const RideTrackingScreen = (props: Props) => {
    const { route, navigation } = props;
    const { rideId } = route.params;
    const user = useUserStore(state => state.user);

    const [rideData, setRideData] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(true);
    const [driverEtaMinutes, setDriverEtaMinutes] = useState<number | null>(null);
    const dims = useWindowDimensions();
    const { footerBottom } = useResponsiveLayout();
    const borderAnim = useRef(new Animated.Value(2)).current;

    useEffect(() => {
        let anim: Animated.CompositeAnimation | null = null;
        if (rideData?.status === 'buscando') {
            borderAnim.setValue(2);
            anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(borderAnim, { toValue: 6, duration: 700, useNativeDriver: false }),
                    Animated.timing(borderAnim, { toValue: 2, duration: 700, useNativeDriver: false }),
                ])
            );
            anim.start();
        } else {
            // stop animation and reset
            borderAnim.setValue(2);
        }
        return () => { if (anim) anim.stop(); };
    }, [rideData?.status]);

    useEffect(() => {
        if (!rideId) return;

        const rideRef = doc(firestore, 'rides', rideId);

        // Listener em tempo real para o documento da corrida
        const unsubscribe = onSnapshot(rideRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { ...docSnap.data(), rideId: docSnap.id } as Ride;
                setRideData(data);
                
                // --- Lógica de Mudança de Tela ---
                if (data.status === 'finalizada') {
                    unsubscribe(); 
                    navigation.replace('PostRide', { rideId: rideId }); 
                }
                
                // Se a corrida for cancelada por qualquer parte
                if (data.status === 'cancelada') {
                    unsubscribe();
                    Alert.alert("Corrida Cancelada", "Sua corrida foi cancelada. Você será redirecionado para a tela inicial.");
                                        if (navigation && typeof navigation.popToTop === 'function') {
                                            navigation.popToTop();
                                        } else {
                                            console.debug('safePopToTop: popToTop not available on this navigator (RideTrackingScreen)');
                                        }
                }

            } else {
                Alert.alert("Erro", "Corrida não encontrada.");
                                if (navigation && typeof navigation.popToTop === 'function') {
                                    navigation.popToTop();
                                } else {
                                    console.debug('safePopToTop: popToTop not available on this navigator (RideTrackingScreen)');
                                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Erro ao ouvir a corrida:", error);
            Alert.alert("Erro", "Falha na conexão em tempo real.");
            setLoading(false);
                        if (navigation && typeof navigation.popToTop === 'function') {
                            navigation.popToTop();
                        } else {
                            console.debug('safePopToTop: popToTop not available on this navigator (RideTrackingScreen)');
                        }
        });

        return () => unsubscribe();
    }, [rideId, navigation]);
    
    // Recalcula ETA do motorista até a origem sempre que a localização do motorista mudar
    useEffect(() => {
        if (!rideData?.motoristaLocalizacao || !rideData?.origem) {
            setDriverEtaMinutes(null);
            return;
        }

        (async () => {
            try {
                const driverLoc = rideData.motoristaLocalizacao as any;
                const originLoc = rideData.origem as any;
                const route = await unifiedLocationService.calculateRoute(driverLoc, originLoc);
                if (route && route.duration) {
                    setDriverEtaMinutes(Math.ceil(route.duration / 60));
                } else {
                    setDriverEtaMinutes(null);
                }
            } catch (e) {
                console.error('Erro ao calcular ETA no RideTracking:', e);
                setDriverEtaMinutes(null);
            }
        })();
    }, [rideData?.motoristaLocalizacao?.latitude, rideData?.motoristaLocalizacao?.longitude, rideData?.origem?.latitude, rideData?.origem?.longitude]);
    // Cancela a corrida
    const handleCancelRide = async () => {
        Alert.alert(
            "Cancelar Corrida",
            "Tem certeza que deseja cancelar esta corrida? Pode haver taxas de cancelamento.",
            [
                { text: "Não", style: 'cancel' },
                { 
                    text: "Sim, Cancelar", 
                    style: 'destructive', 
                    onPress: async () => {
                        try {
                            // Calcula reembolso baseado no status
                            let refundAmount = (rideData as any).precoEstimado ?? (rideData as any).preçoEstimado ?? 0;
                            let refundPercentage = 100; // reembolso total por padrão
                            
                            // Se já está em andamento, desconto de 50%
                            if (rideData?.status === 'em andamento') {
                                refundPercentage = 50; // 50% de reembolso
                            }
                            
                            const finalRefund = Number((refundAmount * (refundPercentage / 100)).toFixed(2));

                            const rideRef = doc(firestore, 'rides', rideId);
                            await updateDoc(rideRef, {
                                status: 'cancelada',
                                canceladoPor: user?.uid,
                                canceladoEm: new Date().toISOString(),
                                refundAmount: finalRefund,
                                refundPercentage: refundPercentage
                            });
                        } catch (error) {
                            Alert.alert("Erro", "Não foi possível cancelar a corrida.");
                        }
                    }
                }
            ]
        );
    };

    if (loading || !rideData) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Aguardando confirmação do motorista...</Text>
            </View>
        );
    }
    
    // Determina o estado da UI baseado no status da corrida
    // ✅ Padronização para 'em andamento' e outros status
    const statusMessages: { [key: string]: { icon: string, text: string, color: string } } = {
        buscando: { icon: "time-outline", text: "Buscando Motorista...", color: COLORS.yellowSol },
        pendente: { icon: "time-outline", text: "Motoristas notificados.", color: COLORS.yellowSol },
        aceita: { icon: "car-sport-outline", text: "Motorista a caminho!", color: COLORS.success },
        chegou: { icon: "walk-outline", text: "Seu motorista chegou!", color: COLORS.success },
        'em andamento': { icon: "flag-outline", text: "Viagem em andamento.", color: COLORS.blueBahia },
    };

    const currentStatus = statusMessages[rideData.status] || { 
        icon: "help-circle-outline", 
        text: "Status Desconhecido", 
        color: COLORS.grayUrbano 
    };

    // Montar marcadores para o mapa
    // ✅ Usando MapMarker[] e passando a CHAVE da cor (string literal)
    let markers: MapMarker[] = [];
    if (rideData.origem) {
        markers.push({ id: 'origin', coords: rideData.origem, title: 'Partida', color: 'blueBahia' });
    }
    if (rideData.destino) {
        markers.push({ id: 'destination', coords: rideData.destino, title: 'Destino', color: 'yellowSol' });
    }
    // Adiciona o marcador do motorista se a localização estiver disponível
    if (rideData.motoristaLocalizacao) {
        markers.push({ 
            id: 'driver', 
            coords: rideData.motoristaLocalizacao, 
            title: 'Motorista', 
            color: 'danger', // Chave da cor
            icon: 'car-sport' 
        });
    }
    
    // Calcula se existem mensagens não lidas para o usuário atual
    const hasUnread = (() => {
        try {
            if (!user?.uid) return false;
            const lastMessageAtRaw = (rideData as any).lastMessageAt;
            if (!lastMessageAtRaw) return false;
            const lastMessageAt = lastMessageAtRaw?.toMillis ? lastMessageAtRaw.toMillis() : (lastMessageAtRaw instanceof Date ? lastMessageAtRaw.getTime() : new Date(lastMessageAtRaw).getTime());
            const lastReadMap = (rideData as any).lastRead || {};
            const myLastReadRaw = lastReadMap[user.uid];
            const myLastRead = myLastReadRaw?.toMillis ? myLastReadRaw.toMillis() : myLastReadRaw ? new Date(myLastReadRaw).getTime() : null;
            const lastSender = (rideData as any).lastMessageSenderId;
            if (!myLastRead) return lastMessageAt && lastSender !== user.uid;
            return lastMessageAt > myLastRead && lastSender !== user.uid;
        } catch (e) {
            return false;
        }
    })();

    return (
        <SafeAreaView style={styles.container}>
            
            <View style={[styles.mapArea, { height: Math.min(dims.height * 0.55, 560) }]}>
                <MapViewComponent 
                    initialLocation={rideData.origem}
                    markers={markers}
                    // Mostrar rota apenas se a corrida foi aceita ou está em andamento/chegou
                    showRoute={rideData.status !== 'buscando' && rideData.status !== 'pendente'}
                    origin={rideData.origem}
                    destination={rideData.destino}
                    driverLocation={rideData.motoristaLocalizacao} 
                />
            </View>

            <View style={[styles.infoPanel, { paddingBottom: footerBottom + 20 }]}>
                {
                    (() => {
                        const isSearching = rideData.status === 'buscando';
                        const effectiveColor = isSearching ? COLORS.blueBahia : currentStatus.color;
                        return (
                            <Animated.View style={[styles.statusBox, { borderColor: effectiveColor, borderWidth: borderAnim } as any]}>
                                <Ionicons name={currentStatus.icon as any} size={24} color={effectiveColor} />
                                <Text style={[styles.statusText, { color: effectiveColor }]}>
                                    {currentStatus.text}
                                </Text>
                            </Animated.View>
                        );
                    })()
                }

                {rideData.motoristaNome && (
                                            <View style={[styles.driverBlock, dims.width < 380 ? styles.driverBlockSmall : null]}>
                                    {rideData.motoristaAvatar ? (
                                        <Image source={{ uri: rideData.motoristaAvatar }} style={styles.driverAvatar} />
                                    ) : null}
                                    <Text style={styles.driverInfo}>
                                        Motorista: <Text style={styles.driverName}>{rideData.motoristaNome}</Text>
                                        {rideData.motoristaVeiculo?.placa && ` - Placa: ${rideData.motoristaVeiculo.placa || rideData.placaVeiculo}`}
                                    </Text>
                                    {rideData.motoristaVeiculo ? (
                                        <Text style={styles.vehicleInfo}>
                                            {rideData.motoristaVeiculo.modelo ? `Marca/Modelo: ${rideData.motoristaVeiculo.modelo} • ` : ''}
                                            {rideData.motoristaVeiculo.cor ? `Cor: ${rideData.motoristaVeiculo.cor} • ` : ''}
                                            {rideData.motoristaVeiculo.ano ? `Ano: ${rideData.motoristaVeiculo.ano}` : ''}
                                        </Text>
                                    ) : null}
                                                {/* Botão de Chat com indicador de nova mensagem */}
                                                <TouchableOpacity style={styles.chatButton} onPress={() => {
                                                    navigation.navigate('Chat', { rideId });
                                                }}>
                                                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.whiteAreia} />
                                                    <Text style={styles.chatButtonText}>Chat</Text>
                                                    {hasUnread ? <View style={styles.unreadDot} /> : null}
                                                </TouchableOpacity>
                                            </View>
                )}
                {driverEtaMinutes !== null && (
                    <View style={styles.detailRow}
                    >
                        <Text style={styles.detailLabel}>⏱️ Tempo estimado do motorista:</Text>
                        <Text style={[styles.detailValue, { textAlign: 'right' }]}>{driverEtaMinutes} min</Text>
                    </View>
                )}
                
                <Text style={styles.priceText}>
                    Valor Estimado: <Text style={styles.priceValue}>R$ {(((rideData as any).precoEstimado ?? (rideData as any).preçoEstimado) ? Number((rideData as any).precoEstimado ?? (rideData as any).preçoEstimado).toFixed(2) : '0.00')}</Text>
                </Text>

                {/* Botão de Cancelamento aparece em todos os status exceto finalizada/cancelada */}
                {rideData.status !== 'finalizada' && rideData.status !== 'cancelada' && (
                    <TouchableOpacity 
                        style={styles.cancelButton} 
                        onPress={handleCancelRide}
                        disabled={loading}
                    >
                        <Text style={styles.cancelButtonText}>Cancelar Corrida</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.whiteAreia,
    },
    loadingText: {
        marginTop: 10,
        color: COLORS.blueBahia,
    },
    mapArea: {
        flex: 1,
    },
    infoPanel: {
        padding: 20,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        shadowColor: COLORS.blackProfissional,
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 8,
    },
    statusBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
        marginBottom: 15,
        borderWidth: 2,
        borderRadius: 8,
        backgroundColor: COLORS.whiteAreia,
    },
    statusText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    },
    driverInfo: {
        fontSize: 16,
        color: COLORS.blackProfissional,
        marginBottom: 8,
        textAlign: 'center',
    },
    driverName: {
        fontWeight: 'bold',
    },
    priceText: {
        fontSize: 16,
        color: COLORS.blackProfissional,
        textAlign: 'center',
        marginBottom: 20,
    },
    priceValue: {
        fontWeight: 'bold',
        color: COLORS.success,
        fontSize: 18,
    },
    cancelButton: {
        backgroundColor: COLORS.danger,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 16,
    }
    ,
    driverBlock: {
        alignItems: 'center',
        marginBottom: 8,
    },
    driverAvatar: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: 8,
    },
    vehicleInfo: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        textAlign: 'center',
        marginTop: 6,
    }
    ,
    chatButton: {
        marginTop: 10,
        backgroundColor: COLORS.blueBahia,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center'
    },
    chatButtonText: {
        color: COLORS.whiteAreia,
        marginLeft: 8,
        fontWeight: '700'
    }
    ,
    unreadDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#00C853',
        marginLeft: 8,
        borderWidth: 2,
        borderColor: '#fff'
    },
    driverBlockSmall: {
        flexDirection: 'column',
        alignItems: 'center'
    }
    ,
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
        marginTop: 8,
    },
    detailLabel: {
        fontSize: 16,
        color: COLORS.grayUrbano,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.blackProfissional,
    }
});

export default RideTrackingScreen;