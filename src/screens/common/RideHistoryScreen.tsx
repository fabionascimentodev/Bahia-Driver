import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';
import { query, where, getDocs, collection } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { Ride } from '../../types/RideTypes';
import RideHistoryCard from '../../components/common/RideHistoryCard'; 
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

// Tipagem para props, caso a tela seja chamada de diferentes stacks
type HistoryScreenProps = {};

const RideHistoryScreen = (props: HistoryScreenProps) => {
    const { user } = useUserStore();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true); 

    // Assume-se que 'tipoUsuario' existe no objeto 'user'
    const userId = user?.uid;
    const userRole = user?.perfil; // Assumindo que 'perfil' armazena 'passageiro' ou 'motorista'

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchRides = async () => {
            setLoading(true);
            try {
                const ridesRef = collection(firestore, 'rides');
                const completedStatuses = ['finalizada', 'cancelada'];
                
                // 1. QUERY: Corridas onde o usuário é o PASSAGEIRO (e o status é finalizado/cancelado)
                const qPassenger = query(
                    ridesRef,
                    where('passageiroId', '==', userId),
                    where('status', 'in', completedStatuses)
                );

                // 2. QUERY: Corridas onde o usuário é o MOTORISTA (e o status é finalizado/cancelado)
                const qDriver = query(
                    ridesRef,
                    where('motoristaId', '==', userId),
                    where('status', 'in', completedStatuses)
                );

                // Executa as duas consultas em paralelo para otimizar o tempo de carregamento
                const [snapshotPassenger, snapshotDriver] = await Promise.all([
                    getDocs(qPassenger),
                    getDocs(qDriver)
                ]);

                // Mescla os resultados em um Map para garantir que não haja duplicatas e facilitar o processamento
                const allRidesMap = new Map<string, Ride>();
                
                snapshotPassenger.docs.forEach(doc => {
                    const ride = { ...doc.data(), rideId: doc.id } as Ride;
                    allRidesMap.set(doc.id, ride);
                });
                
                snapshotDriver.docs.forEach(doc => {
                    const ride = { ...doc.data(), rideId: doc.id } as Ride;
                    allRidesMap.set(doc.id, ride);
                });
                
                const fetchedRides = Array.from(allRidesMap.values());
                
                // Ordenação opcional em memória (pode ser substituída por orderBy no Firestore se necessário)
                // fetchedRides.sort((a, b) => new Date(b.dataCriacao).getTime() - new Date(a.dataCriacao).getTime());

                setRides(fetchedRides);
                setHasMore(false); // No MVP, assumimos que pegamos tudo
                
            } catch (error) {
                console.error("Erro ao buscar histórico de corridas:", error);
                // Aqui você pode definir um estado de erro se necessário
            } finally {
                setLoading(false);
            }
        };

        fetchRides();
    }, [userId]);

    if (!userId) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Usuário não autenticado.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Carregando histórico...</Text>
            </View>
        );
    }

    if (rides.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>Nenhuma corrida encontrada no seu histórico.</Text>
            </View>
        );
    }

    // 2. Renderiza a lista de corridas
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Seu Histórico de Viagens</Text>
            </View>
            <FlatList
                data={rides}
                keyExtractor={(item) => item.rideId}
                renderItem={({ item }) => (
                    <RideHistoryCard 
                        ride={item} 
                        isDriver={userRole === 'motorista'}
                    />
                )}
                contentContainerStyle={[styles.listContent, { paddingBottom: useResponsiveLayout().footerBottom + 20 }]}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.grayClaro,
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
    errorText: {
        color: COLORS.danger,
        fontSize: 18,
    },
    emptyText: {
        fontSize: 18,
        color: COLORS.grayUrbano,
    },
    header: {
        backgroundColor: COLORS.whiteAreia,
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 10,
        paddingVertical: 10,
    }
});

export default RideHistoryScreen;