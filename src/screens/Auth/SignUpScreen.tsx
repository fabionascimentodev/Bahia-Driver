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
import { launchImageLibrary } from 'react-native-image-picker';
import { createUserWithEmailAndPassword, uploadUserAvatar } from '../../services/userServices';
import { Image } from 'react-native';
import { logger } from '../../services/loggerService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

// ✅ CORREÇÃO: Tipagem correta para o AuthNavigator
type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSelection: undefined;
  DriverRegistration: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

const SignUpScreen: React.FC<Props> = ({ navigation }) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cropModalVisible, setCropModalVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [currentCropType, setCurrentCropType] = useState<'square' | 'none'>('square');
  const [naturalSize, setNaturalSize] = useState<{width:number;height:number} | null>(null);
  const [containerSize, setContainerSize] = useState<{width:number;height:number}>({ width: 0, height: 0 });
  const [panState, setPanState] = useState<{positionX:number; positionY:number; scale:number}>({ positionX: 0, positionY: 0, scale: 1 });
  const imageZoomRef = useRef<any>(null);
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
      const uid = await createUserWithEmailAndPassword(email, password, nome, telefone);
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

      // ✅ NAVEGAÇÃO: Após cadastro bem-sucedido, substitui a pilha para ir direto para ProfileSelection
      // Isso garante que o usuário não possa voltar para SignUp
      logger.info('SIGN_UP', 'Navegando para ProfileSelection');
      navigation.reset({
        index: 0,
        routes: [{ name: 'ProfileSelection' }]
      });

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
    navigation.navigate('Login');
  };

  const pickAvatar = async () => {
    try {
      const options: any = { mediaType: 'photo', quality: 0.7 };
      const res: any = await new Promise((resolve) => launchImageLibrary(options, resolve));
      if (!res.didCancel && res.assets && res.assets[0]) {
        const uri = res.assets[0].uri;
        setAvatarUri(uri);
        Image.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }), (e) => { console.warn('fail getSize', e); setNaturalSize(null); });
      }
    } catch (e) {
      console.warn('Erro ao abrir seletor nativo de imagens (SignUp):', e);
    }
  };

  // cropCenter function uses dynamic require for expo-image-manipulator — safe fallback when not installed
  const cropCenter = async (uri: string) => {
    let ImageManipulator: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImageManipulator = require('expo-image-manipulator');
    } catch (e) {
      console.warn('expo-image-manipulator não instalado — usando imagem original sem crop');
      return uri;
    }

    try {
      const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), reject);
      });

      const { width, height } = size;
      const side = Math.min(width, height);
      const originX = Math.floor((width - side) / 2);
      const originY = Math.floor((height - side) / 2);

      // crop then resize to a fixed square to avoid distortion when rendering into a square avatar
      const result = await ImageManipulator.manipulateAsync(uri, [
        { crop: { originX, originY, width: side, height: side } },
        { resize: { width: 800, height: 800 } },
      ], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });

      return result.uri;
    } catch (e) {
      console.warn('Falha ao cortar imagem (SignUp):', e);
      return uri;
    }
  };

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

        {/* Modal de pré-visualização com CORTAR (visível) */}
        <Modal visible={cropModalVisible} transparent animationType="slide">
          <View style={styles.cropModalOverlay}>
            <View style={styles.cropModalContainer}>
              <View style={styles.cropTopRow}>
                <TouchableOpacity onPress={() => { setCropModalVisible(false); setTempImageUri(null); }}>
                  <Ionicons name="arrow-back" size={26} color={theme.grayUrbano} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cropTopRightButton}
                  onPress={async () => {
                    if (!tempImageUri) return;
                    // if interactive pan/zoom is available and we have measurements, use it
                    try {
                      let ImageManipulator: any = null;
                      try {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        ImageManipulator = require('expo-image-manipulator');
                      } catch (e) {
                        ImageManipulator = null;
                      }

                      // compute crop using panState & naturalSize & containerSize
                      if (ImageManipulator && naturalSize && containerSize.width > 0 && containerSize.height > 0) {
                        // containerSize is obtained from the onLayout of the render container.
                        // Use the measured values directly (don't re-multiply by the modal width factor),
                        // otherwise we double-scale and the mapping is incorrect.
                        const containerW = containerSize.width;
                        const containerH = containerSize.height;
                        const imgRatio = naturalSize.width / naturalSize.height;
                        let baseW = containerW;
                        let baseH = baseW / imgRatio;
                        if (baseH > containerH) {
                          baseH = containerH;
                          baseW = baseH * imgRatio;
                        }

                        const scale = panState.scale || 1;
                        const renderedW = baseW * scale;
                        const renderedH = baseH * scale;

                        // image position relative to container top-left
                        const imageLeft = (containerW / 2 - renderedW / 2) + panState.positionX;
                        const imageTop = (containerH / 2 - renderedH / 2) + panState.positionY;

                        // crop box centered and square
                        const cropBoxSize = Math.min(containerW, containerH) * 0.7; // visible frame size

                        // Debugging logs to help diagnose mismatches in mapping (can be removed later)
                        // eslint-disable-next-line no-console
                        console.log('SignUp CROP:', { naturalSize, containerW, containerH, panState, renderedW, renderedH, cropBoxSize });
                        const cropLeft = (containerW / 2 - cropBoxSize / 2);
                        const cropTop = (containerH / 2 - cropBoxSize / 2);

                        const offsetX = cropLeft - imageLeft;
                        const offsetY = cropTop - imageTop;

                        // factor to map displayed image pixels -> natural pixels
                        const factorX = naturalSize.width / renderedW;
                        const factorY = naturalSize.height / renderedH;

                        let originX = Math.round(offsetX * factorX);
                        let originY = Math.round(offsetY * factorY);
                        let width = Math.round(cropBoxSize * factorX);
                        let height = Math.round(cropBoxSize * factorY);

                        // clamp
                        originX = Math.max(0, Math.min(originX, naturalSize.width - 1));
                        originY = Math.max(0, Math.min(originY, naturalSize.height - 1));
                        if (originX + width > naturalSize.width) width = naturalSize.width - originX;
                        if (originY + height > naturalSize.height) height = naturalSize.height - originY;

                        const manipulated = await ImageManipulator.manipulateAsync(tempImageUri, [
                          { crop: { originX, originY, width, height } },
                          { resize: { width: 800, height: 800 } },
                        ], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });

                        setAvatarUri(manipulated.uri);
                      } else {
                        // fallback to center crop
                        const cropped = await cropCenter(tempImageUri);
                        setAvatarUri(cropped);
                      }
                    } catch (err) {
                      console.warn('Erro no crop interativo (SignUp):', err);
                      const cropped = await cropCenter(tempImageUri);
                      setAvatarUri(cropped);
                    }

                    setTempImageUri(null);
                    setCropModalVisible(false);
                  }}
                >
                  <Text style={styles.cropTopRightButtonText}>CORTAR</Text>
                </TouchableOpacity>
              </View>

                {tempImageUri ? (
                // render interactive pan/zoom area when library available
                (() => {
                  let ImagePanZoom: any = null;
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    ImagePanZoom = require('react-native-image-pan-zoom').default;
                  } catch (e) {
                    ImagePanZoom = null;
                  }

                  const cropBoxSize = Math.min(containerSize.width, containerSize.height) * 0.7;

                  if (ImagePanZoom && naturalSize && containerSize.width > 0) {
                    // compute base display size (contain)
                    const containerW = containerSize.width * 0.92;
                    const containerH = containerSize.height * 0.68;
                    const imgRatio = naturalSize.width / naturalSize.height;
                    let baseW = containerW;
                    let baseH = baseW / imgRatio;
                    if (baseH > containerH) {
                      baseH = containerH;
                      baseW = baseH * imgRatio;
                    }

                    return (
                      <View onLayout={(ev) => setContainerSize({ width: ev.nativeEvent.layout.width, height: ev.nativeEvent.layout.height })} style={{ width: '100%', alignItems: 'center' }}>
                        <ImagePanZoom
                          ref={imageZoomRef}
                          cropWidth={containerW}
                          cropHeight={containerH}
                          imageWidth={baseW}
                          imageHeight={baseH}
                          onMove={({ positionX, positionY, scale }: any) => setPanState({ positionX, positionY, scale })}
                        >
                          <Image source={{ uri: tempImageUri }} style={{ width: baseW, height: baseH }} resizeMode="contain" />
                        </ImagePanZoom>
                        {/* overlay crop frame (square) centered */}
                        <View style={{ position: 'absolute', width: cropBoxSize, height: cropBoxSize, borderWidth: 2, borderColor: '#fff', borderRadius: cropBoxSize/2 }} pointerEvents="none" />
                      </View>
                    );
                  }

                  // fallback: just render the image when pan/zoom not available
                  return <Image source={{ uri: tempImageUri }} style={[styles.cropPreviewImage, { height: Math.round(Math.min(420, 0.6 * avatarPreviewSize * 4)) }]} resizeMode="contain" />;
                })()
              ) : null}

              <View style={styles.cropActionRow}>
                <TouchableOpacity style={[styles.cropActionButton, { backgroundColor: theme.grayClaro }]} onPress={() => { if (tempImageUri) setAvatarUri(tempImageUri); setTempImageUri(null); setCropModalVisible(false); }}>
                  <Text style={[styles.cropActionText, { color: theme.blackProfissional }]}>ACEITAR</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cropActionButton, { backgroundColor: theme.danger }]} onPress={() => { setTempImageUri(null); setCropModalVisible(false); }}>
                  <Text style={styles.cropActionText}>CANCELAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

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
  cropActionRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  cropActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cropActionText: { color: COLORS.whiteAreia, fontWeight: '700' },
  cropTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6 },
  cropTopRightButton: { backgroundColor: COLORS.blueBahia, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  cropTopRightButtonText: { color: COLORS.whiteAreia, fontWeight: '700' },
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