import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TextInput, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { UserProfile } from '../../types/UserTypes'; 
import { Ionicons } from '@expo/vector-icons';

// Interface que espelha os dados do formulário localmente
interface UserProfileData {
    nome: string;
    email: string;
    telefone: string;
    // Campos específicos do motorista (podem ser strings vazias, mas são opcionais)
    modeloVeiculo?: string;
    placaVeiculo?: string;
}

const ProfileScreen = () => {
    const { user, setUser } = useUserStore();
    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // ✅ CORREÇÃO APLICADA: Usando 'perfil' em vez de 'tipo'
    const isDriver = user?.perfil === 'motorista'; 
    const userId = user?.uid;

    // 1. Carregar dados do perfil do Firestore ao montar
    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const fetchProfile = async () => {
            try {
                const userRef = doc(firestore, 'users', userId);
                const docSnap = await getDoc(userRef);

                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    
                    // Mapeia os dados do Firestore para o estado local
                    setProfile({
                        nome: data.nome || '',
                        email: data.email || '',
                        // Garante que a propriedade 'telefone' exista na tipagem UserProfile
                        telefone: (data as any).telefone || '', // Se 'telefone' não estiver em UserProfile, você precisa adicioná-lo
                        
                        // Campos de motorista
                        modeloVeiculo: data.motoristaData?.modeloVeiculo || '',
                        placaVeiculo: data.motoristaData?.placaVeiculo || '',
                    });
                }
            } catch (error) {
                console.error("Erro ao carregar perfil:", error);
                Alert.alert("Erro", "Não foi possível carregar os dados do seu perfil.");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [userId]);

    // 2. Função para atualizar o estado do formulário
    const handleChange = (field: keyof UserProfileData, value: string) => {
        setProfile(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    // 3. Função para salvar as alterações no Firestore
    const handleSave = async () => {
        if (!profile || !userId || !user) return; // Garante que 'user' não seja nulo para o setUser

        setIsSaving(true);
        try {
            const userRef = doc(firestore, 'users', userId);
            
            const updateData: any = {
                nome: profile.nome,
                telefone: profile.telefone,
                // Email não é alterado aqui pois é complexo (FireAuth)
            };

            // Adiciona campos específicos do motorista
            if (isDriver) {
                updateData.motoristaData = {
                    modeloVeiculo: profile.modeloVeiculo || '',
                    placaVeiculo: profile.placaVeiculo || '',
                    // Mantém outras propriedades do motoristaData, se existirem (ex: status)
                    ...(user.motoristaData || {}),
                };
            }

            await updateDoc(userRef, updateData);

            // Atualiza o estado global da aplicação
            setUser({ 
                ...user, 
                nome: profile.nome, 
                telefone: profile.telefone,
                ...(isDriver && { motoristaData: updateData.motoristaData }) 
            } as UserProfile);

            Alert.alert("Sucesso", "Seu perfil foi atualizado com sucesso!");
        } catch (error) {
            console.error("Erro ao salvar perfil:", error);
            Alert.alert("Erro", "Não foi possível salvar as alterações.");
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={COLORS.blueBahia} />
                <Text style={styles.loadingText}>Carregando perfil...</Text>
            </View>
        );
    }
    
    if (!profile) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Erro ao carregar perfil. Tente novamente mais tarde.</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                <Text style={styles.headerTitle}>
                    Configurações do Perfil ({isDriver ? 'Motorista' : 'Passageiro'})
                </Text>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Dados Pessoais</Text>
                    
                    <TextInput
                        style={styles.input}
                        placeholder="Nome Completo"
                        value={profile.nome}
                        onChangeText={(t) => handleChange('nome', t)}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Telefone"
                        value={profile.telefone}
                        onChangeText={(t) => handleChange('telefone', t)}
                        keyboardType="phone-pad"
                    />
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        placeholder="Email (Não Editável)"
                        value={profile.email}
                        editable={false}
                    />
                </View>

                {isDriver && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Dados do Veículo</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Modelo do Veículo (Ex: Fiat Uno 2018)"
                            value={profile.modeloVeiculo}
                            onChangeText={(t) => handleChange('modeloVeiculo', t)}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Placa do Veículo (Ex: ABC1234)"
                            value={profile.placaVeiculo}
                            onChangeText={(t) => handleChange('placaVeiculo', t)}
                            autoCapitalize="characters"
                        />
                    </View>
                )}

                <TouchableOpacity 
                    style={styles.saveButton} 
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color={COLORS.whiteAreia} />
                    ) : (
                        <Text style={styles.saveButtonText}>SALVAR ALTERAÇÕES</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={() => Alert.alert("Sair", "Lógica de Logout a ser implementada")}>
                    <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                    <Text style={styles.logoutButtonText}>Sair da Conta</Text>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.grayClaro,
    },
    scrollContent: {
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
    errorText: {
        color: COLORS.danger,
        fontSize: 16,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 20,
        textAlign: 'center',
    },
    section: {
        backgroundColor: COLORS.whiteAreia,
        borderRadius: 10,
        padding: 15,
        marginBottom: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.blackProfissional,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grayClaro,
        paddingBottom: 5,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderRadius: 8,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: COLORS.grayClaro,
        fontSize: 16,
    },
    disabledInput: {
        backgroundColor: '#eee',
        color: COLORS.grayUrbano,
    },
    saveButton: {
        backgroundColor: COLORS.blueBahia,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
    },
    saveButtonText: {
        color: COLORS.whiteAreia,
        fontSize: 18,
        fontWeight: 'bold',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 10,
    },
    logoutButtonText: {
        color: COLORS.danger,
        fontSize: 16,
        marginLeft: 10,
    }
});

export default ProfileScreen;