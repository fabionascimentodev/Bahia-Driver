import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { updateUserProfileType } from '../../services/userServices'; 

// Tipagem de navegação
type AuthStackParamList = {
    Login: undefined;
    ProfileSelection: undefined;
    DriverRegistration: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSelection'>;

// CORREÇÃO: Removendo o React.FC<Props> e usando a sintaxe de função com props tipadas
const ProfileSelectionScreen = (props: Props) => {
    const { navigation } = props;
    const user = useUserStore(state => state.user);
    const [selectedType, setSelectedType] = useState<'passageiro' | 'motorista' | null>(null);
    const [nome, setNome] = useState('');
    const [telefone, setTelefone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleContinue = async () => {
        if (!user?.uid) {
            Alert.alert('Erro', 'Usuário não autenticado. Por favor, faça login novamente.');
            return;
        }

        if (!selectedType || !nome.trim() || !telefone.trim()) {
            Alert.alert('Atenção', 'Selecione um perfil e preencha seu nome e telefone.');
            return;
        }

        setLoading(true);
        try {
            await updateUserProfileType(user.uid, selectedType, nome, telefone);

            Alert.alert('Sucesso!', `Você escolheu ser ${selectedType}.`);

            // Redirecionamento baseado na seleção
            if (selectedType === 'motorista') {
                navigation.navigate('DriverRegistration');
            } else {
                // O listener em App.tsx cuidará do redirecionamento para HomePassageiro
                navigation.popToTop(); 
            }

        } catch (error) {
            console.error("Erro ao atualizar o tipo de perfil:", error);
            Alert.alert('Erro', 'Não foi possível salvar a sua escolha de perfil.');
        } finally {
            setLoading(false);
        }
    };

    const isButtonDisabled = loading || !selectedType || !nome.trim() || !telefone.trim();

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Quase lá! Selecione seu perfil</Text>

            {/* Campos de Nome e Telefone */}
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
                style={styles.input}
                placeholder="Seu nome"
                value={nome}
                onChangeText={setNome}
            />

            <Text style={styles.label}>Telefone (WhatsApp)</Text>
            <TextInput
                style={styles.input}
                placeholder="(71) 99999-9999"
                value={telefone}
                onChangeText={setTelefone}
                keyboardType="phone-pad"
            />
            
            {/* Seleção de Perfil */}
            <View style={styles.selectionContainer}>
                <TouchableOpacity
                    style={[
                        styles.card,
                        selectedType === 'passageiro' && styles.selectedCard
                    ]}
                    onPress={() => setSelectedType('passageiro')}
                    disabled={loading}
                >
                    <Ionicons name="people-outline" size={40} color={selectedType === 'passageiro' ? COLORS.blueBahia : COLORS.grayUrbano} />
                    <Text style={[styles.cardTitle, selectedType === 'passageiro' && styles.selectedTitle]}>Passageiro</Text>
                    <Text style={styles.cardText}>Para quem precisa de uma viagem rápida e segura.</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.card,
                        selectedType === 'motorista' && styles.selectedCard
                    ]}
                    onPress={() => setSelectedType('motorista')}
                    disabled={loading}
                >
                    <Ionicons name="car-outline" size={40} color={selectedType === 'motorista' ? COLORS.blueBahia : COLORS.grayUrbano} />
                    <Text style={[styles.cardTitle, selectedType === 'motorista' && styles.selectedTitle]}>Motorista</Text>
                    <Text style={styles.cardText}>Para quem deseja ganhar dinheiro dirigindo.</Text>
                </TouchableOpacity>
            </View>

            {/* Botão Continuar */}
            <TouchableOpacity
                style={[styles.continueButton, { opacity: isButtonDisabled ? 0.5 : 1 }]}
                onPress={handleContinue}
                disabled={isButtonDisabled}
            >
                {loading ? (
                    <ActivityIndicator color={COLORS.whiteAreia} />
                ) : (
                    <Text style={styles.continueButtonText}>Continuar como {selectedType || '...'}</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
        paddingBottom: 50,
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 20,
        textAlign: 'center',
    },
    label: {
        fontSize: 16,
        color: COLORS.blackProfissional,
        marginBottom: 5,
        fontWeight: '500',
    },
    input: {
        width: '100%',
        padding: 15,
        borderWidth: 1,
        borderColor: COLORS.grayClaro,
        borderRadius: 8,
        marginBottom: 20,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    selectionContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 30,
    },
    card: {
        width: '48%',
        padding: 15,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: COLORS.grayClaro,
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    selectedCard: {
        borderColor: COLORS.blueBahia,
        backgroundColor: COLORS.whiteAreia,
        shadowColor: COLORS.blueBahia,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 5,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 10,
        color: COLORS.grayUrbano,
    },
    selectedTitle: {
        color: COLORS.blueBahia,
    },
    cardText: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 5,
        color: COLORS.grayUrbano,
    },
    continueButton: {
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: COLORS.success,
    },
    continueButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    },
});

export default ProfileSelectionScreen;