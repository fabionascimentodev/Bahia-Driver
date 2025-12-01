import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ride } from '../../types/RideTypes';
import { COLORS } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';

interface RideHistoryCardProps {
    ride: Ride;
    isDriver: boolean; // Para saber qual perspectiva mostrar
}

const RideHistoryCard = ({ ride, isDriver }: RideHistoryCardProps) => {
    
    // Formata a data de criação com suporte a Timestamp do Firestore
    const getCreatedDate = () => {
        // createdAt pode ser um Timestamp do Firestore ou uma string ISO
        const created: any = (ride as any).createdAt || ride.dataCriacao;
        if (!created) return new Date();
        // Firestore Timestamp tem método toDate()
        if (typeof created === 'object' && typeof created.toDate === 'function') {
            return created.toDate();
        }
        try {
            return new Date(created as any);
        } catch {
            return new Date();
        }
    };

    const date = getCreatedDate();
    const formattedDate = date.toLocaleDateString('pt-BR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
    
    // Determina o status e cores
    const isCompleted = ride.status === 'finalizada';
    const isCancelled = ride.status === 'cancelada';
    
    const statusText = isCompleted ? 'CONCLUÍDA' : 'CANCELADA';
    const statusColor = isCompleted ? COLORS.success : COLORS.danger;
    const iconName = isCompleted ? 'checkmark-circle' : 'close-circle';

    // Texto específico para o motorista/passageiro
    const mainDetailText = isDriver 
        ? `Passageiro: ${ride.passageiroNome || 'Desconhecido'}`
        : `Motorista: ${ride.motoristaNome || 'N/A'}`;
        
    // Valor a mostrar
    const priceVal = (ride as any).preçoEstimado ?? (ride as any).preçoEstimado ?? 0;
    const valueText = isCompleted 
        ? `R$ ${Number(priceVal).toFixed(2)}`
        : 'Valor: N/A'; // Corridas canceladas não têm valor final (geralmente)

    return (
        <View style={styles.card}>
            {/* Linha 1: Data e Status */}
            <View style={styles.header}>
                <Text style={styles.dateText}>{formattedDate}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                    <Ionicons name={iconName as any} size={14} color={COLORS.whiteAreia} style={styles.statusIcon} />
                    <Text style={styles.statusText}>{statusText}</Text>
                </View>
            </View>

            {/* Linha 2: Origem */}
            <View style={styles.locationRow}>
                <Ionicons name="pin-outline" size={16} color={COLORS.grayUrbano} />
                <Text style={styles.locationText} numberOfLines={1}>
                    Origem: {ride.origem?.nome ?? (ride.origem?.latitude && ride.origem?.longitude ? `${Number(ride.origem.latitude).toFixed(5)}, ${Number(ride.origem.longitude).toFixed(5)}` : 'N/A')}
                </Text>
            </View>
            
            {/* Linha 3: Destino */}
            <View style={styles.locationRow}>
                <Ionicons name="flag-outline" size={16} color={COLORS.grayUrbano} />
                <Text style={styles.locationText} numberOfLines={1}>
                    Destino: {ride.destino?.nome ?? (ride.destino?.latitude && ride.destino?.longitude ? `${Number(ride.destino.latitude).toFixed(5)}, ${Number(ride.destino.longitude).toFixed(5)}` : 'N/A')}
                </Text>
            </View>

            <View style={styles.divider} />

            {/* Linha 4: Detalhes do Usuário e Valor */}
            <View style={styles.footer}>
                <Text style={styles.detailText}>{mainDetailText}</Text>
                
                {isCompleted && (
                    <Text style={styles.valueText}>{valueText}</Text>
                )}
                {isDriver && isCompleted && ride.passageiroAvaliacao !== undefined && (
                    <Text style={styles.ratingText}>
                        Avaliação: {ride.passageiroAvaliacao}
                        <Ionicons name="star" size={12} color={COLORS.yellowSol} />
                    </Text>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.whiteAreia,
        borderRadius: 10,
        padding: 15,
        marginBottom: 10,
        shadowColor: COLORS.blackProfissional,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        borderLeftWidth: 5,
        borderLeftColor: COLORS.blueBahia,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    dateText: {
        fontSize: 14,
        color: COLORS.grayUrbano,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 5,
    },
    statusIcon: {
        marginRight: 4,
    },
    statusText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 12,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 5,
    },
    locationText: {
        marginLeft: 8,
        fontSize: 15,
        color: COLORS.blackProfissional,
        flexShrink: 1,
    },
    divider: {
        height: 1,
        backgroundColor: COLORS.grayClaro,
        marginVertical: 10,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    detailText: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        flex: 1,
    },
    valueText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginLeft: 10,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        marginLeft: 10,
    }
});

export default RideHistoryCard;