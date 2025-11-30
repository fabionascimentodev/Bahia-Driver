import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { Ride } from '../../types/RideTypes';
import { COLORS } from '../../theme/colors';
import MapViewComponent, { MapMarker } from '../../components/common/MapViewComponent';
import { useUserStore } from '../../store/userStore';
import { startDriverLocationTracking, stopDriverLocationTracking } from '../../services/driverLocationService';
import { motoristaAceitarCorrida } from '../../services/rideService';
import { Linking, useWindowDimensions } from 'react-native';
import { unifiedLocationService } from '../../services/unifiedLocationService';
import { Ionicons } from '@expo/vector-icons';

type DriverStackParamList = {
    HomeMotorista: undefined;
    RideAction: { rideId: string };
    Chat: { rideId: string };
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
    const dims = useWindowDimensions();

    useEffect(() => {
        if (!rideId) return;

        const rideDocRef = doc(firestore, 'rides', rideId);
        const unsubscribe = onSnapshot(rideDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = { ...docSnap.data(), rideId: docSnap.id } as Ride;
                setRide(data);

                if (data.status === 'cancelada') {
                    stopDriverLocationTracking();
                    if (navigation && typeof navigation.popToTop === 'function') {
                        navigation.popToTop();
                    } else {
                        console.debug('safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)');
                    }
                }

                const driverLoc = data.motoristaLocalizacao;
                const originLoc = data.origem;
                if (driverLoc && originLoc) {
                    (async () => {
                        try {
                            const routeInfo = await unifiedLocationService.calculateRoute(driverLoc as any, originLoc as any);
                            if (routeInfo && routeInfo.duration) setDriverEtaMinutes(Math.ceil(routeInfo.duration / 60));
                            else setDriverEtaMinutes(null);
                        } catch (e) {
                            console.error('Erro ao calcular ETA no RideAction:', e);
                        }
                    })();
                }
            } else {
                Alert.alert('Erro', 'Corrida não encontrada.');
                navigation.goBack();
            }
            setLoading(false);
        }, (error) => {
            console.error('Erro ao ouvir detalhes da corrida:', error);
            Alert.alert('Erro', 'Não foi possível carregar os detalhes da corrida.');
            navigation.goBack();
            setLoading(false);
        });

        return () => {
            unsubscribe();
            stopDriverLocationTracking();
        };
    }, [rideId, navigation]);

    const handleAcceptRide = async () => {
        if (!ride || !user || !user.uid || ride.status !== 'pendente') {
            Alert.alert('Atenção', 'Esta corrida não está mais disponível ou já foi aceita.');
            navigation.goBack();
            return;
        }

        setIsAccepting(true);
        try {
            const result = await motoristaAceitarCorrida(rideId, user.uid, user.nome, user.motoristaData?.placaVeiculo || '');
            if (!result.success) {
                Alert.alert('Corrida indisponível', result.error || 'Outro motorista aceitou esta corrida antes de você.');
                                if (navigation && typeof navigation.popToTop === 'function') {
                                    navigation.popToTop();
                                } else {
                                    console.debug('safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)');
                                }
                return;
            }

            await startDriverLocationTracking(rideId);

            try {
                const lat = ride.origem?.latitude;
                const lon = ride.origem?.longitude;
                if (lat && lon) {
                    const wazeUrl = `waze://?ll=${lat},${lon}&navigate=yes`;
                    const googleMapsApp = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
                    const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

                    try {
                        const canWaze = await Linking.canOpenURL('waze://');
                        if (canWaze) await Linking.openURL(wazeUrl);
                        else {
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
            console.error('Erro ao aceitar corrida:', error);
            Alert.alert('Erro', 'Não foi possível aceitar a corrida. Tente novamente.');
        } finally {
            setIsAccepting(false);
        }
    };

    const handleUpdateStatus = async (newStatus: 'chegou' | 'em andamento' | 'finalizada') => {
        if (!ride) return;

        setIsUpdatingStatus(true);
        try {
            const rideDocRef = doc(firestore, 'rides', rideId);
            const updateData: any = { status: newStatus };
            if (newStatus === 'chegou') updateData.chegouEm = new Date().toISOString();
            if (newStatus === 'em andamento') updateData.horaInicio = new Date().toISOString();
            if (newStatus === 'finalizada') updateData.horaFim = new Date().toISOString();
            await updateDoc(rideDocRef, updateData);
            // Após marcar finalizada, navegar para tela de avaliação do passageiro
            if (newStatus === 'finalizada') {
                navigation.navigate('DriverPostRide', { rideId });
            }
            console.log(`Corrida marcada como: ${newStatus.toUpperCase()}.`);
        } catch (error) {
            console.error(`Erro ao mudar status para ${newStatus}:`, error);
            Alert.alert('Erro', `Não foi possível mudar o status para ${newStatus}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCancelRide = async () => {
        Alert.alert('Cancelar Corrida', 'Tem certeza que deseja cancelar esta corrida?', [
            { text: 'Não', style: 'cancel' },
            { text: 'Sim, Cancelar', style: 'destructive', onPress: async () => {
                try {
                    let refundAmount = (ride as any).precoEstimado ?? (ride as any).preçoEstimado ?? 0;
                    let refundPercentage = 100;
                    if (ride?.status === 'em andamento') refundPercentage = 50;
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
                                        if (navigation && typeof navigation.popToTop === 'function') {
                                            navigation.popToTop();
                                        } else {
                                            console.debug('safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)');
                                        }
                } catch (error) {
                    Alert.alert('Erro', 'Não foi possível cancelar a corrida.');
                }
            }}
        ]);
    };

    const renderActionButton = () => {
        if (!ride) return null;
        if (ride.status === 'pendente') return (
            <TouchableOpacity style={styles.acceptButton} onPress={handleAcceptRide} disabled={isAccepting}>
                {isAccepting ? <ActivityIndicator color={COLORS.whiteAreia} /> : <Text style={styles.acceptButtonText}>ACEITAR CORRIDA</Text>}
            </TouchableOpacity>
        );
        if (ride.status === 'aceita') return (
            <TouchableOpacity style={styles.nextActionButton} onPress={() => handleUpdateStatus('chegou')} disabled={isUpdatingStatus}>
                <Text style={styles.nextActionButtonText}>CHEGUEI AO LOCAL DE BUSCA</Text>
            </TouchableOpacity>
        );
        if (ride.status === 'chegou') return (
            <TouchableOpacity style={styles.nextActionButton} onPress={() => handleUpdateStatus('em andamento')} disabled={isUpdatingStatus}>
                <Text style={styles.nextActionButtonText}>INICIAR VIAGEM</Text>
            </TouchableOpacity>
        );
        if (ride.status === 'em andamento') return (
            <TouchableOpacity style={[styles.nextActionButton, styles.finalizarButton]} onPress={() => handleUpdateStatus('finalizada')} disabled={isUpdatingStatus}>
                <Text style={[styles.nextActionButtonText, styles.finalizarButtonText]}>FINALIZAR VIAGEM</Text>
            </TouchableOpacity>
        );
        return null;
    };

    if (loading || !ride) return (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color={COLORS.blueBahia} /><Text style={styles.loadingText}>Carregando detalhes da corrida...</Text></View>
    );

    const mapMarkers: MapMarker[] = [
        { id: 'origem', coords: ride.origem, title: 'Partida', color: 'success' },
        { id: 'destino', coords: ride.destino, title: 'Destino', color: 'danger' },
    ];

    const showRouteToOrigin = ride.status === 'aceita' || ride.status === 'chegou';
    const showFullRoute = ride.status === 'em andamento';
    const initialMapLocation = showRouteToOrigin ? ride.origem : ride.destino;

    const hasUnread = (() => {
        try {
            if (!user?.uid) return false;
            const lastMessageAtRaw = (ride as any).lastMessageAt;
            if (!lastMessageAtRaw) return false;
            const lastMessageAt = lastMessageAtRaw?.toMillis ? lastMessageAtRaw.toMillis() : (lastMessageAtRaw instanceof Date ? lastMessageAtRaw.getTime() : new Date(lastMessageAtRaw).getTime());
            const lastReadMap = (ride as any).lastRead || {};
            const myLastReadRaw = lastReadMap[user.uid];
            const myLastRead = myLastReadRaw?.toMillis ? myLastReadRaw.toMillis() : myLastReadRaw ? new Date(myLastReadRaw).getTime() : null;
            const lastSender = (ride as any).lastMessageSenderId;
            if (!myLastRead) return lastMessageAt && lastSender !== user.uid;
            return lastMessageAt > myLastRead && lastSender !== user.uid;
        } catch (e) {
            return false;
        }
    })();

    return (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                <MapViewComponent initialLocation={initialMapLocation} markers={mapMarkers} showRoute={showRouteToOrigin || showFullRoute} origin={ride.origem} destination={showRouteToOrigin ? ride.origem : ride.destino} driverLocation={ride.motoristaLocalizacao} />
            </View>
            <View style={styles.detailsContainer}>
                <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }, dims.width < 380 ? { flexDirection: 'column', alignItems: 'flex-start' } : null]}>
                    <Text style={styles.header} numberOfLines={1} ellipsizeMode="tail">Corrida Atual: {ride.status.toUpperCase()}</Text>
                    <TouchableOpacity style={styles.chatButtonDriver} onPress={() => navigation.navigate('Chat', { rideId })} accessibilityLabel="Abrir chat">
                        <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.whiteAreia} />
                        <Text style={styles.chatButtonText}>Chat</Text>
                        {hasUnread ? <View style={styles.unreadDot} /> : null}
                    </TouchableOpacity>
                </View>

                <View style={styles.detailRow}><Text style={styles.detailLabel}>📍 Origem:</Text><Text style={styles.detailValue}>{ride.origem?.nome ?? (ride.origem?.latitude && ride.origem?.longitude ? `${Number(ride.origem.latitude).toFixed(5)}, ${Number(ride.origem.longitude).toFixed(5)}` : 'N/A')}</Text></View>

                {driverEtaMinutes !== null && (<View style={styles.detailRow}><Text style={styles.detailLabel}>⏱️ Tempo até passageiro:</Text><Text style={styles.detailValue}>{driverEtaMinutes} min</Text></View>)}

                <View style={styles.detailRow}><Text style={styles.detailLabel}>🏁 Destino:</Text><Text style={styles.detailValue}>{ride.destino?.nome ?? (ride.destino?.latitude && ride.destino?.longitude ? `${Number(ride.destino.latitude).toFixed(5)}, ${Number(ride.destino.longitude).toFixed(5)}` : 'N/A')}</Text></View>

                <View style={[styles.detailRow, styles.priceRow]}><Text style={styles.priceLabel}>Valor Estimado:</Text><Text style={styles.priceValue}>R$ {((ride as any).precoEstimado ?? (ride as any).preçoEstimado ?? 0).toFixed(2)}</Text></View>

                <View style={styles.actionButtonContainer}>{renderActionButton()}</View>

                {ride.status !== 'finalizada' && ride.status !== 'cancelada' && (
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancelRide} disabled={isUpdatingStatus}><Text style={styles.cancelButtonText}>Cancelar Corrida</Text></TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.whiteAreia },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: 10, color: COLORS.blueBahia },
    mapContainer: { height: '50%', width: '100%' },
    detailsContainer: { flex: 1, padding: 20, backgroundColor: COLORS.whiteAreia },
    header: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: 'bold', color: COLORS.blueBahia, marginBottom: 15, textAlign: 'center' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.grayClaro },
    detailLabel: { fontSize: 16, color: COLORS.grayUrbano },
    detailValue: { fontSize: 16, fontWeight: '600', color: COLORS.blackProfissional },
    priceRow: { marginTop: 10, borderBottomWidth: 0, paddingVertical: 15 },
    priceLabel: { fontSize: 18, fontWeight: 'bold', color: COLORS.blackProfissional },
    priceValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.success },
    actionButtonContainer: { marginTop: 30 },
    acceptButton: { backgroundColor: COLORS.blueBahia, padding: 15, borderRadius: 8, alignItems: 'center' },
    acceptButtonText: { color: COLORS.whiteAreia, fontSize: 18, fontWeight: 'bold' },
    nextActionButton: { backgroundColor: COLORS.yellowSol, padding: 15, borderRadius: 8, alignItems: 'center', width: '100%' },
    nextActionButtonText: { color: COLORS.blackProfissional, fontSize: 18, fontWeight: 'bold' },
    finalizarButton: { backgroundColor: '#00C853' },
    cancelButton: { backgroundColor: '#FF3B30', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 15 },
    cancelButtonText: { color: COLORS.whiteAreia, fontWeight: 'bold', fontSize: 16 },
    chatButtonDriver: { backgroundColor: COLORS.blueBahia, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center', flexShrink: 0, maxWidth: 120 },
    chatButtonText: { color: COLORS.whiteAreia, marginLeft: 8, fontWeight: '700' },
    unreadDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#00C853', marginLeft: 8, borderWidth: 2, borderColor: '#fff' },
    finalizarButtonText: { color: COLORS.whiteAreia, fontWeight: 'bold', fontSize: 18 },
});

export default RideActionScreen;