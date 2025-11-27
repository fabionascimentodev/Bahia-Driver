import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { updateUserProfileType } from '../../services/userServices';
import { logger } from '../../services/loggerService';

// ✅ CORREÇÃO: Tipagem correta para o AuthNavigator
type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSelection: undefined;
  DriverRegistration: undefined;
};

type Props = NativeStackScreenProps<AuthStackParamList, 'ProfileSelection'>;

const ProfileSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const user = useUserStore(state => state.user);
  const setUser = useUserStore(state => state.setUser);
  const [loading, setLoading] = useState(false);

  const handleProfileSelection = async (perfil: 'passageiro' | 'motorista') => {
    if (!user?.uid) {
      Alert.alert('Erro', 'Usuário não autenticado.');
      return;
    }

    setLoading(true);
    logger.info('PROFILE_SELECTION', 'Selecionando perfil', { perfil });

    try {
      // Atualiza o perfil no Firestore
      await updateUserProfileType(user.uid, perfil, user.nome || '', user.telefone || '');
      
      // Atualiza o estado local
      setUser({
        ...user,
        perfil,
        motoristaData: perfil === 'motorista' ? { isRegistered: false, status: 'indisponivel' } : undefined
      });

      logger.success('PROFILE_SELECTION', 'Perfil selecionado com sucesso', { perfil });

      // O App.tsx vai lidar com o redirecionamento automático
      // Se for motorista sem veículo, vai redirecionar para DriverRegistration
      // Se for passageiro ou motorista com veículo, vai para a tela principal

    } catch (error) {
      logger.error('PROFILE_SELECTION', 'Erro ao selecionar perfil', error);
      Alert.alert('Erro', 'Falha ao selecionar perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    logger.info('PROFILE_SELECTION', 'Voltando para Login');
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Botão Voltar */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.blueBahia} />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.header}>Escolha seu Perfil</Text>
        <Text style={styles.subtitle}>
          Como você gostaria de usar o Bahia Driver?
        </Text>

        {/* Card Passageiro */}
        <TouchableOpacity
          style={[styles.profileCard, { opacity: loading ? 0.6 : 1 }]}
          onPress={() => handleProfileSelection('passageiro')}
          disabled={loading}
        >
          <Ionicons name="person-outline" size={50} color={COLORS.blueBahia} />
          <Text style={styles.profileTitle}>Passageiro</Text>
          <Text style={styles.profileDescription}>
            Solicite corridas e viaje com conforto
          </Text>
          {loading && <ActivityIndicator size="small" color={COLORS.blueBahia} style={styles.loadingIndicator} />}
        </TouchableOpacity>

        {/* Card Motorista */}
        <TouchableOpacity
          style={[styles.profileCard, { opacity: loading ? 0.6 : 1 }]}
          onPress={() => handleProfileSelection('motorista')}
          disabled={loading}
        >
          <Ionicons name="car-sport-outline" size={50} color={COLORS.yellowSol} />
          <Text style={styles.profileTitle}>Motorista</Text>
          <Text style={styles.profileDescription}>
            Ofereça corridas e ganhe dinheiro
          </Text>
          {loading && <ActivityIndicator size="small" color={COLORS.yellowSol} style={styles.loadingIndicator} />}
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
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 22,
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.grayClaro,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  profileTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.blackProfissional,
    marginTop: 15,
    marginBottom: 10,
  },
  profileDescription: {
    fontSize: 14,
    color: COLORS.grayUrbano,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingIndicator: {
    marginTop: 10,
  }
});

export default ProfileSelectionScreen;