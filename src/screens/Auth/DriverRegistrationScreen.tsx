import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator, 
  Image,
  SafeAreaView 
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { saveDriverVehicleData, uploadVehiclePhoto, VehicleData } from '../../services/userServices';
import { logger } from '../../services/loggerService';

// ✅ CORREÇÃO: Tipagem correta para o AuthNavigator
type AuthStackParamList = {
    Login: undefined;
    SignUp: undefined;
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
            logger.info('DRIVER_REGISTRATION', 'Foto do veículo selecionada');
        }
    };

    // 2. Função de finalização do cadastro - CORRIGIDA
    const handleRegisterVehicle = async () => {
        if (!user?.uid) {
            Alert.alert('Erro', 'Usuário não autenticado.');
            logger.error('DRIVER_REGISTRATION', 'Tentativa de cadastro sem usuário autenticado');
            return;
        }

        const anoNum = parseInt(ano, 10);
        if (!modelo || !placa || !cor || isNaN(anoNum) || !fotoUri) {
            Alert.alert('Atenção', 'Preencha todos os dados do veículo e selecione a foto.');
            logger.warn('DRIVER_REGISTRATION', 'Campos obrigatórios não preenchidos', { 
                modelo, placa, cor, ano, hasPhoto: !!fotoUri 
            });
            return;
        }
        
        setLoading(true);
        let photoUrl = '';

        try {
            logger.info('DRIVER_REGISTRATION', 'Iniciando cadastro do veículo', { 
                modelo, placa, cor, ano: anoNum 
            });
            
            // 2.1. Upload da foto para Firebase Storage
            logger.info('DRIVER_REGISTRATION', 'Fazendo upload da foto para Storage');
            photoUrl = await uploadVehiclePhoto(user.uid, fotoUri, placa);

            // 2.2. Prepara os dados
            const vehicleData: VehicleData = {
                modelo,
                placa: placa.toUpperCase(),
                cor,
                ano: anoNum,
                fotoUrl: photoUrl,
            };

            // 2.3. Salva os dados do veículo e finaliza o registro
            logger.info('DRIVER_REGISTRATION', 'Salvando dados do veículo no Firestore');
            await saveDriverVehicleData(user.uid, vehicleData);

            logger.success('DRIVER_REGISTRATION', 'Cadastro do motorista concluído com sucesso', { 
                placa: vehicleData.placa 
            });
            
            // ✅ CORREÇÃO: Navegação para ProfileSelection para forçar o App.tsx reavaliar o fluxo
            Alert.alert(
                'Sucesso!', 
                'Cadastro finalizado. Você será redirecionado para a tela inicial.',
                [
                    { 
                        text: 'OK', 
                        onPress: () => {
                            logger.info('DRIVER_REGISTRATION', 'Navegando para ProfileSelection após cadastro');
                            // ✅ Navega para ProfileSelection para forçar o App.tsx reavaliar o estado do usuário
                            navigation.navigate('ProfileSelection');
                        }
                    }
                ]
            );

        } catch (error) {
            console.error('Erro no registro do veículo:', error);
            logger.error('DRIVER_REGISTRATION', 'Falha no cadastro do veículo', error);
            Alert.alert('Erro', 'Falha ao finalizar o cadastro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Função para voltar
    const handleBack = () => {
        logger.info('DRIVER_REGISTRATION', 'Voltando para ProfileSelection');
        navigation.navigate('ProfileSelection');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.container}>
                {/* ✅ BOTÃO VOLTAR ADICIONADO */}
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={handleBack}
                    disabled={loading}
                >
                    <Ionicons name="arrow-back" size={24} color={COLORS.blueBahia} />
                    <Text style={styles.backButtonText}>Voltar</Text>
                </TouchableOpacity>

                <Text style={styles.header}>Dados do Veículo</Text>
                <Text style={styles.subtitle}>
                    Para se tornar um Bahia Driver, precisamos dos dados do seu veículo.
                </Text>

                {/* Input Modelo */}
                <View style={styles.inputGroup}>
                    <Ionicons name="car-sport-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Modelo do Veículo (Ex: Hyundai HB20)"
                        value={modelo}
                        onChangeText={setModelo}
                        placeholderTextColor={COLORS.grayUrbano}
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
                        placeholderTextColor={COLORS.grayUrbano}
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
                            placeholderTextColor={COLORS.grayUrbano}
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
                            placeholderTextColor={COLORS.grayUrbano}
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
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
        paddingBottom: 50,
    },
    // ✅ BOTÃO VOLTAR
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 20,
        padding: 8,
    },
    backButtonText: {
        color: COLORS.blueBahia,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 5,
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
        lineHeight: 20,
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
        marginBottom: 15,
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
        marginBottom: 15,
        resizeMode: 'cover',
    },
    finishButton: {
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: COLORS.success,
    },
    finishButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    }
});

export default DriverRegistrationScreen;