import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

/**
 * Componente de Avaliação por Estrelas.
 * Permite ao usuário selecionar uma nota de 1 a 5.
 */
interface StarRatingProps {
    currentRating: number;
    onRate: (rating: number) => void;
}

const StarRating: React.FC<StarRatingProps> = ({ currentRating, onRate }) => {
    return (
        <View style={styles.container}>
            {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity 
                    key={star} 
                    onPress={() => onRate(star)}
                    // Acessibilidade: Garante que é fácil de clicar
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons 
                        name={star <= currentRating ? "star" : "star-outline"} 
                        size={35} 
                        color={COLORS.yellowSol} 
                        style={styles.star}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flexDirection: 'row', 
        justifyContent: 'center', 
        marginVertical: 10 
    },
    star: { 
        marginHorizontal: 5 
    }
});

export default StarRating;