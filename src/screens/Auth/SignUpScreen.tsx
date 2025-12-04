import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import * as ImagePicker from 'expo-image-picker';
import { createUserWithEmailAndPassword, uploadUserAvatar, uploadVehiclePhoto, uploadCnhPhoto, uploadAntecedenteFile, saveDriverVehicleData } from '../../services/userServices';
import type { VehicleData } from '../../services/userServices';
import { Image } from 'react-native';
import { logger } from '../../services/loggerService';
import { navigateToRoute } from '../../services/navigationService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

// ✅ CORREÇÃO: Tipagem correta para o AuthNavigator
type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  PhoneLogin: undefined;
  PhoneLink: { phone?: string } | undefined;
  ProfileSelection: undefined;
  DriverRegistration: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

function SignUpScreen({ navigation, route }: Props) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const { footerBottom, screenWidth } = useResponsiveLayout();
  const theme = COLORS;
  const avatarPreviewSize = Math.round(Math.min(120, screenWidth * 0.28));

  const handleSignUp = async () => {
    if (!nome || !telefone || !email || !password || !confirmPassword) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    logger.info('SIGN_UP', 'Tentativa de cadastro', { email, nome });

    try {
      // ✅ CORREÇÃO: Cria o usuário SEM perfil definido - o perfil será escolhido na próxima tela
      // If preferredProfile provided (from prefill), pass it to creation so Firestore doc gets perfil
      const preferredProfile = (route?.params as any)?.preferredProfile as 'passageiro' | 'motorista' | undefined;
      const vehicleDataParam = (route?.params as any)?.vehicleData as any | undefined;

      const uid = await createUserWithEmailAndPassword(email, password, nome, telefone, preferredProfile);
      // Se o usuário selecionou avatar, faz upload e salva no perfil
      if (avatarUri) {
        try {
          await uploadUserAvatar(uid, avatarUri);
        } catch (err: any) {
          logger.warn('SIGN_UP', 'Falha ao enviar avatar, continuando sem avatar', err);
          // Mostrar mensagem amigável ao usuário explicando que o upload falhou
          const message = err?.message || String(err);
          if (message.toLowerCase().includes('permission') || message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('permiss')) {
            Alert.alert(
              'Aviso: não foi possível enviar sua foto',
              'Não foi possível enviar sua foto para o servidor (permissões do Firebase Storage). Seu cadastro será concluído sem avatar. Você pode adicionar a foto depois nas configurações do perfil.',
              [{ text: 'OK' }]
            );
          } else {
            // Erro genérico
            Alert.alert('Aviso', 'Não foi possível enviar sua foto. O cadastro continuará sem avatar.');
          }
        }
      }
      
      logger.success('SIGN_UP', 'Cadastro realizado com sucesso', { email });
      // Se vieram dados de veículo (preSignup), fazemos os uploads e salvamos os dados agora que temos UID
      if (vehicleDataParam) {
        try {
          const payload: Partial<VehicleData> = {
            modelo: vehicleDataParam.modelo,
            placa: vehicleDataParam.placa,
            cor: vehicleDataParam.cor,
            ano: vehicleDataParam.ano,
          } as any;

          // Upload foto do veículo
          if (vehicleDataParam.fotoUri) {
            try {
              const url = await uploadVehiclePhoto(uid, vehicleDataParam.fotoUri, vehicleDataParam.placa);
              payload.fotoUrl = url;
            } catch (err) {
              logger.warn('SIGN_UP', 'Falha ao enviar foto do veículo (continuando)', err);
            }
          }

          // Upload CNH
          if (vehicleDataParam.cnhUri) {
            try {
              const url = await uploadCnhPhoto(uid, vehicleDataParam.cnhUri);
              payload.cnhUrl = url;
            } catch (err) {
              logger.warn('SIGN_UP', 'Falha ao enviar CNH (continuando)', err);
            }
          }

          // Upload antecedente
          if (vehicleDataParam.antecedenteFileUri) {
            try {
              const url = await uploadAntecedenteFile(uid, vehicleDataParam.antecedenteFileUri, vehicleDataParam.antecedenteFileName);
              payload.antecedenteFileUrl = url;
            } catch (err) {
              logger.warn('SIGN_UP', 'Falha ao enviar arquivo de antecedentes (continuando)', err);
            }
          }

          // Salva os dados do veículo no Firestore
          try {
            await saveDriverVehicleData(uid, payload as VehicleData);
            logger.success('SIGN_UP', 'Dados do veículo salvos após criação de usuário', { uid });
          } catch (err) {
            logger.warn('SIGN_UP', 'Falha ao salvar dados do veículo após criação de usuário', err);
          }

        } catch (err) {
          logger.warn('SIGN_UP', 'Erro no processamento de vehicleData após criação', err);
        }
      }

      // ✅ NAVEGAÇÃO: Após cadastro bem-sucedido, vamos para `ProfileSelection` para o usuário escolher modo
      logger.info('SIGN_UP', 'Navegando para ProfileSelection');
      navigation.reset({ index: 0, routes: [{ name: 'ProfileSelection' }] });

    } catch (error: any) {
      logger.error('SIGN_UP', 'Falha no cadastro', error);
      
      let errorMessage = 'Erro ao criar conta. Tente novamente.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este email já está em uso.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha é muito fraca.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    logger.info('SIGN_UP', 'Voltando para Login');
    try { navigateToRoute(navigation, 'Login'); } catch (e) { try { navigation.navigate('Login'); } catch(_) {} }
  };

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permissão para acessar a galeria é necessária para adicionar uma foto.');
        return;
      }

      const res: any = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7, allowsEditing: true, aspect: [1, 1] });
      if (!res.canceled && res.assets && res.assets.length > 0 && res.assets[0].uri) {
        const uri = res.assets[0].uri;
        setAvatarUri(uri);
      }
    } catch (e) {
      console.warn('Erro ao abrir seletor nativo de imagens (SignUp):', e);
    }
  };

  // Cropping handled by the system editor via expo-image-picker (allowsEditing)

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.whiteAreia }] }>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: footerBottom + 20, backgroundColor: theme.whiteAreia }]}>
        {/* Botão Voltar */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={theme.blueBahia} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={[styles.header, { color: theme.blueBahia }]}>Criar Conta</Text>
        <Text style={[styles.subtitle, { color: theme.grayUrbano }]}>Preencha seus dados para se cadastrar</Text>

        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={24} color={theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            value={nome}
            onChangeText={setNome}
            placeholderTextColor={theme.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="call-outline" size={24} color={theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Telefone"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            placeholderTextColor={theme.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={24} color={theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={theme.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={24} color={theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={theme.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={24} color={theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={theme.grayUrbano}
          />
        </View>

        <TouchableOpacity style={[styles.avatarButton, { borderColor: theme.blueBahia }]} onPress={pickAvatar} disabled={loading}>
          <Ionicons name="image-outline" size={20} color={theme.blueBahia} />
          <Text style={styles.avatarButtonText}>{avatarUri ? 'Avatar Selecionado' : 'Adicionar Foto (Opcional)'}</Text>
        </TouchableOpacity>

        {avatarUri && (
          <View style={[styles.avatarPreviewContainer, { width: avatarPreviewSize, height: avatarPreviewSize, borderRadius: Math.round(avatarPreviewSize/2) }]}>
            <Image source={{ uri: avatarUri }} style={styles.avatarPreviewImage} resizeMode="cover" />
          </View>
        )}

        {/* cropping handled by expo-image-picker editor (allowsEditing) - modal removed */}

        <TouchableOpacity 
          style={[styles.signUpButton, { opacity: loading ? 0.6 : 1, backgroundColor: theme.blueBahia }]} 
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.whiteAreia} />
          ) : (
            <Text style={[styles.signUpButtonText, { color: theme.whiteAreia }]}>Criar Conta</Text>
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
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 30,
    padding: 8,
  },
  backButtonText: {
    color: COLORS.blueBahia,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.blueBahia,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
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
  signUpButton: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    backgroundColor: COLORS.blueBahia,
  },
  signUpButtonText: {
    color: COLORS.whiteAreia,
    fontWeight: 'bold',
    fontSize: 18,
  }
  ,
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grayClaro,
    marginBottom: 10,
  },
  avatarButtonText: {
    marginLeft: 10,
    color: COLORS.blueBahia,
    fontWeight: '600'
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignSelf: 'center',
    marginBottom: 15,
  }
  ,
  cropModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropModalContainer: {
    width: '92%',
    backgroundColor: COLORS.whiteAreia,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    maxHeight: '90%'
  },
  cropPreviewImage: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#000',
    marginVertical: 8,
  },
  // crop modal styles removed - using system editor
  avatarPreviewContainer: {
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 15,
  },
  avatarPreviewImage: {
    width: '100%',
    height: '100%',
  },
});

export default SignUpScreen;