import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { Ride } from '../../types/RideTypes';
import { Ionicons } from '@expo/vector-icons';

// Tipagem de navegação
type DriverStackParamList = {
    HomeMotorista: undefined;
    RideAction: { rideId: string };
    Profile: undefined; // Adicionamos Profile à navegação
};

type Props = NativeStackScreenProps<DriverStackParamList, 'HomeMotorista'>;

const HomeScreenMotorista = (props: Props) => {
    const { navigation } = props;
    const { user } = useUserStore();
    
    // Novo estado para a disponibilidade do motorista (simulado)
    const [isOnline, setIsOnline] = useState(true); 
    const [pendingRides, setPendingRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Listener em tempo real para novas corridas pendentes
    useEffect(() => {
        // Se estiver offline, limpa a lista e para de escutar
        if (!isOnline) {
            setPendingRides([]);
            setLoading(false);
            return;
        }

        const ridesRef = collection(firestore, 'rides');
        
        // Busca corridas com status 'pendente'
        const q = query(
            ridesRef,
            where('status', '==', 'pendente')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const incomingRides: Ride[] = snapshot.docs.map(doc => ({
                ...doc.data(),
                rideId: doc.id
            })) as Ride[];
            
            // Corridas mais antigas (mais urgentes) primeiro
            incomingRides.sort((a, b) => a.dataCriacao.localeCompare(b.dataCriacao));
            
            setPendingRides(incomingRides);
            setLoading(false);

            // Simulação de Notificação/Alerta para a primeira corrida
            if (incomingRides.length > 0 && !loading) {
                 const firstRide = incomingRides[0];
                 Alert.alert(
                    "Nova Corrida!",
                    `Origem: ${firstRide.origem.nome}\nDestino: ${firstRide.destino.nome}\nValor Estimado: R$ ${firstRide.preçoEstimado.toFixed(2)}`,
                    [{ text: "Ver Detalhes", onPress: () => navigation.navigate('RideAction', { rideId: firstRide.rideId }) },
                     { text: "Mais Tarde", style: 'cancel'}]
                 );
            }
        }, (error) => {
            console.error("Erro ao ouvir corridas pendentes:", error);
            setLoading(false);
        });

        return () => unsubscribe(); // Para o listener ao sair da tela ou mudar o status
    }, [isOnline, navigation, loading]);

    // 2. Lógica para mudar o status (Online/Offline)
    const handleToggleOnline = () => {
        // Em um sistema real, isso atualizaria o status no Firestore e notificaria os passageiros (opcional)
        setIsOnline(prev => !prev);
        Alert.alert(
            isOnline ? "Ficando Offline" : "Ficando Online", 
            isOnline ? "Você não receberá novas solicitações." : "Você está pronto para receber corridas!"
        );
    };
    
    // 3. Renderiza o item da corrida pendente
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
            <View style={styles.header}>
                <Text style={styles.welcomeText}>Bem-vindo(a), {userName}!</Text>
                <TouchableOpacity onPress={() => navigation.navigate('Profile' as any)} style={styles.profileButton}>
                    <Ionicons name="person-circle-outline" size={30} color={COLORS.blueBahia} />
                </TouchableOpacity>
            </View>
            
            {/* 4. Toggle de Status */}
            <View style={styles.statusToggleContainer}>
                <Text style={styles.statusLabel}>Status Atual:</Text>
                <TouchableOpacity 
                    style={[styles.statusToggle, { backgroundColor: statusColor }]}
                    onPress={handleToggleOnline}
                >
                    <Text style={styles.statusToggleText}>{statusText}</Text>
                </TouchableOpacity>
            </View>
            
            {/* 5. Lista de Corridas Pendentes */}
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
        alignItems: 'center',
        padding: 15,
        backgroundColor: COLORS.whiteAreia,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
    },
    welcomeText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
    },
    profileButton: {
        // Estilização do botão de perfil (ícone)
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
    },
    statusToggle: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    statusToggleText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
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
    }
});

export default HomeScreenMotorista;