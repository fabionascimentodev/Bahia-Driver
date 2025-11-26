import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './src/config/firebaseConfig';
import { UserProfile } from './src/types/UserTypes';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { COLORS } from './src/theme/colors';
import { useUserStore } from './src/store/userStore';

// Telas de Autenticação
import LoginScreen from './src/screens/Auth/LoginScreen';
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
    <AuthStack.Screen name="Login" component={LoginScreen as any} />
    <AuthStack.Screen name="ProfileSelection" component={ProfileSelectionScreen as any} />
    <AuthStack.Screen 
      name="DriverRegistration" 
      component={DriverRegistrationScreen as any} 
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
        <> 
          <AppStack.Screen 
            name="HomePassageiro" 
            component={HomeScreenPassageiro as any} 
            options={{ title: 'Chamar Viagem' }} 
          />
          <AppStack.Screen 
            name="RideTracking" 
            component={RideTrackingScreen as any} 
            options={{ title: 'Acompanhar Corrida' }} 
          />
          <AppStack.Screen
            name="PostRide" 
            component={PostRideScreen as any} 
            options={{ title: 'Finalizar Viagem', headerShown: false }} 
          />
        </>
      ) : (
        <>
          <AppStack.Screen 
            name="HomeMotorista" 
            component={HomeScreenMotorista as any} 
            options={{ title: 'Área do Motorista' }} 
          />
          <AppStack.Screen 
            name="RideAction" 
            component={RideActionScreen as any} 
            options={{ title: 'Ação da Corrida' }} 
          />
        </>
      )}
    </AppStack.Navigator>
  );
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
        
        // ✅ ETAPA 1: Inicializar Logger PRIMEIRO
        console.log('🔧 Inicializando LoggerService...');
        await logger.initialize();
        
        // ✅ ETAPA 2: Logs de teste imediatos
        logger.info('APP', '=== BAHIA DRIVER INICIANDO ===');
        logger.success('APP', 'LoggerService carregado com sucesso');
        logger.info('APP', 'Iniciando bootstrap dos serviços...');
        
        // ✅ ETAPA 3: Inicializar Bootstrap
        const bootstrapSuccess = await bootstrap.initialize();
        
        if (bootstrapSuccess) {
          logger.success('APP', 'Todos os serviços inicializados');
        } else {
          logger.warn('APP', 'Bootstrap completado com avisos');
        }
        
        // ✅ ETAPA 4: Logs finais de teste
        logger.info('APP', 'Aplicativo pronto para autenticação');
        logger.debug('APP', 'Teste de debug - tudo funcionando');
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error('❌ Erro crítico:', error);
        
        // ✅ USAR O LOGGER MESMO COM ERRO
        if (logger) {
          logger.error('APP', `Falha na inicialização: ${errorMessage}`, error);
        }
        
        setBootstrapError(`Falha na inicialização: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Listener de autenticação com logs
  useEffect(() => {
    if (!logger) return;
    
    logger.info('APP', 'Configurando listener de autenticação...');

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      try {
        if (firebaseUser) {
          logger.info('AUTH', 'Usuário detectado', { uid: firebaseUser.uid, email: firebaseUser.email });
          
          const userDocRef = doc(firestore, 'users', firebaseUser.uid); 
          logger.debug('AUTH', 'Carregando dados do usuário...');
          
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data() as UserProfile;
            logger.info('AUTH', 'Dados do usuário carregados', { perfil: userData.perfil, nome: userData.nome });
            
            if (userData.perfil) {
              logger.info('AUTH', 'Registrando para notificações push...');
              await registerForPushNotificationsAsync(firebaseUser.uid);
              logger.success('AUTH', 'Notificações push registradas');
            }
            
            setUser(userData);
            logger.success('AUTH', 'Usuário autenticado com sucesso');
          } else {
            logger.warn('AUTH', 'Usuário sem perfil completo, aguardando seleção');
            
            setUser({ 
              uid: firebaseUser.uid, 
              email: firebaseUser.email || 'N/A', 
              perfil: undefined,
              nome: '', 
            }); 
          }
        } else {
          logger.info('AUTH', 'Usuário deslogado');
          setUser(null);
        }
        
        setLoading(false);
        logger.success('APP', 'Autenticação pronta');
        
      } catch (error) {
        logger.error('AUTH', 'Erro ao processar autenticação', error);
        setLoading(false);
        setBootstrapError('Erro ao autenticar');
      }
    });

    return unsubscribe;
  }, []);

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
      {user && user.perfil ? ( 
        <MainNavigator userProfile={user} />
      ) : (
        <AuthNavigator />
      )}
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