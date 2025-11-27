import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapViewComponent, { MapMarker } from '../../components/common/MapViewComponent'; 
import LocationSearchInput from '../../components/common/LocationSearchInput';
import RideRequestModal from '../../components/Passenger/RideRequestModal';
import { COLORS } from '../../theme/colors';
import { Coords, getCurrentLocation, requestLocationPermission } from '../../services/locationServices';
import { createRideRequest } from '../../services/rideService';
import { RideCoords } from '../../types/RideTypes';
import { useUserStore } from '../../store/userStore';

// Tipagem de navegação para o Passageiro
type PassengerStackParamList = {
    HomePassageiro: undefined;
    RideTracking: { rideId: string };
    PostRide: { rideId: string };
};

type Props = NativeStackScreenProps<PassengerStackParamList, 'HomePassageiro'>;

const HomeScreenPassageiro = (props: Props) => {
    const { navigation } = props;
    const user = useUserStore(state => state.user); // Assumindo que 'user' tem 'uid' e 'nome'
    
    const [initialLocation, setInitialLocation] = useState<Coords | null>(null);
    const [origin, setOrigin] = useState<RideCoords | null>(null);
    const [destination, setDestination] = useState<RideCoords | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    
    // Simulação: Preço e Distância
    const simulatedPrice = 15.50; // R$ 15,50
    const simulatedDistanceKm = 5.2; // 5.2 km

    useEffect(() => {
        const fetchLocation = async () => {
            try {
                await requestLocationPermission();
                const loc = await getCurrentLocation();
                
                if (loc) {
                    setInitialLocation(loc);
                    // Define a origem inicial para a localização atual
                    setOrigin({ 
                        latitude: loc.latitude, 
                        longitude: loc.longitude, 
                        nome: 'Localização Atual' 
                    });
                } else {
                    Alert.alert("Erro de Localização", "Não foi possível obter sua localização. Verifique as permissões.");
                }
            } catch (error) {
                console.error("Erro ao obter localização:", error);
                Alert.alert("Erro de Permissão", "Permissão de localização é necessária para usar o app.");
            } finally {
                setLoadingLocation(true);
            }
        };
        fetchLocation();
    }, []);

    // Função principal para solicitar a corrida
    const handleRequestRide = async () => {
        // Validação adicional para o nome
        if (!user?.uid || !user?.nome || !origin || !destination) { 
            Alert.alert("Erro", "Dados de usuário ou localização incompletos.");
            return;
        }

        try {
            // Chama a função de serviço para criar a requisição no Firestore
            const rideId = await createRideRequest(
                user.uid,
                user.nome, // ✅ ARGUMENTO 2: Adicionado o nome do passageiro
                origin,
                destination,
                simulatedPrice,
                simulatedDistanceKm
            );

            Alert.alert("Sucesso", "Corrida solicitada! Buscando motoristas...");
            
            // Navega para a tela de acompanhamento
            navigation.navigate('RideTracking', { rideId: rideId });

        } catch (error) {
            console.error("Erro ao solicitar corrida:", error);
            Alert.alert("Erro", "Não foi possível solicitar a corrida. Tente novamente.");
        } finally {
            setModalVisible(false); // Fecha o modal
        }
    };
    
    const handleDestinationSelect = (coords: RideCoords) => {
        setDestination(coords);
        setModalVisible(true);
    };

    if (loadingLocation || !initialLocation) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Carregando sua localização...</Text>
            </View>
        );
    }
    
    // Tipando explicitamente o array markers
    const markers: MapMarker[] = [];
    
    if (origin) {
        markers.push({ id: 'origin', coords: origin, title: 'Partida', color: 'blueBahia' });
    }
    if (destination) {
        markers.push({ id: 'destination', coords: destination, title: 'Destino', color: 'yellowSol' });
    }

    return (
        <SafeAreaView style={styles.container}>
            
            {/* Mapa (Ocupa a maior parte da tela) */}
            <View style={styles.mapArea}>
                <MapViewComponent 
                    initialLocation={initialLocation}
                    markers={markers}
                    // Quando o destino é selecionado, o mapa pode focar na rota
                    showRoute={!!(origin && destination)}
                    origin={origin}
                    destination={destination}
                />
            </View>

            {/* Painel de Busca (Flutuante na parte inferior) */}
            <View style={styles.searchPanel}>
                <Text style={styles.promptText}>Para onde vamos hoje?</Text>
                
                {/* Input de Origem (Exibindo localização atual) */}
                <View style={styles.locationRow}>
                    <Ionicons name="navigate-circle" size={24} color={COLORS.blueBahia} />
                    <Text style={styles.originText}>{origin?.nome || 'Localização Atual'}</Text>
                </View>

                {/* Input de Destino */}
                <LocationSearchInput 
                    placeholder="Seu destino..."
                    onSelectLocation={handleDestinationSelect}
                />
            </View>
            
            {/* Modal de Confirmação da Corrida */}
            <RideRequestModal
                isVisible={modalVisible}
                onCancelRequest={() => setModalVisible(false)}
                onConfirm={handleRequestRide}
                origin={origin}
                destination={destination}
                price={simulatedPrice}
                distanceKm={simulatedDistanceKm}
            />

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
    searchPanel: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        shadowColor: COLORS.blackProfissional,
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 8,
    },
    promptText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        marginBottom: 15,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.grayClaro,
        padding: 10,
        borderRadius: 8,
        marginBottom: 15,
    },
    originText: {
        marginLeft: 10,
        fontSize: 16,
        color: COLORS.blackProfissional,
        fontWeight: '500',
    }
});

export default HomeScreenPassageiro;