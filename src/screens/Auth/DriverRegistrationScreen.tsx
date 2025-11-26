import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { saveDriverVehicleData, uploadVehiclePhoto, VehicleData } from '../../services/userServices'; // Importação do serviço

// Tipagem de navegação
type AuthStackParamList = {
    Login: undefined;
    ProfileSelection: undefined;
    DriverRegistration: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverRegistration'>;

const DriverRegistrationScreen: React.FC<Props> = ({ navigation }) => {
    const user = useUserStore(state => state.user);
    const [modelo, setModelo] = useState('');
    const [placa, setPlaca] = useState('');
    const [cor, setCor] = useState('');
    const [ano, setAno] = useState('');
    const [fotoUri, setFotoUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // 1. Função de seleção de imagem
    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Precisamos de acesso à sua galeria para carregar a foto do veículo.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            setFotoUri(result.assets[0].uri);
        }
    };

    // 2. Função de finalização do cadastro
    const handleRegisterVehicle = async () => {
        if (!user?.uid) {
            Alert.alert('Erro', 'Usuário não autenticado.');
            return;
        }

        const anoNum = parseInt(ano, 10);
        if (!modelo || !placa || !cor || isNaN(anoNum) || !fotoUri) {
            Alert.alert('Atenção', 'Preencha todos os dados do veículo e selecione a foto.');
            return;
        }
        
        setLoading(true);
        let photoUrl = '';

        try {
            // 2.1. Upload da foto
            photoUrl = await uploadVehiclePhoto(user.uid, fotoUri, placa); // <--- CORREÇÃO: Passando 'placa' como 3º argumento

            // 2.2. Prepara os dados
            const vehicleData: VehicleData = {
                modelo,
                placa: placa.toUpperCase(),
                cor,
                ano: anoNum,
                fotoUrl: photoUrl,
            };

            // 2.3. Salva os dados do veículo e finaliza o registro
            await saveDriverVehicleData(user.uid, vehicleData);

            Alert.alert('Sucesso!', 'Cadastro finalizado. Você pode começar a aceitar corridas na tela inicial.');
            
            // Redireciona para o login ou home, o listener do App.tsx deve levar para HomeMotorista
            navigation.popToTop(); 

        } catch (error) {
            console.error('Erro no registro do veículo:', error);
            Alert.alert('Erro', 'Falha ao finalizar o cadastro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.header}>Dados do Veículo</Text>
            <Text style={styles.subtitle}>Para se tornar um Bahia Driver, precisamos dos dados do seu veículo.</Text>

            {/* Input Modelo */}
            <View style={styles.inputGroup}>
                <Ionicons name="car-sport-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder="Modelo do Veículo (Ex: Hyundai HB20)"
                    value={modelo}
                    onChangeText={setModelo}
                />
            </View>

            {/* Input Placa */}
            <View style={styles.inputGroup}>
                <Ionicons name="pricetag-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder="Placa (Ex: ABC1234)"
                    value={placa}
                    onChangeText={text => setPlaca(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                    autoCapitalize="characters"
                    maxLength={7}
                />
            </View>

            {/* Input Cor e Ano */}
            <View style={styles.row}>
                <View style={[styles.inputGroup, styles.rowInput]}>
                    <Ionicons name="color-palette-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Cor"
                        value={cor}
                        onChangeText={setCor}
                    />
                </View>
                <View style={[styles.inputGroup, styles.rowInput]}>
                    <Ionicons name="calendar-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Ano"
                        value={ano}
                        onChangeText={setAno}
                        keyboardType="numeric"
                        maxLength={4}
                    />
                </View>
            </View>

            {/* Upload de Foto */}
            <TouchableOpacity 
                style={styles.photoButton} 
                onPress={pickImage}
                disabled={loading}
            >
                <Ionicons name="camera-outline" size={30} color={COLORS.whiteAreia} />
                <Text style={styles.photoButtonText}>
                    {fotoUri ? 'Foto Selecionada' : 'Adicionar Foto do Veículo'}
                </Text>
            </TouchableOpacity>

            {fotoUri && (
                <Image source={{ uri: fotoUri }} style={styles.imagePreview} />
            )}

            {/* Botão Finalizar */}
            <TouchableOpacity 
                style={[styles.finishButton, { opacity: loading || !fotoUri ? 0.6 : 1 }]} 
                onPress={handleRegisterVehicle}
                disabled={loading || !fotoUri}
            >
                {loading ? (
                    <ActivityIndicator color={COLORS.whiteAreia} />
                ) : (
                    <Text style={styles.finishButtonText}>Finalizar Cadastro</Text>
                )}
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
        paddingBottom: 50,
    },
    header: {
        fontSize: 26,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        marginBottom: 30,
        textAlign: 'center',
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.grayClaro,
        marginBottom: 15,
        paddingHorizontal: 10,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 12,
        color: COLORS.blackProfissional,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rowInput: {
        flex: 1,
        marginRight: 10,
    },
    photoButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.yellowSol,
        padding: 15,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 15,
    },
    photoButtonText: {
        color: COLORS.blackProfissional,
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 10,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginTop: 15,
        resizeMode: 'cover',
    },
    finishButton: {
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 30,
        backgroundColor: COLORS.success,
    },
    finishButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    }
});

export default DriverRegistrationScreen;