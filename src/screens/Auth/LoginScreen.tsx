import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator,
  SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { logger } from '../../services/loggerService';
import { LoginScreenProps } from '../../types/NavigationTypes';

// ✅ CORREÇÃO: Usar o tipo importado
const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useUserStore(state => state.setUser);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos.');
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
      
      let errorMessage = 'Erro ao fazer login. Tente novamente.';
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'Usuário não encontrado.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Senha incorreta.';
      }
      
      Alert.alert('Erro', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    logger.info('LOGIN', 'Navegando para SignUp');
    navigation.navigate('SignUp');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Bahia Driver</Text>
        <Text style={styles.subtitle}>Faça login para continuar</Text>

        <View style={styles.inputGroup}>
          <Ionicons name="mail-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={COLORS.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={COLORS.grayUrbano}
          />
        </View>

        <TouchableOpacity 
          style={[styles.loginButton, { opacity: loading ? 0.6 : 1 }]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.whiteAreia} />
          ) : (
            <Text style={styles.loginButtonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.signUpButton}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.signUpButtonText}>Criar nova conta</Text>
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