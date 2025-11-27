import React, { useState, useEffect } from 'react';
import { 
    View, 
    Text, 
    StyleSheet, 
    SafeAreaView, 
    Alert, 
    ActivityIndicator, 
    Dimensions,
    TouchableOpacity,
    Modal,
    FlatList,
    TextInput
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import MapViewComponent, { MapMarker } from '../../components/common/MapViewComponent'; 
import RideRequestModal from '../../components/Passenger/RideRequestModal';
import { COLORS } from '../../theme/colors';
import { Coords, getCurrentLocation, requestLocationPermission } from '../../services/locationServices';
import { createRideRequest } from '../../services/rideService';
import { RideCoords } from '../../types/RideTypes';
import { useUserStore } from '../../store/userStore';

type PassengerStackParamList = {
    HomePassageiro: undefined;
    RideTracking: { rideId: string };
    PostRide: { rideId: string };
};

type Props = NativeStackScreenProps<PassengerStackParamList, 'HomePassageiro'>;

const { height: screenHeight } = Dimensions.get('window');

interface PlaceResult {
    id: string;
    name: string;
    address: string;
    coords: Coords;
}

const HomeScreenPassageiro = (props: Props) => {
    const { navigation } = props;
    const user = useUserStore(state => state.user);
    
    const [initialLocation, setInitialLocation] = useState<Coords | null>(null);
    const [origin, setOrigin] = useState<RideCoords | null>(null);
    const [destination, setDestination] = useState<RideCoords | null>(null);
    const [loadingLocation, setLoadingLocation] = useState(true);
    const [rideModalVisible, setRideModalVisible] = useState(false);
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchType, setSearchType] = useState<'origin' | 'destination'>('destination');
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [updatingLocation, setUpdatingLocation] = useState(false);
    
    const simulatedPrice = 15.50;
    const simulatedDistanceKm = 5.2;

    useEffect(() => {
        fetchCurrentLocation();
    }, []);

    const fetchCurrentLocation = async () => {
        try {
            setLoadingLocation(true);
            await requestLocationPermission();
            const loc = await getCurrentLocation();
            
            if (loc) {
                setInitialLocation(loc);
                setOrigin({ 
                    latitude: loc.latitude, 
                    longitude: loc.longitude, 
                    nome: 'Minha Localização Atual' 
                });
            } else {
                Alert.alert("Erro de Localização", "Não foi possível obter sua localização.");
            }
        } catch (error) {
            console.error("Erro ao obter localização:", error);
            Alert.alert("Erro de Permissão", "Permissão de localização é necessária.");
        } finally {
            setLoadingLocation(false);
        }
    };

    const handleUpdateCurrentLocation = async () => {
        try {
            setUpdatingLocation(true);
            await requestLocationPermission();
            const loc = await getCurrentLocation();
            
            if (loc) {
                setInitialLocation(loc);
                setOrigin({ 
                    latitude: loc.latitude, 
                    longitude: loc.longitude, 
                    nome: 'Minha Localização Atual' 
                });
                Alert.alert("Sucesso", "Localização atualizada!");
            } else {
                Alert.alert("Erro", "Não foi possível atualizar a localização.");
            }
        } catch (error) {
            console.error("Erro ao atualizar localização:", error);
            Alert.alert("Erro", "Falha ao atualizar localização.");
        } finally {
            setUpdatingLocation(false);
        }
    };

    // Busca lugares automaticamente quando o texto muda
    useEffect(() => {
        if (searchText.trim().length > 2) {
            searchPlaces(searchText);
        } else {
            setSearchResults([]);
        }
    }, [searchText]);

    const searchPlaces = async (query: string) => {
        if (!initialLocation) return;
        
        setLoadingSearch(true);
        try {
            // ✅ SUBSTITUA SUA_API_KEY_AQUI PELA CHAVE REAL DO GOOGLE CLOUD
            const API_KEY = 'AIzaSyCZVxpbP1k_mtPt52fPKE2SKapEZ-E-Xpg'; // ← COLOCAR SUA CHAVE AQUI
            
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${API_KEY}&language=pt-BR&region=br&location=${initialLocation.latitude},${initialLocation.longitude}&radius=50000`
            );
            
            const data = await response.json();
            
            if (data.status === 'OK') {
                // Para cada place_id, buscar os detalhes completos
                const placesWithDetails = await Promise.all(
                    data.predictions.slice(0, 8).map(async (prediction: any) => {
                        try {
                            const detailsResponse = await fetch(
                                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${API_KEY}&language=pt-BR`
                            );
                            const detailsData = await detailsResponse.json();
                            
                            if (detailsData.status === 'OK') {
                                const place = detailsData.result;
                                return {
                                    id: prediction.place_id,
                                    name: prediction.structured_formatting.main_text,
                                    address: prediction.structured_formatting.secondary_text || place.formatted_address || 'Endereço não disponível',
                                    coords: {
                                        latitude: place.geometry.location.lat,
                                        longitude: place.geometry.location.lng
                                    }
                                };
                            }
                        } catch (error) {
                            console.error('Erro ao buscar detalhes do lugar:', error);
                        }
                        return null;
                    })
                );
                
                const validPlaces = placesWithDetails.filter(place => place !== null) as PlaceResult[];
                setSearchResults(validPlaces);
            } else {
                console.log('Status da API:', data.status);
                setSearchResults([]);
            }
        } catch (error) {
            console.error('Erro na busca de lugares:', error);
            Alert.alert("Erro", "Falha na busca de lugares. Verifique sua conexão e API Key.");
            setSearchResults([]);
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleRequestRide = async () => {
        if (!user?.uid || !user?.nome || !origin || !destination) { 
            Alert.alert("Erro", "Selecione origem e destino para solicitar a corrida.");
            return;
        }

        try {
            const rideId = await createRideRequest(
                user.uid,
                user.nome,
                origin,
                destination,
                simulatedPrice,
                simulatedDistanceKm
            );

            Alert.alert("Sucesso", "Corrida solicitada! Buscando motoristas...");
            navigation.navigate('RideTracking', { rideId: rideId });

        } catch (error) {
            console.error("Erro ao solicitar corrida:", error);
            Alert.alert("Erro", "Não foi possível solicitar a corrida. Tente novamente.");
        } finally {
            setRideModalVisible(false);
        }
    };

    const handlePlaceSelect = (place: PlaceResult) => {
        const rideCoords: RideCoords = {
            latitude: place.coords.latitude,
            longitude: place.coords.longitude,
            nome: place.name
        };

        if (searchType === 'origin') {
            setOrigin(rideCoords);
        } else {
            setDestination(rideCoords);
        }

        setSearchModalVisible(false);
        setSearchText('');
        setSearchResults([]);
        
        if (searchType === 'destination' && origin) {
            setTimeout(() => setRideModalVisible(true), 500);
        }
    };

    const openSearchModal = (type: 'origin' | 'destination') => {
        setSearchType(type);
        setSearchModalVisible(true);
        setSearchText('');
        setSearchResults([]);
    };

    const clearDestination = () => {
        setDestination(null);
    };

    const clearOrigin = () => {
        if (initialLocation) {
            setOrigin({ 
                latitude: initialLocation.latitude, 
                longitude: initialLocation.longitude, 
                nome: 'Minha Localização Atual' 
            });
        }
    };

    if (loadingLocation || !initialLocation) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Carregando sua localização...</Text>
            </View>
        );
    }
    
    const markers: MapMarker[] = [];
    if (origin) {
        markers.push({ id: 'origin', coords: origin, title: 'Partida', color: 'blueBahia' });
    }
    if (destination) {
        markers.push({ id: 'destination', coords: destination, title: 'Destino', color: 'yellowSol' });
    }

    return (
        <View style={styles.container}>
            {/* Mapa */}
            <View style={styles.mapContainer}>
                <MapViewComponent 
                    initialLocation={initialLocation}
                    markers={markers}
                    showRoute={!!(origin && destination)}
                    origin={origin}
                    destination={destination}
                />
            </View>

            {/* Header */}
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <Text style={styles.welcomeText}>Olá, {user?.nome || 'Passageiro'}!</Text>
                    <Text style={styles.subtitle}>Para onde vamos?</Text>
                </View>
            </SafeAreaView>

            {/* Painel de Busca FIXO */}
            <View style={styles.searchPanel}>
                
                {/* Origem - CLICÁVEL */}
                <TouchableOpacity 
                    style={styles.locationCard}
                    onPress={() => openSearchModal('origin')}
                >
                    <TouchableOpacity 
                        style={[styles.iconContainer, styles.originIcon]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleUpdateCurrentLocation();
                        }}
                    >
                        {updatingLocation ? (
                            <ActivityIndicator size="small" color={COLORS.blueBahia} />
                        ) : (
                            <Ionicons name="navigate" size={18} color={COLORS.blueBahia} />
                        )}
                    </TouchableOpacity>
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>Partida</Text>
                        <Text style={styles.locationText} numberOfLines={1}>
                            {origin?.nome || 'Selecionar local de partida'}
                        </Text>
                    </View>
                    {origin?.nome !== 'Minha Localização Atual' ? (
                        <TouchableOpacity onPress={clearOrigin} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={18} color={COLORS.grayUrbano} />
                        </TouchableOpacity>
                    ) : (
                        <Ionicons name="chevron-forward" size={16} color={COLORS.grayUrbano} />
                    )}
                </TouchableOpacity>

                {/* Destino - CLICÁVEL */}
                <TouchableOpacity 
                    style={styles.locationCard}
                    onPress={() => openSearchModal('destination')}
                >
                    <View style={[styles.iconContainer, styles.destinationIcon]}>
                        <Ionicons name="location" size={18} color={COLORS.yellowSol} />
                    </View>
                    <View style={styles.locationInfo}>
                        <Text style={styles.locationLabel}>Destino</Text>
                        <Text style={styles.locationText} numberOfLines={1}>
                            {destination?.nome || 'Para onde você vai?'}
                        </Text>
                    </View>
                    {destination ? (
                        <TouchableOpacity onPress={clearDestination} style={styles.clearButton}>
                            <Ionicons name="close-circle" size={18} color={COLORS.grayUrbano} />
                        </TouchableOpacity>
                    ) : (
                        <Ionicons name="chevron-forward" size={16} color={COLORS.grayUrbano} />
                    )}
                </TouchableOpacity>

                {/* BOTÃO SOLICITAR CORRIDA */}
                {origin && destination && (
                    <TouchableOpacity 
                        style={styles.requestButton}
                        onPress={() => setRideModalVisible(true)}
                    >
                        <Ionicons name="car-sport" size={24} color={COLORS.whiteAreia} />
                        <Text style={styles.requestButtonText}>Solicitar Corrida</Text>
                        <View style={styles.priceBadge}>
                            <Text style={styles.priceText}>R$ {simulatedPrice.toFixed(2)}</Text>
                        </View>
                    </TouchableOpacity>
                )}

                {/* Instrução quando não tem destino */}
                {!destination && (
                    <Text style={styles.instructionText}>
                        Toque no destino para escolher para onde vai
                    </Text>
                )}
            </View>

            {/* Modal de Busca com Autocomplete */}
            <Modal
                visible={searchModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <SafeAreaView style={styles.searchModalContainer}>
                    <View style={styles.searchModalHeader}>
                        <Text style={styles.searchModalTitle}>
                            {searchType === 'origin' ? 'Escolher Partida' : 'Escolher Destino'}
                        </Text>
                        <TouchableOpacity 
                            style={styles.closeButton}
                            onPress={() => setSearchModalVisible(false)}
                        >
                            <Ionicons name="close" size={24} color={COLORS.blackProfissional} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={20} color={COLORS.grayUrbano} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={`Digite ${searchType === 'origin' ? 'sua partida' : 'seu destino'}...`}
                            value={searchText}
                            onChangeText={setSearchText}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                        {loadingSearch && (
                            <ActivityIndicator size="small" color={COLORS.blueBahia} />
                        )}
                    </View>

                    {searchResults.length === 0 && searchText.length > 2 && !loadingSearch && (
                        <View style={styles.noResultsContainer}>
                            <Ionicons name="location-outline" size={48} color={COLORS.grayUrbano} />
                            <Text style={styles.noResultsText}>Nenhum local encontrado</Text>
                            <Text style={styles.noResultsSubtext}>Verifique sua API Key do Google Places</Text>
                        </View>
                    )}

                    {searchText.length < 3 && (
                        <View style={styles.tipContainer}>
                            <Ionicons name="information-circle" size={20} color={COLORS.blueBahia} />
                            <Text style={styles.tipText}>Digite pelo menos 3 caracteres para buscar</Text>
                        </View>
                    )}

                    <FlatList
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity 
                                style={styles.placeItem}
                                onPress={() => handlePlaceSelect(item)}
                            >
                                <View style={styles.placeIcon}>
                                    <Ionicons 
                                        name="location" 
                                        size={20} 
                                        color={searchType === 'origin' ? COLORS.blueBahia : COLORS.yellowSol} 
                                    />
                                </View>
                                <View style={styles.placeInfo}>
                                    <Text style={styles.placeName}>{item.name}</Text>
                                    <Text style={styles.placeAddress}>{item.address}</Text>
                                </View>
                            </TouchableOpacity>
                        )}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    />
                </SafeAreaView>
            </Modal>

            {/* Modal de Confirmação da Corrida */}
            <RideRequestModal
                isVisible={rideModalVisible}
                onCancelRequest={() => setRideModalVisible(false)}
                onConfirm={handleRequestRide}
                origin={origin}
                destination={destination}
                price={simulatedPrice}
                distanceKm={simulatedDistanceKm}
            />
        </View>
    );
};

