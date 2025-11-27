import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { createUserWithEmailAndPassword } from '../../services/userServices';
import { logger } from '../../services/loggerService';

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
      // Cria o usuário (o perfil será definido depois)
      await createUserWithEmailAndPassword(email, password, nome, telefone, 'passageiro');
      
      logger.success('SIGN_UP', 'Cadastro realizado com sucesso', { email });
      
      Alert.alert(
        'Sucesso!',
        'Cadastro realizado com sucesso. Faça login para continuar.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Botão Voltar */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.blueBahia} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Criar Conta</Text>
        <Text style={styles.subtitle}>Preencha seus dados para se cadastrar</Text>

        <View style={styles.inputGroup}>
          <Ionicons name="person-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Nome completo"
            value={nome}
            onChangeText={setNome}
            placeholderTextColor={COLORS.grayUrbano}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons name="call-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Telefone"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
            placeholderTextColor={COLORS.grayUrbano}
          />
        </View>

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

        <View style={styles.inputGroup}>
          <Ionicons name="lock-closed-outline" size={24} color={COLORS.blueBahia} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholderTextColor={COLORS.grayUrbano}
          />
        </View>

        <TouchableOpacity 
          style={[styles.signUpButton, { opacity: loading ? 0.6 : 1 }]} 
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.whiteAreia} />
          ) : (
            <Text style={styles.signUpButtonText}>Criar Conta</Text>
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
});

export default SignUpScreen;