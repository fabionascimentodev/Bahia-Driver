import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { firestore } from "../../config/firebaseConfig";
import { Ride } from "../../types/RideTypes";
import { COLORS } from "../../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

type DriverStackParamList = {
  HomeMotorista: undefined;
  RideAction: { rideId: string };
  DriverPostRide: { rideId: string };
};

type Props = NativeStackScreenProps<DriverStackParamList, "DriverPostRide">;

const DriverPostRideScreen = ({ navigation, route }: Props) => {
  const { rideId } = route.params;
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { footerBottom } = useResponsiveLayout();
  const theme = COLORS;

  useEffect(() => {
    const fetchRideData = async () => {
      try {
        const rideDocRef = doc(firestore, "rides", rideId);
        const docSnap = await getDoc(rideDocRef);

        if (docSnap.exists()) {
          setRideData({ ...docSnap.data(), rideId: docSnap.id } as Ride);
        } else {
          Alert.alert("Erro", "Detalhes da corrida não encontrados.");
        }
      } catch (error) {
        console.error("Erro ao buscar dados finais da corrida:", error);
        Alert.alert("Erro", "Não foi possível carregar os dados da corrida.");
      } finally {
        setLoading(false);
      }
    };

    fetchRideData();
  }, [rideId]);

  const handleSubmitRating = async () => {
    if (!rideData || !rideData.passageiroId) {
      Alert.alert(
        "Erro",
        "Dados do passageiro não encontrados para avaliação."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const rideRef = doc(firestore, "rides", rideId);
      await updateDoc(rideRef, {
        motoristaAvaliacao: rating,
        motoristaAvaliacaoEm: new Date().toISOString(),
      });

      const passengerRef = doc(firestore, "users", rideData.passageiroId);
      await updateDoc(passengerRef, {
        avaliacoes: arrayUnion(rating),
      });

      try {
        const { safePopToTop } = require("../../services/navigationService");
        safePopToTop(navigation, "HomeMotorista");
      } catch (e) {
        console.debug("safePopToTop failed (DriverPostRide):", e);
        try {
          navigation.navigate("HomeMotorista");
        } catch (err) {
          // nothing else to do
        }
      }
    } catch (e) {
      console.error("Erro ao enviar avaliação do passageiro:", e);
      Alert.alert(
        "Erro",
        "Não foi possível enviar a avaliação. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !rideData) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.whiteAreia }]}>
        <ActivityIndicator size="large" color={theme.blueBahia} />
        <Text style={[styles.loadingText, { color: theme.blueBahia }]}>Finalizando transação...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.whiteAreia }]}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: footerBottom + 24 },
      ]}
    >
      <View style={styles.headerArea}>
        <Ionicons
          name="checkmark-circle-outline"
          size={80}
          color={theme.success}
        />
        <Text style={styles.completionText}>Viagem Finalizada!</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.label}>Passageiro:</Text>
        <Text style={styles.passengerName}>{rideData.passageiroNome || 'N/A'}</Text>
      </View>
      
      <View style={styles.priceCard}>
        <Text style={styles.priceLabel}>Valor Total da Corrida:</Text>
        <Text style={styles.priceValue}>
          R$ {((rideData.valor_total ?? rideData.preçoEstimado ?? 0).toFixed(2))}
        </Text>
        <Text style={styles.paymentMethod}>
          {rideData.paymentType === "cash" 
            ? "Pagamento em Dinheiro" 
            : "Pagamento via Cartão (Simulado)"}
        </Text>
      </View>

      <View style={styles.ratingArea}>
        <Text style={styles.ratingTitle}>Avalie o Passageiro:</Text>
        <StarRating currentRating={rating} onRatingChange={setRating} />
        <Text style={styles.ratingDescription}>
          Você avaliou o passageiro com {rating} estrela(s).
        </Text>
      </View>

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmitRating}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={theme.whiteAreia} />
        ) : (
          <Text style={[styles.submitButtonText, { color: theme.whiteAreia }]}>
            CONFIRMAR E FINALIZAR
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

// Componente StarRating local
interface StarRatingProps {
  currentRating: number;
  onRatingChange: (rating: number) => void;
}

const StarRating = ({ currentRating, onRatingChange }: StarRatingProps) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <View style={starStyles.container}>
      {stars.map((star) => (
        <TouchableOpacity 
          key={star} 
          onPress={() => onRatingChange(star)} 
          activeOpacity={0.8}
        >
          <Ionicons
            name={star <= currentRating ? "star" : "star-outline"}
            size={40}
            color={COLORS.yellowSol}
            style={starStyles.star}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const starStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 15,
  },
  star: { 
    marginHorizontal: 5 
  },
});

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.whiteAreia 
  },
  scrollContent: { 
    alignItems: "center", 
    padding: 20 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center" 
  },
  loadingText: { 
    marginTop: 10, 
    color: COLORS.blueBahia 
  },
  headerArea: { 
    alignItems: "center", 
    marginBottom: 30, 
    marginTop: 20 
  },
  completionText: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.success,
    marginTop: 10,
  },
  detailsCard: {
    width: "100%",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  label: { 
    fontSize: 14, 
    color: COLORS.grayUrbano 
  },
  passengerName: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.blackProfissional,
    marginTop: 5,
  },
  priceCard: {
    width: "100%",
    padding: 25,
    backgroundColor: COLORS.blueBahia,
    borderRadius: 10,
    marginBottom: 30,
    alignItems: "center",
  },
  priceLabel: { 
    fontSize: 18, 
    color: COLORS.whiteAreia 
  },
  priceValue: { 
    fontSize: 36, 
    fontWeight: "bold", 
    color: COLORS.yellowSol 
  },
  paymentMethod: { 
    fontSize: 14, 
    color: COLORS.grayClaro, 
    marginTop: 5 
  },
  ratingArea: { 
    width: "100%", 
    alignItems: "center", 
    marginBottom: 30 
  },
  ratingTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.blackProfissional,
  },
  ratingDescription: { 
    fontSize: 14, 
    color: COLORS.grayUrbano, 
    marginTop: 10 
  },
  submitButton: {
    width: "100%",
    backgroundColor: COLORS.blueBahia,
    padding: 18,
    borderRadius: 30,
    alignItems: "center",
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default DriverPostRideScreen;