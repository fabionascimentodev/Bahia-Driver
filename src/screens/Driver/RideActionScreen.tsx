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
                    Alert.alert("Atenção", "A corrida foi cancelada pelo passageiro.");
                    navigation.popToTop();
                }
                
                // Se a corrida finalizar, para o rastreamento e volta para a Home
                if (data.status === 'finalizada') {
                    stopDriverLocationTracking();
                    Alert.alert("Sucesso", "Corrida finalizada. Você está online para a próxima.");
                    navigation.popToTop();
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
            await updateDoc(rideDocRef, {
                status: 'aceita',
                motoristaId: user.uid,
                motoristaNome: user.nome, 
                placaVeiculo: user.motoristaData?.placaVeiculo, 
            });

            // 2.2. Inicia o rastreamento da localização
            startDriverLocationTracking(rideId); 

        } catch (error) {
            console.error("Erro ao aceitar corrida:", error);
            Alert.alert("Erro", "Não foi possível aceitar a corrida. Tente novamente.");
        } finally {
            setIsAccepting(false);
        }
    };

    // 3. Lógica para Mudar o Status (Chegou, Iniciou, Finalizou)
    const handleUpdateStatus = async (newStatus: 'chegou' | 'iniciada' | 'finalizada') => {
        if (!ride) return;
        
        setIsUpdatingStatus(true);
        try {
            const rideDocRef = doc(firestore, 'rides', rideId);
            await updateDoc(rideDocRef, {
                status: newStatus,
                // Adiciona um timestamp para o cálculo de preços no final
                [newStatus === 'iniciada' ? 'horaInicio' : 'horaFim']: newStatus === 'finalizada' ? new Date().toISOString() : undefined,
                
            });
            
            Alert.alert("Status Atualizado", `Corrida marcada como: ${newStatus.toUpperCase()}.`);

        } catch (error) {
            console.error(`Erro ao mudar status para ${newStatus}:`, error);
            Alert.alert("Erro", `Não foi possível mudar o status para ${newStatus}.`);
        } finally {
            setIsUpdatingStatus(false);
        }
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
                <TouchableOpacity style={styles.nextActionButton} onPress={() => handleUpdateStatus('iniciada')} disabled={isUpdatingStatus}>
                   <Text style={styles.nextActionButtonText}>INICIAR VIAGEM</Text>
                </TouchableOpacity>
            );
        }
        
        if (ride.status === 'em andamento') {
            return (
                <TouchableOpacity style={[styles.nextActionButton, styles.finalizarButton]} onPress={() => handleUpdateStatus('finalizada')} disabled={isUpdatingStatus}>
                   <Text style={styles.nextActionButtonText}>FINALIZAR VIAGEM</Text>
                </TouchableOpacity>
            );
        }
        
        return <Text style={styles.statusCompletedText}>Aguardando confirmação do servidor...</Text>
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
                    
                    origin={ride.origem}
                    
                    destination={showRouteToOrigin ? ride.origem : ride.destino} 
                    
                    driverLocation={ride.motoristaLocalizacao}
                />
            </View>

            {/* Detalhes da Corrida */}
            <View style={styles.detailsContainer}>
                <Text style={styles.header}>Corrida Atual: {ride.status.toUpperCase()}</Text>

                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📍 Origem:</Text>
                    <Text style={styles.detailValue}>{ride.origem.nome}</Text>
                </View>
                <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🏁 Destino:</Text>
                    <Text style={styles.detailValue}>{ride.destino.nome}</Text>
                </View>
                <View style={[styles.detailRow, styles.priceRow]}>
                    <Text style={styles.priceLabel}>Valor Estimado:</Text>
                    <Text style={styles.priceValue}>R$ {ride.preçoEstimado.toFixed(2)}</Text>
                </View>

                {/* 6. Ação Dinâmica */}
                <View style={styles.actionButtonContainer}>
                   {renderActionButton()}
                </View>

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
        backgroundColor: COLORS.danger, // Usar uma cor de destaque para finalizar
    },
    statusCompletedText: {
        textAlign: 'center',
        fontSize: 16,
        color: COLORS.grayUrbano,
    }
});

export default RideActionScreen;