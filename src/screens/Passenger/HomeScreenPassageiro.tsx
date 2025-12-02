import React, { useState, useEffect, useLayoutEffect } from "react";
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import MapViewComponent, {
  MapMarker,
} from "../../components/common/MapViewComponent";
import RideRequestModal from "../../components/Passenger/RideRequestModal";
import { COLORS } from "../../theme/colors";
import {
  Coords,
  getCurrentLocation,
  requestLocationPermission,
} from "../../services/locationServices";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { unifiedLocationService } from "../../services/unifiedLocationService";
import { createRideRequest } from "../../services/rideService";
import { RideCoords } from "../../types/RideTypes";
import { useUserStore } from "../../store/userStore";
import useResponsiveLayout from "../../hooks/useResponsiveLayout";

type PassengerStackParamList = {
  HomePassageiro: undefined;
  RideTracking: { rideId: string };
  PostRide: { rideId: string };
  PassengerProfile: { userId?: string } | undefined;
};

type Props = NativeStackScreenProps<PassengerStackParamList, "HomePassageiro">;

const { height: screenHeight } = Dimensions.get("window");

interface PlaceResult {
  id: string;
  name: string;
  address: string;
  coords: Coords;
}

const HomeScreenPassageiro: React.FC<Props> = (props) => {
  const { navigation } = props;
  const user = useUserStore((state) => state.user);
  const theme = COLORS;

  const [initialLocation, setInitialLocation] = useState<Coords | null>(null);
  const [origin, setOrigin] = useState<RideCoords | null>(null);
  const [destination, setDestination] = useState<RideCoords | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [rideModalVisible, setRideModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchType, setSearchType] = useState<"origin" | "destination">(
    "destination"
  );
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [estimatedPrice, setEstimatedPrice] = useState(0);
  const [estimatedDistanceKm, setEstimatedDistanceKm] = useState(0);
  const [isRequesting, setIsRequesting] = useState(false);
  const { footerBottom } = useResponsiveLayout();

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("PassengerProfile")}
          style={{ marginLeft: 1, padding: 6 }}
          accessibilityLabel="Perfil"
        >
          <Ionicons name="person-circle" size={22} color={theme.whiteAreia} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Sair",
              "Tem certeza que deseja sair da sua conta?",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Sair",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      const {
                        logoutUser,
                      } = require("../../services/userServices");
                      await logoutUser();
                      const { logout } =
                        require("../../store/userStore").useUserStore.getState();
                      logout();
                    } catch (e) {
                      Alert.alert("Erro", "Não foi possível sair.");
                    }
                  },
                },
              ],
              { cancelable: true }
            );
          }}
          style={{ marginRight: 0, padding: 6 }}
          accessibilityLabel="Logout"
        >
          <Ionicons name="log-out" size={20} color={theme.whiteAreia} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View style={{ alignItems: "center", paddingVertical: 2 }}>
          <Text style={[styles.welcomeText, { color: theme.whiteAreia }]}>
            Olá, {user?.nome || "Passageiro"}!
          </Text>
          <Text style={[styles.subtitle, { color: theme.whiteAreia }]}>
            Para onde vamos?
          </Text>
        </View>
      ),
    });
  }, [navigation, user?.nome]);

  // Ao focar na tela, verificar se devemos limpar origem/destino (após finalização de corrida)
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", async () => {
      try {
        const flag = await AsyncStorage.getItem(
          "@bahia_driver_clear_locations"
        );
        if (flag) {
          setOrigin(null);
          setDestination(null);
          setEstimatedDistanceKm(0);
          setEstimatedPrice(0);
          await AsyncStorage.removeItem("@bahia_driver_clear_locations");
        }
      } catch (e) {
        // ignore
      }
    });

    return unsubscribe;
  }, [navigation]);

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
          nome: "Minha Localização Atual",
        });
      } else {
        Alert.alert(
          "Erro de Localização",
          "Não foi possível obter sua localização."
        );
      }
    } catch (error) {
      console.error("Erro ao obter localização:", error);
      Alert.alert(
        "Erro de Permissão",
        "Permissão de localização é necessária."
      );
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
          nome: "Minha Localização Atual",
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

  const searchRequestIdRef = React.useRef(0);
  useEffect(() => {
    const q = searchText.trim();
    if (q.length === 0) {
      setSearchResults([]);
      setLoadingSearch(false);
      return;
    }

    const localResults = searchWithLocalData(q);
    setSearchResults(localResults.slice(0, 8));

    if (q.length < 3) {
      setLoadingSearch(false);
      return;
    }

    const myRequestId = ++searchRequestIdRef.current;
    setLoadingSearch(true);

    (async () => {
      try {
        const remoteResults: PlaceResult[] =
          await unifiedLocationService.searchPlaces(
            q,
            initialLocation || undefined
          );
        if (myRequestId !== searchRequestIdRef.current) return;

        const merged: PlaceResult[] = [...localResults];
        remoteResults.forEach((r) => {
          const exists = merged.some(
            (m) =>
              (m.address && r.address && m.address === r.address) ||
              m.name === r.name
          );
          if (!exists) merged.push(r);
        });

        setSearchResults(merged.slice(0, 8));
      } catch (err) {
        console.warn("Erro na busca remota de lugares:", err);
      } finally {
        if (myRequestId === searchRequestIdRef.current) setLoadingSearch(false);
      }
    })();
  }, [searchText, initialLocation]);

  const searchWithLocalData = (query: string): PlaceResult[] => {
    const salvadorPlaces: (PlaceResult & { keywords: string[] })[] = [
      {
        id: "aeroporto",
        name: "Aeroporto Internacional de Salvador",
        address:
          "Aeroporto Internacional Deputado Luís Eduardo Magalhães, Salvador, BA",
        keywords: [
          "aeroporto",
          "aeroport",
          "airport",
          "aviação",
          "voos",
          "aero",
        ],
        coords: {
          latitude: initialLocation ? initialLocation.latitude + 0.015 : -12.91,
          longitude: initialLocation
            ? initialLocation.longitude + 0.015
            : -38.331,
          timestamp: Date.now(),
        },
      },
      {
        id: "shopping-salvador",
        name: "Shopping Salvador",
        address: "Avenida Tancredo Neves, Caminho das Árvores, Salvador, BA",
        keywords: ["shopping", "shop", "mall", "centro comercial", "lojas"],
        coords: {
          latitude: initialLocation ? initialLocation.latitude - 0.01 : -12.978,
          longitude: initialLocation
            ? initialLocation.longitude - 0.01
            : -38.46,
          timestamp: Date.now(),
        },
      },
      {
        id: "pelourinho",
        name: "Pelourinho - Centro Histórico",
        address: "Pelourinho, Centro Histórico, Salvador, BA",
        keywords: [
          "pelourinho",
          "centro histórico",
          "histórico",
          "pelô",
          "centro",
        ],
        coords: {
          latitude: initialLocation ? initialLocation.latitude + 0.02 : -12.973,
          longitude: initialLocation
            ? initialLocation.longitude + 0.02
            : -38.508,
          timestamp: Date.now(),
        },
      },
      {
        id: "praia-porto-barra",
        name: "Praia do Porto da Barra",
        address: "Porto da Barra, Salvador, BA",
        keywords: [
          "praia",
          "porto da barra",
          "porto",
          "barra",
          "praias",
          "mar",
        ],
        coords: {
          latitude: initialLocation ? initialLocation.latitude - 0.02 : -13.01,
          longitude: initialLocation
            ? initialLocation.longitude - 0.02
            : -38.532,
          timestamp: Date.now(),
        },
      },
      {
        id: "farol-barra",
        name: "Farol da Barra",
        address: "Farol da Barra, Salvador, BA",
        keywords: ["farol", "barra", "farol da barra", "lighthouse"],
        coords: {
          latitude: initialLocation ? initialLocation.latitude - 0.018 : -13.01,
          longitude: initialLocation
            ? initialLocation.longitude - 0.018
            : -38.531,
          timestamp: Date.now(),
        },
      },
      {
        id: "mercado-modelo",
        name: "Mercado Modelo",
        address: "Mercado Modelo, Comércio, Salvador, BA",
        keywords: [
          "mercado",
          "modelo",
          "mercado modelo",
          "artesanato",
          "comércio",
        ],
        coords: {
          latitude: initialLocation ? initialLocation.latitude + 0.025 : -12.97,
          longitude: initialLocation
            ? initialLocation.longitude + 0.025
            : -38.512,
          timestamp: Date.now(),
        },
      },
      {
        id: "igreja-bonfim",
        name: "Igreja do Bonfim",
        address: "Igreja do Bonfim, Bonfim, Salvador, BA",
        keywords: [
          "igreja",
          "bonfim",
          "igreja do bonfim",
          "santo",
          "religioso",
        ],
        coords: {
          latitude: initialLocation ? initialLocation.latitude + 0.03 : -12.92,
          longitude: initialLocation
            ? initialLocation.longitude + 0.03
            : -38.508,
          timestamp: Date.now(),
        },
      },
      {
        id: "dique-tororo",
        name: "Dique do Tororó",
        address: "Dique do Tororó, Salvador, BA",
        keywords: ["dique", "tororó", "lago", "orixás", "estátuas"],
        coords: {
          latitude: initialLocation ? initialLocation.latitude + 0.012 : -12.99,
          longitude: initialLocation
            ? initialLocation.longitude + 0.012
            : -38.505,
          timestamp: Date.now(),
        },
      },
      {
        id: "lacerda-elevator",
        name: "Elevador Lacerda",
        address: "Elevador Lacerda, Praça Municipal, Salvador, BA",
        keywords: ["elevador", "lacerda", "elevador lacerda", "cartão postal"],
        coords: {
          latitude: initialLocation
            ? initialLocation.latitude + 0.022
            : -12.971,
          longitude: initialLocation
            ? initialLocation.longitude + 0.022
            : -38.511,
          timestamp: Date.now(),
        },
      },
      {
        id: "rio-vermelho",
        name: "Rio Vermelho",
        address: "Rio Vermelho, Salvador, BA",
        keywords: [
          "rio vermelho",
          "acarajé",
          "bairro",
          "restaurantes",
          "noite",
        ],
        coords: {
          latitude: initialLocation
            ? initialLocation.latitude - 0.025
            : -13.009,
          longitude: initialLocation
            ? initialLocation.longitude - 0.025
            : -38.49,
          timestamp: Date.now(),
        },
      },
      {
        id: "pituba",
        name: "Pituba",
        address: "Pituba, Salvador, BA",
        keywords: ["pituba", "bairro", "residencial", "comércio"],
        coords: {
          latitude: initialLocation ? initialLocation.latitude - 0.008 : -12.99,
          longitude: initialLocation
            ? initialLocation.longitude - 0.008
            : -38.46,
          timestamp: Date.now(),
        },
      },
      {
        id: "barra-shopping",
        name: "Shopping Barra",
        address: "Shopping Barra, Avenida Centenário, Salvador, BA",
        keywords: ["shopping barra", "barra shopping", "centenário"],
        coords: {
          latitude: initialLocation
            ? initialLocation.latitude - 0.015
            : -13.008,
          longitude: initialLocation
            ? initialLocation.longitude - 0.015
            : -38.52,
          timestamp: Date.now(),
        },
      },
    ];

    const queryLower = query.toLowerCase().trim();

    const filteredPlaces = salvadorPlaces.filter((place) => {
      return (
        place.name.toLowerCase().includes(queryLower) ||
        place.address.toLowerCase().includes(queryLower) ||
        place.keywords.some((keyword) => keyword.includes(queryLower))
      );
    });

    if (filteredPlaces.length === 0) {
      salvadorPlaces.forEach((place) => {
        place.keywords.forEach((keyword) => {
          if (queryLower.includes(keyword) || keyword.includes(queryLower)) {
            if (!filteredPlaces.find((p) => p.id === place.id)) {
              filteredPlaces.push(place);
            }
          }
        });
      });
    }

    const sortedPlaces = filteredPlaces.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(queryLower);
      const bNameMatch = b.name.toLowerCase().includes(queryLower);

      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;

      return 0;
    });

    return sortedPlaces.slice(0, 8);
  };

  const handleRequestRide = async () => {
    if (!user?.uid || !origin || !destination) {
      Alert.alert(
        "Erro",
        "Selecione origem e destino para solicitar a corrida."
      );
      return;
    }

    setIsRequesting(true);

    try {
      const passengerName =
        user.nome && user.nome.trim().length > 0 ? user.nome : "Passageiro";

      const rideId = await createRideRequest(
        user.uid,
        passengerName,
        origin,
        destination,
        estimatedPrice,
        estimatedDistanceKm
      );

      navigation.navigate("RideTracking", { rideId: rideId });
    } catch (error) {
      console.error("Erro ao solicitar corrida:", error);
      Alert.alert(
        "Erro",
        "Não foi possível solicitar a corrida. Tente novamente."
      );
    } finally {
      setIsRequesting(false);
      setRideModalVisible(false);
    }
  };

  const handlePlaceSelect = async (place: PlaceResult) => {
    const rideCoords: RideCoords = {
      latitude: place.coords.latitude,
      longitude: place.coords.longitude,
      nome: place.name,
    };

    if (searchType === "origin") {
      setOrigin(rideCoords);
    } else {
      setDestination(rideCoords);
    }

    setSearchModalVisible(false);
    setSearchText("");
    setSearchResults([]);

    if (searchType === "destination" && origin) {
      try {
        const route = await unifiedLocationService.calculateRoute(
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: rideCoords.latitude, longitude: rideCoords.longitude }
        );

        if (route && typeof route.distance === "number") {
          const distanceKm = route.distance / 1000;
          const minutes = Math.max(0, Math.ceil((route.duration || 0) / 60));
          const {
            calculateEstimatedPrice,
          } = require("../../services/locationServices");
          const price = calculateEstimatedPrice(distanceKm, minutes, false);
          setEstimatedDistanceKm(distanceKm);
          setEstimatedPrice(price);
        } else {
          try {
            const {
              calcularDistanciaKm,
            } = require("../../utils/calculoDistancia");
            const {
              calculateEstimatedPrice,
            } = require("../../services/locationServices");
            const distance = calcularDistanciaKm(
              { latitude: origin.latitude, longitude: origin.longitude },
              { latitude: rideCoords.latitude, longitude: rideCoords.longitude }
            );
            const price = calculateEstimatedPrice(distance);
            setEstimatedDistanceKm(distance);
            setEstimatedPrice(price);
          } catch (innerErr) {
            console.warn("Fallback erro ao calcular preço estimado:", innerErr);
          }
        }
      } catch (e) {
        console.warn("Erro ao calcular preço estimado pela rota:", e);
        try {
          const {
            calcularDistanciaKm,
          } = require("../../utils/calculoDistancia");
          const {
            calculateEstimatedPrice,
          } = require("../../services/locationServices");
          const distance = calcularDistanciaKm(
            { latitude: origin.latitude, longitude: origin.longitude },
            { latitude: rideCoords.latitude, longitude: rideCoords.longitude }
          );
          const price = calculateEstimatedPrice(distance);
          setEstimatedDistanceKm(distance);
          setEstimatedPrice(price);
        } catch (innerErr) {
          console.warn("Fallback erro ao calcular preço estimado:", innerErr);
        }
      }

      setTimeout(() => setRideModalVisible(true), 500);
    }
  };

  const openSearchModal = (type: "origin" | "destination") => {
    setSearchType(type);
    setSearchModalVisible(true);
    setSearchText("");
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
        nome: "Minha Localização Atual",
      });
    }
  };

  if (loadingLocation || !initialLocation) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: theme.whiteAreia }]}
      >
        <ActivityIndicator size="large" color={theme.blueBahia} />
        <Text style={[styles.loadingText, { color: theme.blueBahia }]}>
          Carregando sua localização...
        </Text>
      </View>
    );
  }

  const markers: MapMarker[] = [];
  if (origin) {
    markers.push({
      id: "origin",
      coords: origin,
      title: "Partida",
      color: "blueBahia",
    });
  }
  if (destination) {
    markers.push({
      id: "destination",
      coords: destination,
      title: "Destino",
      color: "yellowSol",
    });
  }

  // CORREÇÃO: Cálculo seguro para o bottom do searchPanel
  const safeBottom = Math.max(footerBottom + 20, 30); // Mínimo de 30px

  return (
    <View style={[styles.container, { backgroundColor: theme.whiteAreia }]}>
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

      {/* Painel de Busca FIXO - CORRIGIDO para não vazar */}
      <KeyboardAvoidingView
        style={[styles.searchPanelContainer, { bottom: safeBottom }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View
          style={[styles.searchPanel, { backgroundColor: theme.whiteAreia }]}
        >
          {/* Origem - CLICÁVEL */}
          <TouchableOpacity
            style={styles.locationCard}
            onPress={() => openSearchModal("origin")}
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
                <Ionicons name="navigate" size={18} color={theme.blueBahia} />
              )}
            </TouchableOpacity>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Partida</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {origin?.nome || "Selecionar local de partida"}
              </Text>
            </View>
            {origin?.nome !== "Minha Localização Atual" ? (
              <TouchableOpacity
                onPress={clearOrigin}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.grayUrbano}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.grayUrbano}
              />
            )}
          </TouchableOpacity>

          {/* Destino - CLICÁVEL */}
          <TouchableOpacity
            style={styles.locationCard}
            onPress={() => openSearchModal("destination")}
          >
            <View style={[styles.iconContainer, styles.destinationIcon]}>
              <Ionicons name="location" size={18} color={theme.yellowSol} />
            </View>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Destino</Text>
              <Text style={styles.locationText} numberOfLines={1}>
                {destination?.nome || "Para onde você vai?"}
              </Text>
            </View>
            {destination ? (
              <TouchableOpacity
                onPress={clearDestination}
                style={styles.clearButton}
              >
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={theme.grayUrbano}
                />
              </TouchableOpacity>
            ) : (
              <Ionicons
                name="chevron-forward"
                size={16}
                color={theme.grayUrbano}
              />
            )}
          </TouchableOpacity>

          {/* BOTÃO SOLICITAR CORRIDA */}
          {origin && destination && (
            <TouchableOpacity
              style={[
                styles.requestButton,
                { backgroundColor: theme.blueBahia },
              ]}
              onPress={() => setRideModalVisible(true)}
            >
              <Ionicons name="car-sport" size={24} color={theme.whiteAreia} />
              <Text
                style={[styles.requestButtonText, { color: theme.whiteAreia }]}
              >
                Solicitar Corrida
              </Text>
              <View style={styles.priceBadge}>
                <Text
                  style={[styles.priceText, { color: theme.blackProfissional }]}
                >
                  R$ {estimatedPrice.toFixed(2)}
                </Text>
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
      </KeyboardAvoidingView>

      {/* Modal de Busca com Autocomplete */}
      <Modal
        visible={searchModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.searchModalContainer}>
          <View style={styles.searchModalHeader}>
            <Text style={styles.searchModalTitle}>
              {searchType === "origin"
                ? "Escolher Partida"
                : "Escolher Destino"}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSearchModalVisible(false)}
            >
              <Ionicons
                name="close"
                size={24}
                color={theme.blackProfissional}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color={theme.grayUrbano} />
            <TextInput
              style={styles.searchInput}
              placeholder={`Digite ${
                searchType === "origin" ? "sua partida" : "seu destino"
              }...`}
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

          {searchResults.length === 0 &&
            searchText.length > 2 &&
            !loadingSearch && (
              <View style={styles.noResultsContainer}>
                <Ionicons
                  name="location-outline"
                  size={48}
                  color={theme.grayUrbano}
                />
                <Text style={styles.noResultsText}>
                  Nenhum local encontrado
                </Text>
                <Text style={styles.noResultsSubtext}>
                  Tente buscar por: "Aeroporto", "Shopping", "Praia",
                  "Pelourinho", etc.
                </Text>
              </View>
            )}

          {searchText.length < 3 && (
            <View style={styles.tipContainer}>
              <Ionicons
                name="information-circle"
                size={20}
                color={theme.blueBahia}
              />
              <Text style={styles.tipText}>
                Digite pelo menos 3 caracteres para buscar
              </Text>
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
                    color={
                      searchType === "origin"
                        ? COLORS.blueBahia
                        : COLORS.yellowSol
                    }
                  />
                </View>
                <View style={styles.placeInfo}>
                  <Text style={styles.placeName}>{item.name}</Text>
                  <Text style={styles.placeAddress} numberOfLines={2}>
                    {item.address}
                  </Text>
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
        isRequesting={isRequesting}
        origin={origin}
        destination={destination}
        price={estimatedPrice}
        distanceKm={estimatedDistanceKm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  // NOVO: Container para o searchPanel com KeyboardAvoidingView
  searchPanelContainer: {
    position: "absolute",
    width: "100%",
    
  },
  searchPanel: {
    padding: 20,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: COLORS.blackProfissional,
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
    bottom: 11,
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.grayClaro,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  originIcon: {
    backgroundColor: "rgba(0, 82, 155, 0.1)",
  },
  destinationIcon: {
    backgroundColor: "rgba(255, 193, 7, 0.1)",
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
    fontWeight: "500",
  },
  clearButton: {
    padding: 4,
  },
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.blueBahia,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginTop: 8,
    justifyContent: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonText: {
    color: COLORS.whiteAreia,
    fontWeight: "bold",
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
    fontWeight: "bold",
    fontSize: 14,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.grayUrbano,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  searchModalContainer: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia,
  },
  searchModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayClaro,
  },
  searchModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.blackProfissional,
  },
  closeButton: {
    padding: 4,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayClaro,
  },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 82, 155, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.blackProfissional,
    marginBottom: 2,
  },
  placeAddress: {
    fontSize: 14,
    color: COLORS.grayUrbano,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  noResultsText: {
    fontSize: 18,
    color: COLORS.grayUrbano,
    marginTop: 16,
    fontWeight: "500",
  },
  noResultsSubtext: {
    fontSize: 14,
    color: COLORS.grayUrbano,
    marginTop: 8,
    textAlign: "center",
  },
  tipContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0, 82, 155, 0.05)",
    margin: 20,
    borderRadius: 12,
    gap: 8,
  },
  tipText: {
    fontSize: 14,
    color: COLORS.blueBahia,
    fontWeight: "500",
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.whiteAreia,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.whiteAreia,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    marginTop: 4,
    textAlign: "center",
  },
});

export default HomeScreenPassageiro;
