import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { rootNavigationRef } from './src/services/navigationService';
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
import PhoneLoginScreen from './src/screens/Auth/PhoneLoginScreen';
import PhoneLinkScreen from './src/screens/Auth/PhoneLinkScreen';
import ProfileSelectionScreen from './src/screens/Auth/ProfileSelectionScreen';
import DriverRegistrationScreen from './src/screens/Auth/DriverRegistrationScreen';
import CarRegistrationScreen from './src/screens/Driver/CarRegistrationScreen';

// Telas Principais
import HomeScreenPassageiro from './src/screens/Passenger/HomeScreenPassageiro';
import HomeScreenMotorista from './src/screens/Driver/HomeScreenMotorista';
import RideTrackingScreen from './src/screens/Passenger/RideTrackingScreen';
import RideActionScreen from './src/screens/Driver/RideActionScreen';
import PostRideScreen from './src/screens/Passenger/PostRideScreen';
import DriverPostRideScreen from './src/screens/Driver/DriverPostRideScreen';
import ChatScreen from './src/screens/Chat/ChatScreen';
import DriverProfileScreen from './src/screens/Driver/DriverProfileScreen';
import PassengerProfileScreen from './src/screens/Passenger/PassengerProfileScreen';
import DriverEarningsScreen from './src/screens/Driver/DriverEarningsScreen';

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
    <AuthStack.Screen name="SignUp" component={SignUpScreen as any} />
    <AuthStack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <AuthStack.Screen name="PhoneLink" component={PhoneLinkScreen} />
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
    <AuthStack.Screen
      name="CarRegistration"
      component={CarRegistrationScreen as any}
      options={{ headerShown: true, title: 'Cadastro do Veículo', headerStyle: { backgroundColor: COLORS.blueBahia }, headerTintColor: COLORS.whiteAreia }}
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
  const modoAtualRoot = (userProfile as any).modoAtual || 'passageiro';
  // Decide initial route for motorista: se não precisa registrar veículo, abrir HomeMotorista
  const initialRouteForMotorista = needsVehicleRegistration(userProfile) ? 'CarRegistration' : 'HomeMotorista';

  return (
    <AppStack.Navigator 
      initialRouteName={modoAtualRoot === 'motorista' && userProfile.perfil === 'motorista' ? initialRouteForMotorista as any : 'HomePassageiro'}
      screenOptions={{ 
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.blueBahia }, 
        headerTintColor: COLORS.whiteAreia, 
        headerTitleStyle: { fontWeight: 'bold' },
        headerTitleAlign: 'center'
      }}
    >
      

      {modoAtualRoot === 'passageiro' || userProfile.perfil !== 'motorista' ? (
        // Passageiro
        <> 
          <AppStack.Screen 
            name="HomePassageiro" 
            component={HomeScreenPassageiro} 
            options={{ title: 'Chamar Viagem' }} 
          />
          <AppStack.Screen
            name="CarRegistration"
            component={CarRegistrationScreen as any}
            options={{ title: 'Cadastro do Veículo', headerShown: true, headerStyle: { backgroundColor: COLORS.blueBahia }, headerTintColor: COLORS.whiteAreia }}
          />
          <AppStack.Screen name="PassengerProfile" component={PassengerProfileScreen} options={{ title: 'Perfil' }} />
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
            name="CarRegistration"
            component={CarRegistrationScreen as any}
            options={{ title: 'Cadastro do Veículo' , headerShown: true, headerStyle: { backgroundColor: COLORS.blueBahia }, headerTintColor: COLORS.whiteAreia}}
          />
          <AppStack.Screen 
            name="HomeMotorista" 
            component={HomeScreenMotorista} 
            options={{ title: 'Área do Motorista' }} 
          />
            <AppStack.Screen name="DriverProfile" component={DriverProfileScreen} options={{ title: 'Perfil' }} />
            <AppStack.Screen name="DriverEarnings" component={DriverEarningsScreen} options={{ title: 'Ganhos' }} />
            <AppStack.Screen name="DriverEarningsDay" component={require('./src/screens/Driver/DriverEarningsDayScreen').default} options={{ title: 'Detalhes do Dia' }} />
          <AppStack.Screen 
            name="RideAction" 
            component={RideActionScreen} 
            options={{ title: 'Ação da Corrida' }} 
          />
          <AppStack.Screen name="DriverPostRide" component={DriverPostRideScreen} options={{ title: 'Finalizar Viagem', headerShown: false }} />
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

  // Priorizar a flag isRegistered: se o servidor já marcou o motorista como
  // registrado, não forçar o fluxo de cadastro novamente mesmo que alguns
  // campos do veículo estejam faltando no cache/local.
  const isRegistered = Boolean(user.motoristaData?.isRegistered);

  const hasVehicleData = Boolean(
    user.motoristaData?.veiculo?.modelo &&
    user.motoristaData?.veiculo?.placa &&
    user.motoristaData?.veiculo?.cor &&
    user.motoristaData?.veiculo?.ano
  );

  const needsRegistration = !isRegistered && !hasVehicleData;

  logger.debug('APP', 'Verificação de cadastro de veículo', {
    perfil: user.perfil,
    hasVehicleData,
    isRegistered,
    motoristaData: user.motoristaData,
    needsRegistration
  });

  return needsRegistration;
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
              // Garantir modoAtual com valor padrão 'passageiro' na primeira vez
              const modoAtualFromDoc = userData.modoAtual || 'passageiro';

              const completeUserData: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                nome: userData.nome || '',
                telefone: userData.telefone || '',
                perfil: userData.perfil,
                motoristaData: userData.motoristaData,
                modoAtual: modoAtualFromDoc,
                createdAt: userData.createdAt?.toDate?.(),
                updatedAt: userData.updatedAt?.toDate?.(),
              };

              // Se não havia modoAtual no doc, escrevemos o padrão 'passageiro'
              if (!userData.modoAtual) {
                try {
                  await setDoc(userDocRef, { modoAtual: 'passageiro' }, { merge: true });
                  logger.debug('AUTH', 'modoAtual padrão salvo (passageiro)', { uid: firebaseUser.uid });
                } catch (e) {
                  logger.warn('AUTH', 'Falha ao salvar modoAtual padrão', e);
                }
              }
            
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
    // Decidir fluxo usando `modoAtual` salvo no perfil (fallback: 'passageiro')
    const modoAtual = (user as UserProfile).modoAtual || 'passageiro';

    if (modoAtual === 'motorista' && user.perfil === 'motorista') {
      // Motorista: checar necessidade de cadastro de veículo
      if (needsVehicleRegistration(user)) {
        logger.info('APP', 'Motorista sem veículo - mostrando DriverRegistrationNavigator', {
          nome: user.nome,
          perfil: user.perfil,
          motoristaData: user.motoristaData
        });
        return <DriverRegistrationNavigator />;
      }

      logger.info('APP', 'Modo motorista detectado - redirecionando para MainNavigator (Motorista)', {
        nome: user.nome,
        perfil: user.perfil
      });

      return <MainNavigator userProfile={user} />;
    }

    // Padrão: Passageiro
    logger.info('APP', 'Modo passageiro detectado - redirecionando para MainNavigator (Passageiro)', {
      nome: user.nome,
      perfil: user.perfil
    });
    return <MainNavigator userProfile={user} />;

    // ✅ Fallback (não deveria chegar aqui, mas se chegar, mostra Auth)
    logger.warn('APP', 'Estado indeterminado - mostrando AuthNavigator', { perfil: user?.perfil });
    return <AuthNavigator />;
  };

  // Se houver erro crítico, mostrar tela de erro
  const theme = COLORS;

  if (bootstrapError) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.whiteAreia }]}>
        <Text style={styles.errorTitle}>❌ Erro de Inicialização</Text>
        <Text style={styles.errorMessage}>{bootstrapError}</Text>
        <Text style={styles.errorHint}>Verifique os logs para mais informações</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.whiteAreia }]}> 
        <ActivityIndicator size="large" color={theme.blueBahia} />
        <Text style={{ color: theme.blueBahia, marginTop: 10 }}>Carregando Bahia Driver...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={rootNavigationRef}>
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