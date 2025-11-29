import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore'; 
import { firestore } from '../../config/firebaseConfig';
import { Ride } from '../../types/RideTypes'; 
import { COLORS } from '../../theme/colors';
// ✨ CORREÇÃO APLICADA: Importa MapViewComponent E a interface MapMarker
import MapViewComponent, { MapMarker } from '../../components/common/MapViewComponent'; 
import { useUserStore } from '../../store/userStore';
import { startDriverLocationTracking, stopDriverLocationTracking } from '../../services/driverLocationService';
import { fetchUserProfile } from '../../services/userServices';
import { Linking } from 'react-native';
import { unifiedLocationService } from '../../services/unifiedLocationService';

// Tipagem de navegação para o Motorista
type DriverStackParamList = {
    HomeMotorista: undefined;
    RideAction: { rideId: string };
};

type Props = NativeStackScreenProps<DriverStackParamList, 'RideAction'>;

const RideActionScreen = (props: Props) => {
    const { navigation, route } = props;
    const { rideId } = route.params;
    const { user } = useUserStore();
    
    const [ride, setRide] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); 
    const [driverEtaMinutes, setDriverEtaMinutes] = useState<number | null>(null);

    // 1. Listener em tempo real para a corrida
    useEffect(() => {
        if (!rideId) return;

        const rideDocRef = doc(firestore, 'rides', rideId);
        
        const unsubscribe = onSnapshot(rideDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { ...docSnap.data(), rideId: docSnap.id } as Ride;
                setRide(data);

                // Se a corrida for cancelada, para o rastreamento e volta para a Home
                if (data.status === 'cancelada') {
                    stopDriverLocationTracking();
                    // Removido Alert para não incomodar o motorista; apenas volta para a Home
                    navigation.popToTop();
                }
                
                // Se a corrida finalizar, para o rastreamento e volta para a Home
                if (data.status === 'finalizada') {
                    stopDriverLocationTracking();
                    // Removido Alert para não incomodar o motorista; apenas volta para a Home
                    navigation.popToTop();
                }

                // Recalcular ETA quando motoristaLocalizacao mudar
                const driverLoc = data.motoristaLocalizacao;
                const originLoc = data.origem;
                if (driverLoc && originLoc) {
                    (async () => {
                        try {
                            const route = await unifiedLocationService.calculateRoute(driverLoc as any, originLoc as any);
                            if (route && route.duration) {
                                setDriverEtaMinutes(Math.ceil(route.duration / 60));
                            } else {
                                setDriverEtaMinutes(null);
                            }
                        } catch (e) {
                            console.error('Erro ao calcular ETA no RideAction:', e);
                        }
                    })();
                }

            } else {
                Alert.alert("Erro", "Corrida não encontrada.");
                navigation.goBack();
            }
            setLoading(false);
        }, (error) => {
            console.error("Erro ao ouvir detalhes da corrida:", error);
            Alert.alert("Erro", "Não foi possível carregar os detalhes da corrida.");
            navigation.goBack();
            setLoading(false);
        });

        // Limpeza: Garante que o listener e o rastreamento parem ao sair da tela
        return () => {
            unsubscribe();
            stopDriverLocationTracking();
        };

    }, [rideId, navigation]);

    // 2. Lógica para Aceitar a Corrida
    const handleAcceptRide = async () => {
        if (!ride || !user || !user.uid || ride.status !== 'pendente') {
            Alert.alert("Atenção", "Esta corrida não está mais disponível ou já foi aceita.");
            navigation.goBack();
            return;
        }

        setIsAccepting(true);
        try {
            const rideDocRef = doc(firestore, 'rides', rideId);
            
            // 2.1. Atualiza o status e adiciona os dados do motorista
                // Buscar avatar e dados do veículo para incluir na corrida
                let motoristaAvatar: string | null = null;
                let motoristaVeiculo: any = null;
                try {
                    const profile = await fetchUserProfile(user.uid);
                    if (profile) {
                        motoristaAvatar = (profile as any).avatarUrl || null;
                        motoristaVeiculo = (profile as any).motoristaData?.veiculo || null;
                    }
                } catch (err) {
                    console.warn('Falha ao buscar perfil do motorista:', err);
                }

                await updateDoc(rideDocRef, {
                    status: 'aceita',
                    motoristaId: user.uid,
                    motoristaNome: user.nome,
                    placaVeiculo: user.motoristaData?.placaVeiculo,
                    motoristaAvatar: motoristaAvatar,
                    motoristaVeiculo: motoristaVeiculo,
                });

            // 2.2. Inicia o rastreamento da localização ANTES de sair da tela
            await startDriverLocationTracking(rideId);

            // Abrir navegação externa para a origem (pickup)
            try {
                const lat = ride.origem?.latitude;
                const lon = ride.origem?.longitude;
                if (lat && lon) {
                    const wazeUrl = `waze://?ll=${lat},${lon}&navigate=yes`;
                    const googleMapsApp = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
                    const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

                    try {
                        const canWaze = await Linking.canOpenURL('waze://');
                        if (canWaze) {
                            await Linking.openURL(wazeUrl);
                        } else {
                            const canGoogle = await Linking.canOpenURL('comgooglemaps://');
                            if (canGoogle) await Linking.openURL(googleMapsApp);
                            else await Linking.openURL(googleMapsWeb);
                        }
                    } catch (e) {
                        await Linking.openURL(googleMapsWeb);
                    }
                }
            } catch (e) {
                console.warn('Erro ao abrir navegação externa:', e);
            }

        } catch (error) {
            console.error("Erro ao aceitar corrida:", error);
            Alert.alert("Erro", "Não foi possível aceitar a corrida. Tente novamente.");
        } finally {
            setIsAccepting(false);
        }
    };

    // 3. Lógica para Mudar o Status (Chegou, Iniciou, Finalizou)
    const handleUpdateStatus = async (newStatus: 'chegou' | 'em andamento' | 'finalizada') => {
        if (!ride) return;

        setIsUpdatingStatus(true);
        try {
            const rideDocRef = doc(firestore, 'rides', rideId);

            const updateData: any = { status: newStatus };

            // Adicionar timestamps apenas quando aplicável
            if (newStatus === 'chegou') {
                updateData.chegouEm = new Date().toISOString();
            }
            if (newStatus === 'em andamento') {
                updateData.horaInicio = new Date().toISOString();
            }
            if (newStatus === 'finalizada') {
                updateData.horaFim = new Date().toISOString();
            }

            await updateDoc(rideDocRef, updateData);

            // Removido Alert de status para o motorista — log para debug
            console.log(`Corrida marcada como: ${newStatus.toUpperCase()}.`);

        } catch (error) {
            console.error(`Erro ao mudar status para ${newStatus}:`, error);
            Alert.alert("Erro", `Não foi possível mudar o status para ${newStatus}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    // Cancela a corrida
    const handleCancelRide = async () => {
        Alert.alert(
            "Cancelar Corrida",
            "Tem certeza que deseja cancelar esta corrida?",
            [
                { text: "Não", style: 'cancel' },
                { 
                    text: "Sim, Cancelar", 
                    style: 'destructive', 
                    onPress: async () => {
                        try {
                            // Calcula reembolso baseado no status
                            let refundAmount = (ride as any).precoEstimado ?? (ride as any).preçoEstimado ?? 0;
                            let refundPercentage = 100; // reembolso total por padrão
                            
                            // Se já está em andamento, desconto de 50%
                            if (ride?.status === 'em andamento') {
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
                            stopDriverLocationTracking();
                            navigation.popToTop();
                        } catch (error) {
                            Alert.alert("Erro", "Não foi possível cancelar a corrida.");
                        }
                    }
                }
            ]
        );
    };
    
    // 4. Determina qual botão exibir (View Helper)
    const renderActionButton = () => {
        if (!ride) return null;
        
        if (ride.status === 'pendente') {
            return (
                <TouchableOpacity 
                    style={styles.acceptButton} 
                    onPress={handleAcceptRide}
                    disabled={isAccepting}
                >
                    {isAccepting ? (
                        <ActivityIndicator color={COLORS.whiteAreia} />
                    ) : (
                        <Text style={styles.acceptButtonText}>ACEITAR CORRIDA</Text>
                    )}
                </TouchableOpacity>
            );
        }

        if (ride.status === 'aceita') {
            return (
                <TouchableOpacity style={styles.nextActionButton} onPress={() => handleUpdateStatus('chegou')} disabled={isUpdatingStatus}>
                   <Text style={styles.nextActionButtonText}>CHEGUEI AO LOCAL DE BUSCA</Text>
                </TouchableOpacity>
            );
        }
        
        if (ride.status === 'chegou') {
            return (
                <TouchableOpacity style={styles.nextActionButton} onPress={() => handleUpdateStatus('em andamento')} disabled={isUpdatingStatus}>
                   <Text style={styles.nextActionButtonText}>INICIAR VIAGEM</Text>
                </TouchableOpacity>
            );
        }
        
        if (ride.status === 'em andamento') {
            return (
                         <TouchableOpacity style={[styles.nextActionButton, styles.finalizarButton]} onPress={() => handleUpdateStatus('finalizada')} disabled={isUpdatingStatus}>
                             <Text style={[styles.nextActionButtonText, styles.finalizarButtonText]}>FINALIZAR VIAGEM</Text>
                         </TouchableOpacity>
            );
        }
        
        return null;
    };


    if (loading || !ride) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Carregando detalhes da corrida...</Text>
            </View>
        );
    }

    // ✨ CORREÇÃO APLICADA: O array está explicitamente tipado com MapMarker[]
    const mapMarkers: MapMarker[] = [
        { id: 'origem', coords: ride.origem, title: 'Partida', color: "success" }, 
        { id: 'destino', coords: ride.destino, title: 'Destino', color: "danger" }, 
    ];
    
    const showRouteToOrigin = ride.status === 'aceita' || ride.status === 'chegou';
    const showFullRoute = ride.status === 'em andamento';

    const initialMapLocation = showRouteToOrigin ? ride.origem : ride.destino; 

    return (
        <View style={styles.container}>
            {/* 5. Mapa de Visualização da Rota */}
            <View style={styles.mapContainer}>
                <MapViewComponent
                    initialLocation={initialMapLocation}
                    markers={mapMarkers}
                    showRoute={showRouteToOrigin || showFullRoute}
                    // origin: rota de referência (quando o motorista não tiver localização ainda)
                    origin={ride.origem}
                    // destination: quando aceitou, destino é o ponto de busca (origem do passageiro)
                    destination={showRouteToOrigin ? ride.origem : ride.destino}
                    driverLocation={ride.motoristaLocalizacao}
                />
            </View>

            {/* Detalhes da Corrida */}
            <View style={styles.detailsContainer}>
                <Text style={styles.header}>Corrida Atual: {ride.status.toUpperCase()}</Text>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📍 Origem:</Text>
                    <Text style={styles.detailValue}>{ride.origem?.nome ?? (ride.origem?.latitude && ride.origem?.longitude ? `${Number(ride.origem.latitude).toFixed(5)}, ${Number(ride.origem.longitude).toFixed(5)}` : 'N/A')}</Text>
                </View>
                {driverEtaMinutes !== null && (
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>⏱️ Tempo até passageiro:</Text>
                        <Text style={styles.detailValue}>{driverEtaMinutes} min</Text>
                    </View>
                )}
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🏁 Destino:</Text>
                    <Text style={styles.detailValue}>{ride.destino?.nome ?? (ride.destino?.latitude && ride.destino?.longitude ? `${Number(ride.destino.latitude).toFixed(5)}, ${Number(ride.destino.longitude).toFixed(5)}` : 'N/A')}</Text>
                </View>
                <View style={[styles.detailRow, styles.priceRow]}>
                    <Text style={styles.priceLabel}>Valor Estimado:</Text>
                    <Text style={styles.priceValue}>R$ {((ride as any).precoEstimado ?? (ride as any).preçoEstimado ?? 0).toFixed(2)}</Text>
                </View>

                {/* 6. Ação Dinâmica */}
                <View style={styles.actionButtonContainer}>
                   {renderActionButton()}
                </View>

                {/* Botão Cancelar - aparece para qualquer status exceto finalizada ou cancelada */}
                {ride.status !== 'finalizada' && ride.status !== 'cancelada' && (
                    <TouchableOpacity 
                        style={styles.cancelButton} 
                        onPress={handleCancelRide}
                        disabled={isUpdatingStatus}
                    >
                        <Text style={styles.cancelButtonText}>Cancelar Corrida</Text>
                    </TouchableOpacity>
                )}

            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 10,
        color: COLORS.blueBahia,
    },
    mapContainer: {
        height: '50%',
        width: '100%',
    },
    detailsContainer: {
        flex: 1,
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 15,
        textAlign: 'center'
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
    },
    detailLabel: {
        fontSize: 16,
        color: COLORS.grayUrbano,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '600',
        color: COLORS.blackProfissional,
    },
    priceRow: {
        marginTop: 10,
        borderBottomWidth: 0,
        paddingVertical: 15,
    },
    priceLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
    },
    priceValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.success,
    },
    actionButtonContainer: {
        marginTop: 30,
    },
    acceptButton: {
        backgroundColor: COLORS.blueBahia,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    acceptButtonText: {
        color: COLORS.whiteAreia,
        fontSize: 18,
        fontWeight: 'bold',
    },
    nextActionButton: {
        backgroundColor: COLORS.yellowSol,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        width: '100%',
    },
    nextActionButtonText: {
        color: COLORS.blackProfissional,
        fontSize: 18,
        fontWeight: 'bold',
    },
    finalizarButton: {
        backgroundColor: '#00C853', // Verde vivo para finalizar
    },
    cancelButton: {
        backgroundColor: '#FF3B30', // Vermelho vivo para cancelar
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 15,
    },
    cancelButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 16,
    }
    ,
    finalizarButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    }
});

export default RideActionScreen;