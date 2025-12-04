import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../theme/colors';
import { DriverRegistrationScreenProps } from '../../types/NavigationTypes';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { createUserWithEmailAndPassword, uploadUserAvatar } from '../../services/userServices';
import { logger } from '../../services/loggerService';
import { resetRootWhenAvailable, navigateRootWhenAvailable, navigateToRoute } from '../../services/navigationService';

const DriverRegistrationScreen: React.FC<DriverRegistrationScreenProps> = ({ navigation, route }) => {
  const theme = COLORS;
  const { footerBottom } = useResponsiveLayout();

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permissão para acessar fotos é necessária para enviar o avatar.');
        return;
      }
      // Use built-in editor of expo-image-picker for a simple square crop
      const res: any = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true, aspect: [1, 1] });
      if (!res.canceled && res.assets && res.assets.length > 0 && res.assets[0].uri) {
        setAvatarUri(res.assets[0].uri);
      }
    } catch (e) {
      console.warn('Erro ao selecionar avatar:', e);
    }
  };

  // Note: cropping handled by expo-image-picker's built-in editor (allowsEditing)

  const validateFields = (): boolean => {
    if (!nome.trim() || !telefone.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios.');
      return false;
    }
    if (!avatarUri) {
      Alert.alert('Atenção', 'A foto do perfil é obrigatória.');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    return true;
  };

  const handleCreatePassageiro = async () => {
    if (!validateFields()) return;
    setLoading(true);
    try {
      logger.info('DRIVER_REG', 'Criando conta como passageiro (pré-cadastro)');
      const uid = await createUserWithEmailAndPassword(email.trim(), password, nome.trim(), telefone.trim(), 'passageiro');
      if (avatarUri) {
        try { await uploadUserAvatar(uid, avatarUri); } catch (e) { logger.warn('DRIVER_REG', 'Falha ao enviar avatar', e); }
      }

      Alert.alert('Bem-vindo', 'Cadastro concluído como passageiro.');
      // Redirecionar para HomePassageiro (App.tsx irá ajustar via listener)
      try {
        const ok = await resetRootWhenAvailable('HomePassageiro', { timeoutMs: 5000, intervalMs: 120 });
        if (!ok) await navigateRootWhenAvailable('HomePassageiro', undefined, { timeoutMs: 3000, intervalMs: 100 });
      } catch (e) {
        // fallback silencioso — o auth listener deve cuidar da renderização correta
        console.warn('DriverRegistration: falha ao navegar diretamente para HomePassageiro', e);
      }
    } catch (e) {
      console.error('Erro ao criar passageiro:', e);
      Alert.alert('Erro', 'Não foi possível criar a conta. Tente novamente.');
    } finally { setLoading(false); }
  };

  const handleCreateMotoristaContinue = () => {
    if (!validateFields()) return;
    // Navegar para CarRegistration passando os dados pré-preenchidos (não cria conta ainda)
    const payload = { nome: nome.trim(), telefone: telefone.trim(), email: email.trim(), password, avatarUri: avatarUri || undefined };
    logger.info('DRIVER_REG', 'Navegando para CarRegistration com prefill (motorista)');
    navigation.navigate('CarRegistration' as any, { prefillPersonal: payload });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.whiteAreia }]}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: footerBottom + 20 }]}> 
        <TouchableOpacity style={styles.back} onPress={() => { try { navigateToRoute(navigation, 'Login'); } catch (e) { try { navigation.navigate('Login'); } catch (_) {} } }}>
          <Ionicons name="arrow-back" size={22} color={theme.blueBahia} />
          <Text style={{ color: theme.blueBahia, marginLeft: 8 }}>Voltar</Text>
        </TouchableOpacity>

        <Text style={[styles.header, { color: theme.blueBahia }]}>Criar Conta</Text>
        <Text style={styles.subtitle}>Preencha seus dados e envie uma foto para continuar</Text>

        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={20} color={theme.blueBahia} style={styles.icon} />
          <TextInput placeholder="Nome completo" value={nome} onChangeText={setNome} style={styles.input} placeholderTextColor={theme.grayUrbano} />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="call-outline" size={20} color={theme.blueBahia} style={styles.icon} />
          <TextInput placeholder="Telefone" value={telefone} onChangeText={setTelefone} style={styles.input} keyboardType="phone-pad" placeholderTextColor={theme.grayUrbano} />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={20} color={theme.blueBahia} style={styles.icon} />
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} style={styles.input} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={theme.grayUrbano} />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={20} color={theme.blueBahia} style={styles.icon} />
          <TextInput placeholder="Senha" value={password} onChangeText={setPassword} secureTextEntry style={styles.input} placeholderTextColor={theme.grayUrbano} />
        </View>

        <TouchableOpacity style={[styles.avatarButton, { borderColor: theme.blueBahia }]} onPress={pickAvatar}>
          <Ionicons name="image-outline" size={20} color={theme.blueBahia} />
          <Text style={styles.avatarButtonText}>{avatarUri ? 'Avatar Selecionado' : 'Enviar Foto (Obrigatória)'}</Text>
        </TouchableOpacity>

        {avatarUri && (
          <View style={[styles.avatarPreviewContainer, { width: 120, height: 120, borderRadius: 60 }]}>
            <Image source={{ uri: avatarUri }} style={styles.avatarPreviewImage} />
          </View>
        )}

        {/* Using expo-image-picker built-in editor; crop modal removed */}

        {/* Dois quadrados clicáveis com marca-d'água */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
          <TouchableOpacity
            onPress={handleCreatePassageiro}
            style={[styles.choiceBox, styles.choicePassenger]}
            activeOpacity={0.75}
            disabled={loading}
            accessibilityLabel="Criar conta como passageiro"
          >
            <Text style={styles.watermark}>PASSAGEIRO</Text>
            <Ionicons name="person-outline" size={36} color={COLORS.blueBahia} style={styles.choiceIcon} />
            {loading ? <ActivityIndicator color={COLORS.blueBahia} /> : <Text style={styles.choiceTitle}>Criar como Passageiro</Text>}
            <Text style={styles.choiceSubtitle}>Conta imediata — sem cadastro de veículo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCreateMotoristaContinue}
            style={[styles.choiceBox, styles.choiceDriver]}
            activeOpacity={0.75}
            disabled={loading}
            accessibilityLabel="Criar conta como motorista"
          >
            <Text style={styles.watermark}>MOTORISTA</Text>
            <Ionicons name="car-sport" size={36} color={COLORS.yellowSol} style={styles.choiceIcon} />
            <Text style={styles.choiceTitle}>Criar como Motorista</Text>
            <Text style={styles.choiceSubtitle}>Você continuará para cadastrar o veículo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  subtitle: { textAlign: 'center', color: COLORS.grayUrbano, marginBottom: 12 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.grayClaro, padding: 10, borderRadius: 8, marginBottom: 10 },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: COLORS.blackProfissional },
  avatarButton: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 8, borderWidth: 1 },
  avatarButtonText: { marginLeft: 10, color: COLORS.blueBahia, fontWeight: '600' },
  avatarPreviewContainer: { overflow: 'hidden', alignSelf: 'center', marginTop: 12 },
  avatarPreviewImage: { width: '100%', height: '100%' },
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
  },
  cropPreviewImage: { width: '100%', height: 280, borderRadius: 8, backgroundColor: '#000' },
  cropActionButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cropActionText: { color: COLORS.whiteAreia, fontWeight: '700' },
  cropActionRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 8 },
  choiceBox: { flex: 1, padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.grayClaro },
  choiceText: { fontWeight: '700', color: COLORS.blackProfissional },
  choiceIcon: { marginBottom: 8 },
  choiceTitle: { fontWeight: '700', color: COLORS.blackProfissional, fontSize: 16 },
  choiceSubtitle: { color: COLORS.grayUrbano, fontSize: 12, marginTop: 6, textAlign: 'center' },
  watermark: {
    position: 'absolute',
    fontSize: 36,
    color: 'rgba(0,0,0,0.06)',
    transform: [{ rotate: '-18deg' }],
    top: 8,
    left: 6,
    zIndex: 0,
  },
  choicePassenger: {
    backgroundColor: 'rgba(0,82,155,0.04)',
    borderColor: 'rgba(0,82,155,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  choiceDriver: {
    backgroundColor: 'rgba(255,193,7,0.04)',
    borderColor: 'rgba(255,193,7,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
});

export default DriverRegistrationScreen;
