import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors'; 
import { RideCoords } from '../../types/RideTypes'; // Assumindo este tipo

// ✨ Interface atualizada para incluir todas as props da tela principal
interface RideRequestModalProps {
    isVisible: boolean;
    // Função para fechar/cancelar o modal (mudada de 'onClose' para 'onCancelRequest')
    onCancelRequest: () => void; 
    // Função para CONFIRMAR e iniciar a solicitação (necessária para resolver o erro)
    onConfirm: () => Promise<void>; 
    
    // Detalhes da Viagem
    origin: RideCoords | null;
    destination: RideCoords | null;
    price: number;
    distanceKm: number;

    // Propriedades opcionais para o status da solicitação
    isRequesting?: boolean; 
}

const RideRequestModal: React.FC<RideRequestModalProps> = ({ 
    isVisible, 
    onCancelRequest, 
    onConfirm,
    origin,
    destination,
    price,
    distanceKm,
    isRequesting = false, // Define um valor padrão
}) => {
    
    // Simulação de tempo de espera (pode ser ajustado conforme a lógica real)
    // const timeWaiting = 0; // Removido para simplificar o esqueleto

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={isVisible}
            onRequestClose={onCancelRequest}
        >
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    
                    <Text style={styles.modalTitle}>Detalhes da sua Corrida</Text>
                    
                    {/* --- Detalhes da Corrida --- */}
                    <View style={styles.detailContainer}>
                        <DetailRow icon="location-outline" label="Origem" value={origin?.nome || 'Carregando...'} />
                        <DetailRow icon="flag-outline" label="Destino" value={destination?.nome || 'Selecione o destino'} />
                        <DetailRow icon="swap-horizontal-outline" label="Distância" value={`${distanceKm.toFixed(1)} km`} />
                    </View>
                    
                    <Text style={styles.priceText}>
                        Estimativa de Preço: 
                        <Text style={styles.priceValue}> R$ {price.toFixed(2).replace('.', ',')}</Text>
                    </Text>

                    {/* --- Botões de Ação --- */}
                    <TouchableOpacity
                        style={[styles.button, styles.buttonConfirm]}
                        onPress={onConfirm}
                        disabled={isRequesting}
                    >
                        {isRequesting ? (
                            <ActivityIndicator color={COLORS.whiteAreia} />
                        ) : (
                            <Text style={styles.textStyle}>CONFIRMAR E SOLICITAR</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.button, styles.buttonCancel]}
                        onPress={onCancelRequest}
                        disabled={isRequesting}
                    >
                        <Text style={styles.textCancel}>CANCELAR</Text>
                    </TouchableOpacity>

                </View>
            </View>
        </Modal>
    );
};

// Componente auxiliar para formatar os detalhes
const DetailRow: React.FC<{ icon: string, label: string, value: string }> = ({ icon, label, value }) => (
    <View style={rowStyles.container}>
        <Ionicons name={icon as any} size={20} color={COLORS.blueBahia} style={rowStyles.icon} />
        <View style={rowStyles.textWrapper}>
            <Text style={rowStyles.label}>{label}:</Text>
            <Text style={rowStyles.value}>{value}</Text>
        </View>
    </View>
);

const rowStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
    },
    icon: {
        marginRight: 10,
    },
    textWrapper: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
        paddingBottom: 5,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        color: COLORS.grayUrbano,
    },
    value: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        maxWidth: '70%',
        textAlign: 'right',
    }
});


const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalView: {
        width: '100%',
        backgroundColor: COLORS.whiteAreia,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 25,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 15,
        color: COLORS.blueBahia,
    },
    detailContainer: {
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    priceText: {
        fontSize: 18,
        color: COLORS.blackProfissional,
        marginBottom: 25,
        fontWeight: '500',
    },
    priceValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: COLORS.success, // Cor de destaque para o preço
    },
    button: {
        borderRadius: 10,
        padding: 15,
        elevation: 2,
        width: '100%',
        marginTop: 10,
        alignItems: 'center',
    },
    buttonConfirm: {
        backgroundColor: COLORS.blueBahia,
    },
    buttonCancel: {
        backgroundColor: COLORS.danger,
        borderWidth: 0,
    },
    textStyle: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 16,
    },
    textCancel: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 16,
    }
});

export default RideRequestModal;