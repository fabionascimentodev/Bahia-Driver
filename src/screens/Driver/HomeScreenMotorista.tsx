import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { Ride } from '../../types/RideTypes';
import { Ionicons } from '@expo/vector-icons';
import { logoutUser } from '../../services/userServices';
import { logger } from '../../services/loggerService';

// Tipagem de navegação
type DriverStackParamList = {
    HomeMotorista: undefined;
    RideAction: { rideId: string };
    Profile: undefined;
};

type Props = NativeStackScreenProps<DriverStackParamList, 'HomeMotorista'>;

const HomeScreenMotorista = (props: Props) => {
    const { navigation } = props;
    const { user, logout } = useUserStore();
    
    const [isOnline, setIsOnline] = useState(true); 
    const [pendingRides, setPendingRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    // ✅ FUNÇÃO DE LOGOUT ADICIONADA
    const handleLogout = async () => {
        Alert.alert(
            'Sair',
            'Tem certeza que deseja sair da sua conta?',
            [
                { 
                    text: 'Cancelar', 
                    style: 'cancel' 
                },
                { 
                    text: 'Sair', 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await logoutUser();
                            logout();
                            logger.success('HOME_MOTORISTA', 'Logout realizado com sucesso');
                        } catch (error) {
                            logger.error('HOME_MOTORISTA', 'Erro ao fazer logout', error);
                            Alert.alert('Erro', 'Não foi possível fazer logout.');
                        }
                    }
                }
            ]
        );
    };

    // Listener em tempo real para novas corridas pendentes
    useEffect(() => {
        if (!isOnline) {
            setPendingRides([]);
            setLoading(false);
            return;
        }

        const ridesRef = collection(firestore, 'rides');
        
        const q = query(
            ridesRef,
            where('status', '==', 'pendente')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const incomingRides: Ride[] = snapshot.docs.map(doc => ({
                ...doc.data(),
                rideId: doc.id
            })) as Ride[];
            
            incomingRides.sort((a, b) => a.dataCriacao.localeCompare(b.dataCriacao));
            
            setPendingRides(incomingRides);
            setLoading(false);

            if (incomingRides.length > 0 && !loading) {
                 const firstRide = incomingRides[0];
                 Alert.alert(
                    "Nova Corrida!",
                    `Origem: ${firstRide.origem.nome}\nDestino: ${firstRide.destino.nome}\nValor Estimado: R$ ${firstRide.preçoEstimado.toFixed(2)}`,
                    [
                        { 
                            text: "Ver Detalhes", 
                            onPress: () => navigation.navigate('RideAction', { rideId: firstRide.rideId }) 
                        },
                        { 
                            text: "Mais Tarde", 
                            style: 'cancel'
                        }
                    ]
                 );
            }
        }, (error) => {
            console.error("Erro ao ouvir corridas pendentes:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOnline, navigation, loading]);

    const handleToggleOnline = () => {
        setIsOnline(prev => !prev);
        Alert.alert(
            isOnline ? "Ficando Offline" : "Ficando Online", 
            isOnline ? "Você não receberá novas solicitações." : "Você está pronto para receber corridas!"
        );
    };
    
    const renderPendingRide = ({ item }: { item: Ride }) => (
        <TouchableOpacity 
            style={styles.rideCard}
            onPress={() => navigation.navigate('RideAction', { rideId: item.rideId })}
        >
            <View style={styles.rideInfo}>
                <Ionicons name="pin-outline" size={20} color={COLORS.blueBahia} />
                <Text style={styles.rideText} numberOfLines={1}>Partida: {item.origem.nome}</Text>
            </View>
            <View style={styles.rideInfo}>
                <Ionicons name="flag-outline" size={20} color={COLORS.blueBahia} />
                <Text style={styles.rideText} numberOfLines={1}>Destino: {item.destino.nome}</Text>
            </View>
            <View style={[styles.rideInfo, styles.priceRow]}>
                <Ionicons name="cash-outline" size={20} color={COLORS.success} />
                <Text style={styles.priceText}>R$ {item.preçoEstimado.toFixed(2)}</Text>
            </View>
            <Ionicons name="chevron-forward-outline" size={24} color={COLORS.grayUrbano} />
        </TouchableOpacity>
    );

    const userName = user?.nome || 'Motorista';
    const statusText = isOnline ? 'Online - Pronto para Corridas' : 'Offline';
    const statusColor = isOnline ? COLORS.success : COLORS.danger;

    return (
        <SafeAreaView style={styles.container}>
            {/* ✅ HEADER COM LOGOUT */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.welcomeText}>Bem-vindo(a), {userName}!</Text>
                    {user?.motoristaData?.veiculo && (
                        <Text style={styles.vehicleText}>
                            {user.motoristaData.veiculo.modelo} - {user.motoristaData.veiculo.placa}
                        </Text>
                    )}
                </View>
                
                {/* ✅ BOTÃO DE LOGOUT ADICIONADO */}
                <TouchableOpacity 
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Ionicons name="log-out-outline" size={24} color={COLORS.blueBahia} />
                </TouchableOpacity>
            </View>
            
            {/* Status Toggle */}
            <View style={styles.statusToggleContainer}>
                <Text style={styles.statusLabel}>Status Atual:</Text>
                <TouchableOpacity 
                    style={[styles.statusToggle, { backgroundColor: statusColor }]}
                    onPress={handleToggleOnline}
                >
                    <Text style={styles.statusToggleText}>{statusText}</Text>
                </TouchableOpacity>
            </View>
            
            {/* Lista de Corridas Pendentes */}
            <View style={styles.ridesListContainer}>
                <Text style={styles.listHeader}>Solicitações Pendentes ({pendingRides.length})</Text>
                
                {isOnline && loading ? (
                    <ActivityIndicator size="large" color={COLORS.blueBahia} style={{ marginTop: 20 }} />
                ) : !isOnline ? (
                    <Text style={styles.emptyListText}>Fique Online para receber solicitações.</Text>
                ) : pendingRides.length === 0 ? (
                    <Text style={styles.emptyListText}>Nenhuma corrida nova no momento. Aguardando...</Text>
                ) : (
                    <FlatList
                        data={pendingRides}
                        keyExtractor={item => item.rideId}
                        renderItem={renderPendingRide}
                        contentContainerStyle={styles.flatListContent}
                    />
                )}
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.grayClaro,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 15,
        backgroundColor: COLORS.whiteAreia,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
    },
    headerLeft: {
        flex: 1,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        marginBottom: 5,
    },
    vehicleText: {
        fontSize: 14,
        color: COLORS.blueBahia,
        fontWeight: '500',
    },
    logoutButton: {
        padding: 5,
        marginLeft: 10,
    },
    statusToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        backgroundColor: COLORS.whiteAreia,
        borderBottomWidth: 5,
        borderBottomColor: COLORS.grayClaro,
    },
    statusLabel: {
        fontSize: 16,
        color: COLORS.blackProfissional,
        fontWeight: '500',
    },
    statusToggle: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    statusToggleText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 14,
    },
    ridesListContainer: {
        flex: 1,
        paddingHorizontal: 10,
        paddingTop: 10,
    },
    listHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 10,
        paddingHorizontal: 5,
    },
    flatListContent: {
        paddingBottom: 20,
    },
    rideCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: COLORS.whiteAreia,
        padding: 15,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 5,
        borderLeftColor: COLORS.yellowSol,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    rideInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    rideText: {
        marginLeft: 8,
        fontSize: 14,
        color: COLORS.blackProfissional,
        flexShrink: 1,
    },
    priceRow: {
        flex: 0.5, 
        justifyContent: 'flex-end',
    },
    priceText: {
        marginLeft: 8,
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.success,
    },
    emptyListText: {
        textAlign: 'center',
        marginTop: 50,
        fontSize: 16,
        color: COLORS.grayUrbano,
        paddingHorizontal: 20,
    }
});

export default HomeScreenMotorista;