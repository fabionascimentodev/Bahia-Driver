import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './src/config/firebaseConfig';
import { UserProfile } from './src/types/UserTypes';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
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

// Serviços
import { registerForPushNotificationsAsync } from './src/services/notificationService';
import { logger } from './src/services/loggerService';
import { bootstrap } from './src/services/bootstrapService';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();

// --- Roteamento de Autenticação ---
const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
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

// --- Roteamento Principal (Passageiro vs. Motorista) ---
const MainNavigator = ({ userProfile }: { userProfile: UserProfile }) => {
  return (
    <AppStack.Navigator 
      screenOptions={{ 
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.blueBahia }, 
        headerTintColor: COLORS.whiteAreia, 
        headerTitleStyle: { fontWeight: 'bold' } 
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
        </>
      )}
    </AppStack.Navigator>
  );
};

// ✅ FUNÇÃO AUXILIAR: Verifica se motorista precisa de cadastro de veículo
const needsVehicleRegistration = (user: UserProfile | null): boolean => {
  if (!user || user.perfil !== 'motorista') {
    return false;
  }
  
  // ✅ VERIFICAÇÃO CORRIGIDA: motorista sem veículo registrado
  const hasVehicleData = user.motoristaData?.veiculo?.modelo && 
                        user.motoristaData?.veiculo?.placa && 
                        user.motoristaData?.veiculo?.cor && 
                        user.motoristaData?.veiculo?.ano;
  
  const isRegistered = user.motoristaData?.isRegistered;
  
  logger.debug('APP', 'Verificação de cadastro de veículo', {
    perfil: user.perfil,
    hasVehicleData,
    isRegistered,
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
              needsVehicleRegistration: needsVehicleRegistration(completeUserData)
            });
            
            if (completeUserData.perfil) {
              await registerForPushNotificationsAsync(firebaseUser.uid);
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
      return <AuthNavigator />;
    }

    // ✅ Motorista sem veículo registrado → DriverRegistrationScreen
    if (needsVehicleRegistration(user)) {
      logger.info('APP', 'Redirecionando para cadastro de veículo', {
        nome: user.nome,
        perfil: user.perfil
      });
      return (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen 
            name="DriverRegistration" 
            component={DriverRegistrationScreen}
          />
        </AppStack.Navigator>
      );
    }

    // ✅ Usuário com perfil definido e cadastro completo → MainNavigator
    if (user.perfil) {
      return <MainNavigator userProfile={user} />;
    }

    // ✅ Usuário sem perfil definido → AuthNavigator (para escolher perfil)
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
      {getCurrentScreen()}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
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