// Os styles permanecem os mesmos do código anterior...
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
        fontSize: 16,
    },
    mapContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    headerSafeArea: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.whiteAreia,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.whiteAreia,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
        marginTop: 4,
    },
    searchPanel: {
        position: 'absolute',
        bottom: 20,
        left: 16,
        right: 16,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
        maxHeight: screenHeight * 0.4,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.grayClaro,
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    originIcon: {
        backgroundColor: 'rgba(0, 82, 155, 0.1)',
    },
    destinationIcon: {
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
    },
    locationInfo: {
        flex: 1,
    },
    locationLabel: {
        fontSize: 12,
        color: COLORS.grayUrbano,
        marginBottom: 2,
    },
    locationText: {
        fontSize: 16,
        color: COLORS.blackProfissional,
        fontWeight: '500',
    },
    clearButton: {
        padding: 4,
    },
    requestButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.blueBahia,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginTop: 8,
        justifyContent: 'center',
        gap: 12,
    },
    requestButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    },
    priceBadge: {
        backgroundColor: COLORS.yellowSol,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    priceText: {
        color: COLORS.blackProfissional,
        fontWeight: 'bold',
        fontSize: 14,
    },
    instructionText: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    searchModalContainer: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    searchModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
    },
    searchModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
    },
    closeButton: {
        padding: 4,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.grayClaro,
        margin: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: COLORS.blackProfissional,
        marginLeft: 12,
        marginRight: 8,
    },
    placeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
    },
    placeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 82, 155, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    placeInfo: {
        flex: 1,
    },
    placeName: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.blackProfissional,
        marginBottom: 2,
    },
    placeAddress: {
        fontSize: 14,
        color: COLORS.grayUrbano,
    },
    noResultsContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    noResultsText: {
        fontSize: 18,
        color: COLORS.grayUrbano,
        marginTop: 16,
        fontWeight: '500',
    },
    noResultsSubtext: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        marginTop: 8,
    },
    tipContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: 'rgba(0, 82, 155, 0.05)',
        margin: 20,
        borderRadius: 12,
        gap: 8,
    },
    tipText: {
        fontSize: 14,
        color: COLORS.blueBahia,
        fontWeight: '500',
    },
});

export default HomeScreenPassageiro;