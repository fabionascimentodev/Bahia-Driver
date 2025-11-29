import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { Ride } from '../../types/RideTypes'; 
import { COLORS } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
// REMOVIDA A IMPORTAÇÃO: import StarRating from '../../components/common/StarRating';
// O componente StarRating será definido localmente abaixo, para evitar o conflito.

// Tipagem de navegação para o Passageiro
type PassengerStackParamList = {
    HomePassageiro: undefined;
    RideTracking: { rideId: string };
    PostRide: { rideId: string };
};

type Props = NativeStackScreenProps<PassengerStackParamList, 'PostRide'>;

const PostRideScreen = (props: Props) => {
    const { navigation, route } = props;
    const { rideId } = route.params;

    const [rideData, setRideData] = useState<Ride | null>(null);
    const [loading, setLoading] = useState(true);
    const [rating, setRating] = useState(5); // Estado para a avaliação (1 a 5 estrelas)
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Busca os dados finais da corrida
    useEffect(() => {
        const fetchRideData = async () => {
            try {
                const rideDocRef = doc(firestore, 'rides', rideId);
                const docSnap = await getDoc(rideDocRef);

                if (docSnap.exists()) {
                    setRideData({ ...docSnap.data(), rideId: docSnap.id } as Ride);
                } else {
                    Alert.alert("Erro", "Detalhes da corrida não encontrados.");
                }
            } catch (error) {
                console.error("Erro ao buscar dados finais da corrida:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRideData();
    }, [rideId]);

    // 2. Envia a avaliação e finaliza a transação
    const handleSubmitRating = async () => {
        if (!rideData || !rideData.motoristaId) {
            Alert.alert("Erro", "Dados do motorista não encontrados para avaliação.");
            return;
        }

        setIsSubmitting(true);
        try {
            const rideDocRef = doc(firestore, 'rides', rideId);
            
            // 2.1. Atualiza a avaliação na corrida
            await updateDoc(rideDocRef, {
                passageiroAvaliacao: rating,
                pago: true, // Marcamos como pago (simulando que o pagamento ocorreu)
            });

            // 2.2. Atualizar o perfil do motorista com a nova avaliação
            const driverRef = doc(firestore, 'users', rideData.motoristaId);
            await updateDoc(driverRef, {
                avaliacoes: arrayUnion(rating) // Adiciona a avaliação para cálculo futuro de média
            });

            Alert.alert("Sucesso!", "Sua viagem foi finalizada e sua avaliação registrada. Obrigado por usar Bahia Driver!");
            navigation.popToTop(); // Volta para a tela inicial

        } catch (error) {
            console.error("Erro ao registrar avaliação:", error);
            Alert.alert("Erro", "Não foi possível registrar a avaliação. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading || !rideData) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Finalizando transação...</Text>
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
                <Text style={styles.label}>Motorista:</Text>
                <Text style={styles.driverName}>{rideData.motoristaNome || 'N/A'}</Text>
            </View>
            
            <View style={styles.priceCard}>
                <Text style={styles.priceLabel}>Valor Total da Corrida:</Text>
                <Text style={styles.priceValue}>R$ {((rideData as any).precoEstimado ?? (rideData as any).preçoEstimado ?? 0).toFixed(2)}</Text>
                <Text style={styles.paymentMethod}>Pagamento via Cartão (Simulado)</Text> 
            </View>

            <View style={styles.ratingArea}>
                <Text style={styles.ratingTitle}>Avalie sua experiência:</Text>
                
                {/* 3. Componente de Avaliação de Estrelas */}
                <StarRating currentRating={rating} onRatingChange={setRating} />
                
                <Text style={styles.ratingDescription}>Você avaliou o motorista com {rating} estrela(s).</Text>
            </View>

            <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleSubmitRating}
                disabled={isSubmitting}
            >
                {isSubmitting ? (
                    <ActivityIndicator color={COLORS.whiteAreia} />
                ) : (
                    <Text style={styles.submitButtonText}>CONFIRMAR E FINALIZAR</Text>
                )}
            </TouchableOpacity>

        </ScrollView>
    );
};

// ----------------------------------------------------
// Componente de Avaliação de Estrelas (StarRating)
// ----------------------------------------------------
// MANTIDO AQUI PARA RESOLVER O CONFLITO LOCALMENTE
// Mova este bloco para src/components/common/StarRating.tsx para organização!

interface StarRatingProps {
    currentRating: number;
    onRatingChange: (rating: number) => void;
}

const StarRating = ({ currentRating, onRatingChange }: StarRatingProps) => {
    const stars = [1, 2, 3, 4, 5];

    return (
        <View style={starStyles.container}>
            {stars.map((star) => (
                <TouchableOpacity key={star} onPress={() => onRatingChange(star)} activeOpacity={0.8}>
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
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 15,
    },
    star: {
        marginHorizontal: 5,
    }
});
// FIM do Componente StarRating
// ----------------------------------------------------


const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    scrollContent: {
        alignItems: 'center',
        padding: 20,
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
    headerArea: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 20,
    },
    completionText: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.success,
        marginTop: 10,
    },
    detailsCard: {
        width: '100%',
        padding: 15,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    label: {
        fontSize: 14,
        color: COLORS.grayUrbano,
    },
    driverName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        marginTop: 5,
    },
    priceCard: {
        width: '100%',
        padding: 25,
        backgroundColor: COLORS.blueBahia,
        borderRadius: 10,
        marginBottom: 30,
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 18,
        color: COLORS.whiteAreia,
    },
    priceValue: {
        fontSize: 36,
        fontWeight: 'bold',
        color: COLORS.yellowSol,
    },
    paymentMethod: {
        fontSize: 14,
        color: COLORS.grayClaro,
        marginTop: 5,
    },
    ratingArea: {
        width: '100%',
        alignItems: 'center',
        marginBottom: 30,
    },
    ratingTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
    },
    ratingDescription: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        marginTop: 10,
    },
    submitButton: {
        width: '100%',
        backgroundColor: COLORS.blueBahia,
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitButtonText: {
        color: COLORS.whiteAreia,
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default PostRideScreen;