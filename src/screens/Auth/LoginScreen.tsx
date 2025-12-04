import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Image,
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  Dimensions,
  type AlertButton
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { logger } from '../../services/loggerService';
import { LoginScreenProps } from '../../types/NavigationTypes';
import { TouchableOpacity as RNTouchableOpacity } from 'react-native';

// ✅ FUNÇÃO AUXILIAR: Validar email
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// ✅ CORREÇÃO: Usar o tipo importado
const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const setUser = useUserStore(state => state.setUser);
  const theme = COLORS;

  const handleLogin = async () => {
    // ✅ VALIDAÇÃO: Verificar campos vazios
    let hasError = false;
    setEmailError(false);
    setPasswordError(false);

    if (!email.trim()) {
      setEmailError(true);
      hasError = true;
    } else if (!isValidEmail(email)) {
      setEmailError(true);
      Alert.alert('Email Inválido', 'Por favor, insira um email válido.');
      return;
    }

    if (!password.trim()) {
      setPasswordError(true);
      hasError = true;
    } else if (password.length < 6) {
      setPasswordError(true);
      Alert.alert('Senha Inválida', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (hasError) {
      Alert.alert('Campos Obrigatórios', 'Por favor, preencha todos os campos corretamente.');
      return;
    }

    setLoading(true);
    logger.info('LOGIN', 'Tentativa de login', { email });

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      logger.success('LOGIN', 'Login bem-sucedido', { 
        email: user.email, 
        uid: user.uid 
      });
      
      // O listener de auth no App.tsx vai lidar com o redirecionamento
      
    } catch (error: any) {
      logger.error('LOGIN', 'Falha no login', error);
      
      let title = 'Erro ao Fazer Login';
      let errorMessage = 'Erro desconhecido. Tente novamente.';
      let buttons: AlertButton[] = [
        { text: 'OK', style: 'default' }
      ];

      // ✅ TRATAMENTO DETALHADO DE ERROS
      if (error.code === 'auth/invalid-email') {
        title = '❌ Email Inválido';
        errorMessage = 'O email informado não é válido. Por favor, verifique e tente novamente.';
      } else if (error.code === 'auth/user-not-found') {
        title = '❌ Usuário Não Encontrado';
        errorMessage = 'Este email não está cadastrado no sistema. Deseja criar uma conta?';
        buttons = [
          { text: 'Cancelar', style: 'cancel' },
          { 
            text: 'Criar Conta', 
            onPress: () => {
              setEmail('');
              setPassword('');
              navigation.navigate('SignUp');
            }
          }
        ];
      } else if (error.code === 'auth/wrong-password') {
        title = '❌ Senha Incorreta';
        errorMessage = 'A senha informada está incorreta. Por favor, verifique e tente novamente.';
        buttons = [
          { text: 'OK', style: 'default' },
          // { text: 'Recuperar Senha', style: 'default' } // Futura implementação
        ];
      } else if (error.code === 'auth/invalid-credential') {
        title = '❌ Credenciais Inválidas';
        errorMessage = 'Email ou senha incorretos. Verifique seus dados e tente novamente.';
      } else if (error.code === 'auth/too-many-requests') {
        title = '⏱️ Muitas Tentativas';
        errorMessage = 'Você fez muitas tentativas de login. Tente novamente mais tarde.';
      } else if (error.code === 'auth/user-disabled') {
        title = '🚫 Conta Desativada';
        errorMessage = 'Esta conta foi desativada. Entre em contato com o suporte.';
      } else if (error.code === 'auth/network-request-failed') {
        title = '🌐 Erro de Conexão';
        errorMessage = 'Verifique sua conexão com a internet e tente novamente.';
      }
      
      Alert.alert(title, errorMessage, buttons);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    logger.info('LOGIN', 'Navegando para fluxo de cadastro (UserRegistration pre-signup)');
    setEmail('');
    setPassword('');
    // Inicia o fluxo de cadastro passando pelo DriverRegistration (modo preSignup)
    navigation.navigate('UserRegistration', { preSignup: true });
  };

  const handlePhoneLogin = () => {
    navigation.navigate('PhoneLogin');
  };

  // Responsivo: ajustar dimensão do logo conforme largura da tela (muito maior)
  const screenWidth = Dimensions.get('window').width;
  const logoWidth = Math.min(1400, Math.round(screenWidth * 0.995));
  const logoHeight = Math.max(140, Math.round(logoWidth * 0.5));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.whiteAreia }]}>
      <View style={[styles.container, { backgroundColor: theme.whiteAreia }]}>
        <Image
          source={require('../../../assets/logo-bahia-driver-azul.png')}
          style={[styles.logo, { width: logoWidth, height: logoHeight, tintColor: theme.blueBahia }]}
          resizeMode="contain"
          accessible
          accessibilityLabel="Logo Bahia Driver"
        />
        <Text style={[styles.subtitle, { color: theme.grayUrbano }]}>Faça login para continuar</Text>

        {/* Email Input */}
        <View style={[styles.inputGroup, emailError && styles.inputGroupError]}>
          <Ionicons name="mail-outline" size={24} color={emailError ? '#e74c3c' : theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (emailError) setEmailError(false);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={theme.grayUrbano}
            editable={!loading}
          />
          {emailError && <Ionicons name="alert-circle" size={20} color="#e74c3c" />}
        </View>

        {/* Password Input */}
        <View style={[styles.inputGroup, passwordError && styles.inputGroupError]}>
          <Ionicons name="lock-closed-outline" size={24} color={passwordError ? '#e74c3c' : theme.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (passwordError) setPasswordError(false);
            }}
            secureTextEntry
            placeholderTextColor={theme.grayUrbano}
            editable={!loading}
          />
          {passwordError && <Ionicons name="alert-circle" size={20} color="#e74c3c" />}
        </View>

        <TouchableOpacity 
          style={[styles.loginButton, { backgroundColor: theme.blueBahia, opacity: loading ? 0.6 : 1 }]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.whiteAreia} />
          ) : (
            <Text style={[styles.loginButtonText, { color: theme.whiteAreia }]}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.signUpButton, { borderColor: theme.blueBahia }]}
          onPress={handleSignUp}
          disabled={loading}
        >
            <Text style={[styles.signUpButtonText, { color: theme.blueBahia }]}>Criar nova conta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.signUpButton, { borderColor: theme.blueBahia, marginTop: 8 }]} onPress={handlePhoneLogin} disabled={loading}>
          <Text style={[styles.signUpButtonText, { color: theme.blueBahia }]}>Entrar com telefone (SMS)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.whiteAreia,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: COLORS.whiteAreia,
  },
  header: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.blueBahia,
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.grayUrbano,
    marginBottom: 40,
    textAlign: 'center',
  },
  logo: {
    width: 280,
    height: 96,
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 30,
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
  inputGroupError: {
    borderColor: '#e74c3c',
    backgroundColor: 'rgba(231, 76, 60, 0.05)',
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
  loginButton: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
    backgroundColor: COLORS.blueBahia,
  },
  loginButtonText: {
    color: COLORS.whiteAreia,
    fontWeight: 'bold',
    fontSize: 18,
  },
  signUpButton: {
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.blueBahia,
  },
  signUpButtonText: {
    color: COLORS.blueBahia,
    fontWeight: 'bold',
    fontSize: 16,
  }
});

export default LoginScreen;