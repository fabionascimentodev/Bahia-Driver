import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { Ride } from '../../types/RideTypes';
import { COLORS } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type DriverStackParamList = {
  HomeMotorista: undefined;
  RideAction: { rideId: string };
  DriverPostRide: { rideId: string };
};

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverPostRide'>;

const DriverPostRideScreen = ({ navigation, route }: Props) => {
  const { rideId } = route.params;
  const [rideData, setRideData] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchRide = async () => {
      try {
        const ref = doc(firestore, 'rides', rideId);
        const snap = await getDoc(ref);
        if (snap.exists()) setRideData({ ...(snap.data() as any), rideId: snap.id } as Ride);
        else Alert.alert('Erro', 'Detalhes da corrida não encontrados.');
      } catch (e) {
        console.error('Erro ao buscar corrida para avaliação do passageiro:', e);
        Alert.alert('Erro', 'Não foi possível carregar os dados da corrida.');
      } finally {
        setLoading(false);
      }
    };

    fetchRide();
  }, [rideId]);

  const handleSubmitRating = async () => {
    if (!rideData || !rideData.passageiroId) {
      Alert.alert('Erro', 'Dados do passageiro não encontrados para avaliação.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rideRef = doc(firestore, 'rides', rideId);
      await updateDoc(rideRef, {
        motoristaAvaliacao: rating,
        motoristaAvaliacaoEm: new Date().toISOString(),
      });

      const passengerRef = doc(firestore, 'users', rideData.passageiroId);
      await updateDoc(passengerRef, {
        avaliacoes: arrayUnion(rating),
      });

      Alert.alert('Obrigado!', 'Avaliação enviada com sucesso.');
      if (navigation && typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      } else {
        navigation.navigate('HomeMotorista');
      }
    } catch (e) {
      console.error('Erro ao enviar avaliação do passageiro:', e);
      Alert.alert('Erro', 'Não foi possível enviar a avaliação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !rideData) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.blueBahia} />
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerArea}>
        <Ionicons name="checkmark-circle-outline" size={80} color={COLORS.success} />
        <Text style={styles.completionText}>Viagem Finalizada!</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.label}>Passageiro:</Text>
        <Text style={styles.driverName}>{rideData.passageiroNome || 'N/A'}</Text>
      </View>

      <View style={styles.ratingArea}>
        <Text style={styles.ratingTitle}>Avalie o passageiro:</Text>
        <StarRating currentRating={rating} onRatingChange={setRating} />
        <Text style={styles.ratingDescription}>Você avaliou o passageiro com {rating} estrela(s).</Text>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmitRating} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={COLORS.whiteAreia} /> : <Text style={styles.submitButtonText}>ENVIAR AVALIAÇÃO</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
};

// Local StarRating (copy from PostRideScreen)
import { StyleSheet as RNStyleSheet } from 'react-native';
const StarRating = ({ currentRating, onRatingChange }: { currentRating: number; onRatingChange: (r: number) => void }) => {
  const stars = [1,2,3,4,5];
  return (
    <View style={starStyles.container}>
      {stars.map((s) => (
        <TouchableOpacity key={s} onPress={() => onRatingChange(s)} activeOpacity={0.8}>
          <Ionicons name={s <= currentRating ? 'star' : 'star-outline'} size={40} color={COLORS.yellowSol} style={starStyles.star} />
        </TouchableOpacity>
      ))}
    </View>
  );
};

const starStyles = RNStyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', marginVertical: 15 },
  star: { marginHorizontal: 5 }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.whiteAreia },
  scrollContent: { alignItems: 'center', padding: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: COLORS.blueBahia },
  headerArea: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  completionText: { fontSize: 28, fontWeight: 'bold', color: COLORS.success, marginTop: 10 },
  detailsCard: { width: '100%', padding: 15, backgroundColor: '#fff', borderRadius: 10, marginBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 3 },
  label: { fontSize: 14, color: COLORS.grayUrbano },
  driverName: { fontSize: 20, fontWeight: 'bold', color: COLORS.blackProfissional, marginTop: 5 },
  ratingArea: { width: '100%', alignItems: 'center', marginBottom: 30 },
  ratingTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.blackProfissional },
  ratingDescription: { fontSize: 14, color: COLORS.grayUrbano, marginTop: 10 },
  submitButton: { width: '100%', backgroundColor: COLORS.blueBahia, padding: 18, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: COLORS.whiteAreia, fontSize: 18, fontWeight: 'bold' },
});

export default DriverPostRideScreen;
