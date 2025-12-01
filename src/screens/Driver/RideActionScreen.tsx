import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { firestore } from "../../config/firebaseConfig";
import { Ride } from "../../types/RideTypes";
import { COLORS } from "../../theme/colors";
import MapViewComponent, {
  MapMarker,
} from "../../components/common/MapViewComponent";
import { useUserStore } from "../../store/userStore";
import {
  startDriverLocationTracking,
  stopDriverLocationTracking,
} from "../../services/driverLocationService";
import { motoristaAceitarCorrida } from "../../services/rideService";
import {
  Linking,
  AppState,
  AppStateStatus,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import { unifiedLocationService } from "../../services/unifiedLocationService";
import { Ionicons } from "@expo/vector-icons";

type DriverStackParamList = {
  HomeMotorista: undefined;
  RideAction: { rideId: string };
  Chat: { rideId: string };
  DriverPostRide: { rideId: string };
};

type Props = NativeStackScreenProps<DriverStackParamList, "RideAction">;

const RideActionScreen = (props: Props) => {
  const { navigation, route } = props;
  const { rideId } = route.params;
  const { user } = useUserStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [driverEtaMinutes, setDriverEtaMinutes] = useState<number | null>(null);
  const [navPreference, setNavPreference] = useState<
    "waze" | "google" | "web" | null
  >(null);
  const [chooseNavModalVisible, setChooseNavModalVisible] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<
    "startTrip" | "acceptFlow" | null
  >(null);
  const [pendingNavCoords, setPendingNavCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const dims = useWindowDimensions();
  const { footerBottom } = useResponsiveLayout();
  const isSmallScreen = dims.height < 600; // Para telas pequenas como Samsung A01

  const NAV_PREF_KEY = "@bahia_driver_nav_app_choice";
  const NAV_PENDING_KEY = "@bahia_driver_pending_nav";

  useEffect(() => {
    (async () => {
      try {
        const pref = await AsyncStorage.getItem(NAV_PREF_KEY);
        if (pref === "waze" || pref === "google" || pref === "web") {
          setNavPreference(pref);
        }
      } catch (e) {
        console.warn("Erro ao ler preferência de navegação:", e);
      }
    })();
  }, []);

  // Listener para quando o app volta ao foreground — utilizado para limpar o estado de navegação externa
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      try {
        if (nextAppState === "active") {
          const pendingRaw = await AsyncStorage.getItem(NAV_PENDING_KEY);
          if (pendingRaw) {
            // Limpa flag e prompt para o motorista voltar à corrida
            await AsyncStorage.removeItem(NAV_PENDING_KEY);
            // Se estamos em outra tela, traz de volta para RideAction
            try {
              if (navigation && typeof navigation.navigate === "function") {
                navigation.navigate("RideAction", { rideId });
              }
            } catch (e) {
              // fallback: apenas log
              console.debug("Retornando ao RideAction após navegação externa");
            }
          }
        }
      } catch (e) {
        console.warn(
          "Erro ao processar retorno ao app após navegação externa:",
          e
        );
      }
    };

    const sub = AppState.addEventListener
      ? AppState.addEventListener("change", handleAppStateChange)
      : undefined;
    return () => {
      if (sub && typeof sub.remove === "function") sub.remove();
    };
  }, [navigation, rideId]);

  useEffect(() => {
    if (!rideId) return;

    const rideDocRef = doc(firestore, "rides", rideId);
    const unsubscribe = onSnapshot(
      rideDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = { ...docSnap.data(), rideId: docSnap.id } as Ride;
          setRide(data);

          if (data.status === "cancelada") {
            stopDriverLocationTracking();
            if (navigation && typeof navigation.popToTop === "function") {
              navigation.popToTop();
            } else {
              console.debug(
                "safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)"
              );
            }
          }

          const driverLoc = data.motoristaLocalizacao;
          const originLoc = data.origem;
          if (driverLoc && originLoc) {
            (async () => {
              try {
                const routeInfo = await unifiedLocationService.calculateRoute(
                  driverLoc as any,
                  originLoc as any
                );
                if (routeInfo && routeInfo.duration)
                  setDriverEtaMinutes(Math.ceil(routeInfo.duration / 60));
                else setDriverEtaMinutes(null);
              } catch (e) {
                console.error("Erro ao calcular ETA no RideAction:", e);
              }
            })();
          }
        } else {
          Alert.alert("Erro", "Corrida não encontrada.");
          navigation.goBack();
        }
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao ouvir detalhes da corrida:", error);
        Alert.alert(
          "Erro",
          "Não foi possível carregar os detalhes da corrida."
        );
        navigation.goBack();
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
      stopDriverLocationTracking();
    };
  }, [rideId, navigation]);

  const handleAcceptRide = async () => {
    if (!ride || !user || !user.uid || ride.status !== "pendente") {
      Alert.alert(
        "Atenção",
        "Esta corrida não está mais disponível ou já foi aceita."
      );
      navigation.goBack();
      return;
    }

    setIsAccepting(true);
    try {
      const result = await motoristaAceitarCorrida(
        rideId,
        user.uid,
        user.nome,
        user.motoristaData?.placaVeiculo || ""
      );
      if (!result.success) {
        Alert.alert(
          "Corrida indisponível",
          result.error || "Outro motorista aceitou esta corrida antes de você."
        );
        if (navigation && typeof navigation.popToTop === "function") {
          navigation.popToTop();
        } else {
          console.debug(
            "safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)"
          );
        }
        return;
      }

      await startDriverLocationTracking(rideId);

      try {
        const lat = ride.origem?.latitude;
        const lon = ride.origem?.longitude;
        if (lat && lon) {
          // Use preference if available, otherwise show modal
          if (navPreference) {
            await openNavigation(lat, lon, navPreference);
          } else {
            // store coords for modal action and show modal
            setPendingNavAction("acceptFlow");
            setPendingNavCoords({ lat, lon });
            setChooseNavModalVisible(true);
          }
        }
      } catch (e) {
        console.warn("Erro ao abrir navegação externa:", e);
      }
    } catch (error) {
      console.error("Erro ao aceitar corrida:", error);
      Alert.alert(
        "Erro",
        "Não foi possível aceitar a corrida. Tente novamente."
      );
    } finally {
      setIsAccepting(false);
    }
  };

  const handleStartTrip = async () => {
    if (!ride) return;

    const startStatusAndOpen = async (choice: "waze" | "google" | "web") => {
      try {
        await handleUpdateStatus("em andamento");
      } catch (e) {
        // handleUpdateStatus já exibe alert em caso de erro
      }

      const lat = ride.destino?.latitude;
      const lon = ride.destino?.longitude;
      if (!lat || !lon) {
        Alert.alert("Navegação", "Destino inválido para abrir navegação.");
        return;
      }

      await openNavigation(lat, lon, choice);
    };

    if (navPreference) {
      await startStatusAndOpen(navPreference);
      return;
    }

    // Se ainda não escolheu, mostra modal (escolha será salva)
    setPendingNavAction("startTrip");
    setChooseNavModalVisible(true);
  };

  const openNavigation = async (
    lat: number,
    lon: number,
    choice: "waze" | "google" | "web"
  ) => {
    try {
      // tentativa de criar deep-link de retorno para o app (alguns apps suportam x-callback-url)
      const appReturnScheme = `bahia-driver://ride?rideId=${encodeURIComponent(
        rideId
      )}`;
      const encodedReturn = encodeURIComponent(appReturnScheme);

      const wazeUrl = `waze://?ll=${lat},${lon}&navigate=yes&return_to=${encodedReturn}`;
      const googleMapsApp = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving&x-success=${encodedReturn}`;
      const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;

      // marca que estamos abrindo navegação externa para retornar depois
      try {
        await AsyncStorage.setItem(
          NAV_PENDING_KEY,
          JSON.stringify({ rideId, ts: Date.now() })
        );
      } catch (e) {
        /* ignore */
      }

      if (choice === "waze") {
        const canWaze = await Linking.canOpenURL("waze://");
        if (canWaze) return Linking.openURL(wazeUrl);
        // fallback to google/web
      }

      if (choice === "google") {
        const canGoogle = await Linking.canOpenURL("comgooglemaps://");
        if (canGoogle) return Linking.openURL(googleMapsApp);
        // fallback to web
      }

      // default/web fallback
      return Linking.openURL(googleMapsWeb);
    } catch (e) {
      console.warn("Erro ao abrir navegação externa:", e);
      try {
        const googleMapsWeb = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
        return Linking.openURL(googleMapsWeb);
      } catch (err) {
        console.warn("Falha ao abrir Google Maps web:", err);
      }
    }
  };

  const handleUpdateStatus = async (
    newStatus: "chegou" | "em andamento" | "finalizada"
  ) => {
    if (!ride) return;

    setIsUpdatingStatus(true);
    try {
      const rideDocRef = doc(firestore, "rides", rideId);
      const updateData: any = { status: newStatus };
      if (newStatus === "chegou")
        updateData.chegouEm = new Date().toISOString();
      if (newStatus === "em andamento")
        updateData.horaInicio = new Date().toISOString();
      if (newStatus === "finalizada")
        updateData.horaFim = new Date().toISOString();
      await updateDoc(rideDocRef, updateData);
      // Após marcar finalizada, navegar para tela de avaliação do passageiro
      if (newStatus === "finalizada") {
        navigation.navigate("DriverPostRide", { rideId });
      }
      console.log(`Corrida marcada como: ${newStatus.toUpperCase()}.`);
    } catch (error) {
      console.error(`Erro ao mudar status para ${newStatus}:`, error);
      Alert.alert("Erro", `Não foi possível mudar o status para ${newStatus}.`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const startStatusAndOpen = async (choice: "waze" | "google" | "web") => {
    if (!ride) return;
    try {
      await handleUpdateStatus("em andamento");
    } catch (e) {
      // already handled inside handleUpdateStatus
    }

    const lat = ride.destino?.latitude;
    const lon = ride.destino?.longitude;
    if (!lat || !lon) {
      Alert.alert("Navegação", "Destino inválido para abrir navegação.");
      return;
    }

    await openNavigation(lat, lon, choice);
  };

  const handleCancelRide = async () => {
    Alert.alert(
      "Cancelar Corrida",
      "Tem certeza que deseja cancelar esta corrida?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              let refundAmount =
                (ride as any).preçoEstimado ?? (ride as any).preçoEstimado ?? 0;
              let refundPercentage = 100;
              if (ride?.status === "em andamento") refundPercentage = 50;
              const finalRefund = Number(
                (refundAmount * (refundPercentage / 100)).toFixed(2)
              );
              const rideRef = doc(firestore, "rides", rideId);
              await updateDoc(rideRef, {
                status: "cancelada",
                canceladoPor: user?.uid,
                canceladoEm: new Date().toISOString(),
                refundAmount: finalRefund,
                refundPercentage: refundPercentage,
              });
              stopDriverLocationTracking();
              if (navigation && typeof navigation.popToTop === "function") {
                navigation.popToTop();
              } else {
                console.debug(
                  "safePopToTop: popToTop not available on this navigator (Driver RideActionScreen)"
                );
              }
            } catch (error) {
              Alert.alert("Erro", "Não foi possível cancelar a corrida.");
            }
          },
        },
      ]
    );
  };

  const renderActionButton = () => {
    if (!ride) return null;
    if (ride.status === "pendente")
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
    if (ride.status === "aceita")
      return (
        <TouchableOpacity
          style={styles.nextActionButton}
          onPress={() => handleUpdateStatus("chegou")}
          disabled={isUpdatingStatus}
        >
          <Text style={styles.nextActionButtonText}>
            CHEGUEI AO LOCAL DE BUSCA
          </Text>
        </TouchableOpacity>
      );
    if (ride.status === "chegou")
      return (
        <TouchableOpacity
          style={styles.nextActionButton}
          onPress={handleStartTrip}
          disabled={isUpdatingStatus}
        >
          <Text style={styles.nextActionButtonText}>INICIAR VIAGEM</Text>
        </TouchableOpacity>
      );
    if (ride.status === "em andamento")
      return (
        <TouchableOpacity
          style={[styles.nextActionButton, styles.finalizarButton]}
          onPress={() => handleUpdateStatus("finalizada")}
          disabled={isUpdatingStatus}
        >
          <Text
            style={[styles.nextActionButtonText, styles.finalizarButtonText]}
          >
            FINALIZAR VIAGEM
          </Text>
        </TouchableOpacity>
      );
    return null;
  };

  if (loading || !ride)
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.blueBahia} />
        <Text style={styles.loadingText}>
          Carregando detalhes da corrida...
        </Text>
      </View>
    );

  const mapMarkers: MapMarker[] = [
    { id: "origem", coords: ride.origem, title: "Partida", color: "success" },
    { id: "destino", coords: ride.destino, title: "Destino", color: "danger" },
  ];

  const showRouteToOrigin =
    ride.status === "aceita" || ride.status === "chegou";
  const showFullRoute = ride.status === "em andamento";
  const initialMapLocation = showRouteToOrigin ? ride.origem : ride.destino;

  const hasUnread = (() => {
    try {
      if (!user?.uid) return false;
      const lastMessageAtRaw = (ride as any).lastMessageAt;
      if (!lastMessageAtRaw) return false;
      const lastMessageAt = lastMessageAtRaw?.toMillis
        ? lastMessageAtRaw.toMillis()
        : lastMessageAtRaw instanceof Date
        ? lastMessageAtRaw.getTime()
        : new Date(lastMessageAtRaw).getTime();
      const lastReadMap = (ride as any).lastRead || {};
      const myLastReadRaw = lastReadMap[user.uid];
      const myLastRead = myLastReadRaw?.toMillis
        ? myLastReadRaw.toMillis()
        : myLastReadRaw
        ? new Date(myLastReadRaw).getTime()
        : null;
      const lastSender = (ride as any).lastMessageSenderId;
      if (!myLastRead) return lastMessageAt && lastSender !== user.uid;
      return lastMessageAt > myLastRead && lastSender !== user.uid;
    } catch (e) {
      return false;
    }
  })();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.mapContainer,
          { 
            height: isSmallScreen 
              ? Math.min(dims.height * 0.4, 400) // Menor para telas pequenas
              : Math.min(dims.height * 0.45, 500)
          },
        ]}
      >
        <MapViewComponent
          initialLocation={initialMapLocation}
          markers={mapMarkers}
          showRoute={showRouteToOrigin || showFullRoute}
          origin={ride.origem}
          destination={showRouteToOrigin ? ride.origem : ride.destino}
          driverLocation={ride.motoristaLocalizacao}
          centerOnDriver={true}
        />
      </View>
      
      <View
        style={[styles.detailsContainer, { 
          paddingBottom: isSmallScreen ? footerBottom + 4 : footerBottom + 8,
        }]}
      >
        <View
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              marginBottom: isSmallScreen ? 8 : 12,
            },
            dims.width < 380 || isSmallScreen
              ? { flexDirection: "column", alignItems: "flex-start" }
              : null,
          ]}
        >
          <Text style={[
            styles.header, 
            isSmallScreen && { fontSize: 20 } // Menor fonte para telas pequenas
          ]} numberOfLines={1} ellipsizeMode="tail">
            Corrida: {ride.status.toUpperCase()}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.chatButtonDriver,
              isSmallScreen && { 
                paddingHorizontal: 10, 
                paddingVertical: 5,
                marginTop: isSmallScreen && dims.width < 380 ? 4 : 0
              }
            ]}
            onPress={() => navigation.navigate("Chat", { rideId })}
            accessibilityLabel="Abrir chat"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={isSmallScreen ? 14 : 16}
              color={COLORS.whiteAreia}
            />
            <Text style={[
              styles.chatButtonText,
              isSmallScreen && { fontSize: 11, marginLeft: 4 }
            ]}>Chat</Text>
            {hasUnread ? <View style={[
              styles.unreadDot,
              isSmallScreen && { width: 6, height: 6 }
            ]} /> : null}
          </TouchableOpacity>
        </View>

        <View style={[styles.detailRow, isSmallScreen && { paddingVertical: 4 }]}>
          <Text style={[
            styles.detailLabel,
            isSmallScreen && { fontSize: 12 }
          ]}>📍 Origem:</Text>
          <Text style={[styles.detailValue, { 
            flex: 1, 
            textAlign: 'right',
            fontSize: isSmallScreen ? 12 : 14,
            maxWidth: isSmallScreen ? '60%' : '65%',
          }]}>
            {ride.origem?.nome ??
              (ride.origem?.latitude && ride.origem?.longitude
                ? `${Number(ride.origem.latitude).toFixed(5)}, ${Number(
                    ride.origem.longitude
                  ).toFixed(5)}`
                : "N/A")}
          </Text>
        </View>

        {driverEtaMinutes !== null && (
          <View style={[styles.detailRow, isSmallScreen && { paddingVertical: 4 }]}>
            <Text style={[
              styles.detailLabel,
              isSmallScreen && { fontSize: 12 }
            ]}>⏱️ Tempo até passageiro:</Text>
            <Text style={[styles.detailValue, { 
              flex: 1, 
              textAlign: 'right',
              fontSize: isSmallScreen ? 12 : 14,
            }]}>{driverEtaMinutes} min</Text>
          </View>
        )}

        <View style={[styles.detailRow, isSmallScreen && { paddingVertical: 4 }]}>
          <Text style={[
            styles.detailLabel,
            isSmallScreen && { fontSize: 12 }
          ]}>🏁 Destino:</Text>
          <Text style={[styles.detailValue, { 
            flex: 1, 
            textAlign: 'right',
            fontSize: isSmallScreen ? 12 : 14,
            maxWidth: isSmallScreen ? '60%' : '65%',
          }]}>
            {ride.destino?.nome ??
              (ride.destino?.latitude && ride.destino?.longitude
                ? `${Number(ride.destino.latitude).toFixed(5)}, ${Number(
                    ride.destino.longitude
                  ).toFixed(5)}`
                : "N/A")}
          </Text>
        </View>

        <View style={[
          styles.detailRow, 
          styles.priceRow, 
          isSmallScreen && { 
            paddingVertical: 8,
            marginTop: 6,
          }
        ]}>
          <Text style={[
            styles.priceLabel,
            isSmallScreen && { fontSize: 14 }
          ]}>Valor Estimado:</Text>
          <Text style={[
            styles.priceValue,
            isSmallScreen && { fontSize: 18 }
          ]}>
            R${" "}
            {(
              (ride as any).preçoEstimado ??
              (ride as any).preçoEstimado ??
              0
            ).toFixed(2)}
          </Text>
        </View>

        <View style={[
          styles.navButtonContainer,
          isSmallScreen && { 
            marginTop: 6, 
            marginBottom: 6,
          }
        ]}>
          <TouchableOpacity
            onPress={() => setChooseNavModalVisible(true)}
            style={[
              styles.navButton,
              isSmallScreen && { 
                paddingVertical: 5, 
                paddingHorizontal: 12,
              }
            ]}
            accessibilityLabel="Alterar Navegação"
          >
            <Text style={[
              styles.navButtonText,
              isSmallScreen && { fontSize: 11 }
            ]}>Alterar Navegação</Text>
          </TouchableOpacity>
        </View>

        <View style={[
          styles.buttonsContainer,
          isSmallScreen && { marginTop: 15 }
        ]}>
          <View style={[
            styles.actionButtonContainer,
            isSmallScreen && { marginBottom: 8 }
          ]}>
            {renderActionButton()}
          </View>

          {ride.status !== "finalizada" && ride.status !== "cancelada" && (
            <TouchableOpacity
              style={[
                styles.cancelButton,
                isSmallScreen && { padding: 12 }
              ]}
              onPress={handleCancelRide}
              disabled={isUpdatingStatus}
            >
              <Text style={[
                styles.cancelButtonText,
                isSmallScreen && { fontSize: 14 }
              ]}>Cancelar Corrida</Text>
            </TouchableOpacity>
          )}
        </View>

        <Modal
          visible={chooseNavModalVisible}
          transparent
          animationType="slide"
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setChooseNavModalVisible(false)}
          >
            <Pressable style={[
              styles.modalContainer,
              isSmallScreen && { padding: 16 }
            ]} onPress={() => {}}>
              <Text style={[
                styles.modalTitle,
                isSmallScreen && { fontSize: 16 }
              ]}>Escolha um App de Navegação</Text>
              <Text style={[
                { color: COLORS.grayUrbano, marginBottom: 12 },
                isSmallScreen && { fontSize: 12 }
              ]}>
                Selecione o app que prefere para navegação. Sua escolha será salva.
              </Text>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  isSmallScreen && { paddingVertical: 10 }
                ]}
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem(NAV_PREF_KEY, "waze");
                    setNavPreference("waze");
                  } catch (e) {
                    console.warn(e);
                  }
                  setChooseNavModalVisible(false);
                  await startStatusAndOpen("waze");
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  isSmallScreen && { fontSize: 14 }
                ]}>Waze</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  isSmallScreen && { paddingVertical: 10 }
                ]}
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem(NAV_PREF_KEY, "google");
                    setNavPreference("google");
                  } catch (e) {
                    console.warn(e);
                  }
                  setChooseNavModalVisible(false);
                  await startStatusAndOpen("google");
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  isSmallScreen && { fontSize: 14 }
                ]}>Google Maps (App)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalOption,
                  isSmallScreen && { paddingVertical: 10 }
                ]}
                onPress={async () => {
                  try {
                    await AsyncStorage.setItem(NAV_PREF_KEY, "web");
                    setNavPreference("web");
                  } catch (e) {
                    console.warn(e);
                  }
                  setChooseNavModalVisible(false);
                  await startStatusAndOpen("web");
                }}
              >
                <Text style={[
                  styles.modalOptionText,
                  isSmallScreen && { fontSize: 14 }
                ]}>Abrir no Navegador</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalOption, styles.modalCancel]}
                onPress={() => setChooseNavModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalOptionText, 
                    { color: COLORS.danger },
                    isSmallScreen && { fontSize: 14 }
                  ]}
                >
                  Cancelar
                </Text>
              </TouchableOpacity>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.whiteAreia 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  loadingText: { 
    marginTop: 10, 
    color: COLORS.blueBahia,
    fontSize: 14,
  },
  mapContainer: { 
    width: "100%" 
  },
  detailsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: COLORS.whiteAreia,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.blueBahia,
    textAlign: "center",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayClaro,
  },
  detailLabel: { 
    fontSize: 14,
    color: COLORS.grayUrbano,
    flexShrink: 0,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.blackProfissional,
    flexWrap: 'wrap',
    maxWidth: '65%',
  },
  priceRow: { 
    marginTop: 8,
    borderBottomWidth: 0, 
    paddingVertical: 12,
  },
  priceLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.blackProfissional,
  },
  priceValue: { 
    fontSize: 20,
    fontWeight: "bold", 
    color: COLORS.success,
  },
  buttonsContainer: {
    marginTop: 20,
  },
  actionButtonContainer: { 
    marginBottom: 10,
  },
  acceptButton: {
    backgroundColor: COLORS.blueBahia,
    padding: 14,
    borderRadius: 30,
    alignItems: "center",
  },
  acceptButtonText: {
    color: COLORS.whiteAreia,
    fontSize: 16,
    fontWeight: "bold",
  },
  nextActionButton: {
    backgroundColor: COLORS.blueBahia,
    padding: 14,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
  },
  nextActionButtonText: {
    color: COLORS.whiteAreia,
    fontSize: 16,
    fontWeight: "bold",
  },
  finalizarButton: {
    backgroundColor: COLORS.blueBahia,
    borderRadius: 30,
  },
  cancelButton: {
    backgroundColor: COLORS.danger,
    padding: 14,
    borderRadius: 30,
    alignItems: "center",
    width: "100%",
  },
  cancelButtonText: {
    color: COLORS.whiteAreia,
    fontWeight: "bold",
    fontSize: 16,
  },
  chatButtonDriver: {
    backgroundColor: COLORS.blueBahia,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 'auto',
  },
  chatButtonText: {
    color: COLORS.whiteAreia,
    marginLeft: 6,
    fontWeight: "600",
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#00C853",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: COLORS.whiteAreia,
  },
  finalizarButtonText: {
    color: COLORS.whiteAreia,
    fontWeight: "bold",
    fontSize: 16,
  },
  navButtonContainer: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  navButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: COLORS.grayClaro,
  },
  navButtonText: {
    color: COLORS.blueBahia,
    fontSize: 13,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: COLORS.whiteAreia,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.blueBahia,
    marginBottom: 6,
  },
  modalOption: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginBottom: 8,
    alignItems: "center",
  },
  modalOptionText: {
    fontSize: 16,
    color: COLORS.blackProfissional,
    fontWeight: "600",
  },
  modalCancel: { 
    backgroundColor: "transparent" 
  },
});

export default RideActionScreen;