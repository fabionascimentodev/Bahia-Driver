import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, firestore } from './src/config/firebaseConfig';
import { UserProfile } from './src/types/UserTypes';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from './src/theme/colors';
import { useUserStore } from './src/store/userStore';

// Telas de Autenticação
import LoginScreen from './src/screens/Auth/LoginScreen';
import SignUpScreen from './src/screens/Auth/SignUpScreen';
import ProfileSelectionScreen from './src/screens/Auth/ProfileSelectionScreen';
import DriverRegistrationScreen from './src/screens/Auth/DriverRegistrationScreen';

// Telas Principais
import HomeScreenPassageiro from './src/screens/Passenger/HomeScreenPassageiro';
import HomeScreenMotorista from './src/screens/Driver/HomeScreenMotorista';
import RideTrackingScreen from './src/screens/Passenger/RideTrackingScreen';
import RideActionScreen from './src/screens/Driver/RideActionScreen';
import PostRideScreen from './src/screens/Passenger/PostRideScreen';
import ChatScreen from './src/screens/Chat/ChatScreen';

// Serviços
import { registerForPushNotificationsAsync } from './src/services/notificationService';
import Constants from 'expo-constants';
import { logger } from './src/services/loggerService';
import { bootstrap } from './src/services/bootstrapService';

// Tipos
import { AuthStackParamList, AppStackParamList } from './src/types/NavigationTypes';

// ✅ CORREÇÃO: Criar os navigators com os tipos corretos
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

// --- Roteamento de Autenticação ---
type AuthNavigatorProps = {
  initialRouteName?: keyof AuthStackParamList;
};

const AuthNavigator: React.FC<AuthNavigatorProps> = ({ initialRouteName = 'Login' }) => (
  <AuthStack.Navigator 
    screenOptions={{ headerShown: false, headerTitleAlign: 'center' }}
    initialRouteName={initialRouteName}
  >
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    <AuthStack.Screen name="ProfileSelection" component={ProfileSelectionScreen} />
    <AuthStack.Screen 
      name="DriverRegistration" 
      component={DriverRegistrationScreen} 
      options={{ 
        headerShown: true, 
        title: 'Cadastro de Motorista', 
        headerStyle: { backgroundColor: COLORS.blueBahia }, 
        headerTintColor: COLORS.whiteAreia 
      }}
    />
  </AuthStack.Navigator>
);

// ✅ Navigator específico para cadastro de motorista
const DriverRegistrationNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen 
      name="DriverRegistration" 
      component={DriverRegistrationScreen}
      options={{ 
        headerShown: true, 
        headerTitleAlign: 'center',
        title: 'Cadastro de Motorista', 
        headerStyle: { backgroundColor: COLORS.blueBahia }, 
        headerTintColor: COLORS.whiteAreia 
      }}
    />
  </AuthStack.Navigator>
);

// --- Roteamento Principal (Passageiro vs. Motorista) ---
const MainNavigator = ({ userProfile }: { userProfile: UserProfile }) => {
  return (
    <AppStack.Navigator 
      screenOptions={{ 
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.blueBahia }, 
        headerTintColor: COLORS.whiteAreia, 
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitleAlign: 'center'
      }}
    >
      {userProfile.perfil === 'passageiro' ? (
        // Passageiro
        <> 
          <AppStack.Screen 
            name="HomePassageiro" 
            component={HomeScreenPassageiro} 
            options={{ title: 'Chamar Viagem' }} 
          />
          <AppStack.Screen 
            name="RideTracking" 
            component={RideTrackingScreen} 
            options={{ title: 'Acompanhar Corrida' }} 
          />
          <AppStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <AppStack.Screen
            name="PostRide" 
            component={PostRideScreen} 
            options={{ title: 'Finalizar Viagem', headerShown: false }} 
          />
        </>
      ) : (
        // Motorista
        <>
          <AppStack.Screen 
            name="HomeMotorista" 
            component={HomeScreenMotorista} 
            options={{ title: 'Área do Motorista' }} 
          />
          <AppStack.Screen 
            name="RideAction" 
            component={RideActionScreen} 
            options={{ title: 'Ação da Corrida' }} 
          />
          <AppStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
        </>
      )}
    </AppStack.Navigator>
  );
};

// ✅ FUNÇÃO AUXILIAR CORRIGIDA: Verifica se motorista precisa de cadastro de veículo
const needsVehicleRegistration = (user: UserProfile | null): boolean => {
  if (!user || user.perfil !== 'motorista') {
    return false;
  }
  
  const hasVehicleData = user.motoristaData?.veiculo?.modelo && 
                        user.motoristaData?.veiculo?.placa && 
                        user.motoristaData?.veiculo?.cor && 
                        user.motoristaData?.veiculo?.ano;
  
  const isRegistered = user.motoristaData?.isRegistered;
  
  logger.debug('APP', 'Verificação de cadastro de veículo', {
    perfil: user.perfil,
    hasVehicleData: !!hasVehicleData,
    isRegistered: !!isRegistered,
    motoristaData: user.motoristaData,
    needsRegistration: !hasVehicleData || !isRegistered
  });
  
  return !hasVehicleData || !isRegistered;
};

// --- Componente Principal App ---
const App = () => {
  const { user, setUser, isLoading, setLoading } = useUserStore();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Inicializar Bootstrap na primeira renderização
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        
        await logger.initialize();
        logger.info('APP', '=== BAHIA DRIVER INICIANDO ===');
        logger.success('APP', 'LoggerService carregado com sucesso');
        
        const bootstrapSuccess = await bootstrap.initialize();
        
        if (bootstrapSuccess) {
          logger.success('APP', 'Todos os serviços inicializados');
        } else {
          logger.warn('APP', 'Bootstrap completado com avisos');
        }
        
        logger.info('APP', 'Aplicativo pronto para autenticação');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        logger.error('APP', `Falha na inicialização: ${errorMessage}`, error);
        setBootstrapError(`Falha na inicialização: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Restaurar usuário persistido localmente (se houver) rapidamente
  useEffect(() => {
    const restoreLocalUser = async () => {
      try {
        const cached = await AsyncStorage.getItem('@bahia_driver_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          // Apenas restaura se ainda estivermos em estado inicial (user undefined)
          if (!user) {
            setUser(parsed);
            logger.info('APP', 'Usuário restaurado do cache local (visual)');
          }
        }
      } catch (e) {
        // não falhar a inicialização por conta do cache
      }
    };

    restoreLocalUser();
  }, []);

  // Listener de autenticação
  useEffect(() => {
    logger.info('APP', 'Configurando listener de autenticação...');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      try {
        setLoading(true);
        
        if (firebaseUser) {
          logger.info('AUTH', 'Usuário autenticado detectado', { 
            uid: firebaseUser.uid, 
            email: firebaseUser.email 
          });
          
          const userDocRef = doc(firestore, 'users', firebaseUser.uid); 
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            const completeUserData: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nome: userData.nome || '',
              telefone: userData.telefone || '',
              perfil: userData.perfil,
              motoristaData: userData.motoristaData,
              createdAt: userData.createdAt?.toDate?.(),
              updatedAt: userData.updatedAt?.toDate?.(),
            };
            
            logger.info('AUTH', 'Dados do usuário carregados', { 
              perfil: completeUserData.perfil, 
              nome: completeUserData.nome,
              motoristaData: completeUserData.motoristaData,
              needsVehicleRegistration: needsVehicleRegistration(completeUserData)
            });
            
            // ✅ CORREÇÃO: Registrar push token para TODOS os usuários autenticados
            try {
              if (Constants.appOwnership === 'expo') {
                logger.warn('PUSH_TOKEN', 'Executando em Expo Go — pulando registro de push. Use um development build para testar push.');
              } else {
                const pushToken = await registerForPushNotificationsAsync(firebaseUser.uid);
                if (pushToken) {
                  logger.success('PUSH_TOKEN', 'Token registrado com sucesso', {
                    userId: firebaseUser.uid,
                    perfil: completeUserData.perfil
                  });
                }
              }
            } catch (error) {
              logger.error('PUSH_TOKEN', 'Erro ao registrar token', error);
            }
            
            setUser(completeUserData);
            
          } else {
            logger.warn('AUTH', 'Usuário sem perfil no Firestore - criando perfil básico');
            
            const basicUserData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              nome: '',
              telefone: '',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            await setDoc(userDocRef, basicUserData);
            
            setUser({ 
              uid: firebaseUser.uid, 
              email: firebaseUser.email || '', 
              nome: '',
              telefone: '',
              perfil: undefined,
            }); 
          }
        } else {
          logger.info('AUTH', 'Nenhum usuário autenticado');
          setUser(null);
        }
        
      } catch (error) {
        logger.error('AUTH', 'Erro ao processar autenticação', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // ✅ LÓGICA DE REDIRECIONAMENTO CORRIGIDA
  const getCurrentScreen = () => {
    if (!user) {
      logger.debug('APP', 'Nenhum usuário - mostrando AuthNavigator (Login)');
      return <AuthNavigator initialRouteName="Login" />;
    }

    // ✅ Usuário sem perfil definido → AuthNavigator com ProfileSelection como rota inicial
    if (!user.perfil) {
      logger.debug('APP', 'Usuário sem perfil - mostrando AuthNavigator (ProfileSelection)');
      return <AuthNavigator initialRouteName="ProfileSelection" />;
    }

    // ✅ NOVO: Se é passageiro, vai direto para MainNavigator (PassageiroFlow)
    if (user.perfil === 'passageiro') {
      logger.info('APP', 'Passageiro detectado - redirecionando para MainNavigator', {
        nome: user.nome,
        perfil: user.perfil
      });
      return <MainNavigator userProfile={user} />;
    }

    // ✅ Motorista sem veículo registrado → DriverRegistrationNavigator (DIRETO para cadastro)
    if (user.perfil === 'motorista' && needsVehicleRegistration(user)) {
      logger.info('APP', 'Motorista sem veículo - mostrando DriverRegistrationNavigator', {
        nome: user.nome,
        perfil: user.perfil,
        motoristaData: user.motoristaData
      });
      return <DriverRegistrationNavigator />;
    }

    // ✅ Motorista com veículo registrado → MainNavigator (MotoristaFlow)
    if (user.perfil === 'motorista' && !needsVehicleRegistration(user)) {
      logger.info('APP', 'Motorista com veículo - redirecionando para MainNavigator', {
        nome: user.nome,
        perfil: user.perfil,
        hasVehicle: true
      });
      return <MainNavigator userProfile={user} />;
    }

    // ✅ Fallback (não deveria chegar aqui, mas se chegar, mostra Auth)
    logger.warn('APP', 'Estado indeterminado - mostrando AuthNavigator', { perfil: user.perfil });
    return <AuthNavigator />;
  };

  // Se houver erro crítico, mostrar tela de erro
  if (bootstrapError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>❌ Erro de Inicialização</Text>
        <Text style={styles.errorMessage}>{bootstrapError}</Text>
        <Text style={styles.errorHint}>Verifique os logs para mais informações</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.blueBahia} />
        <Text style={{ color: COLORS.blueBahia, marginTop: 10 }}>Carregando Bahia Driver...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <View style={styles.container}>
        {getCurrentScreen()}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.whiteAreia,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.whiteAreia,
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.blueBahia,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  }
});

export default App;