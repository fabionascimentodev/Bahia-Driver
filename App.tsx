import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { NavigationContainer, ParamListBase } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, firestore } from './src/config/firebaseConfig'; // ✅ Usando 'firestore'
import { UserProfile } from './src/types/UserTypes';
import { ActivityIndicator, View, StyleSheet, Text } from 'react-native';
import { COLORS } from './src/theme/colors';
import { useUserStore } from './src/store/userStore'; // ✅ Certifique-se de importar useUserStore

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
      {/* ✅ CORREÇÃO 1: userProfile.tipo -> userProfile.perfil */}
      {userProfile.perfil === 'passageiro' ? (
        // Roteamento para Passageiro
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
        // Roteamento para Motorista
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
  const { user, setUser, isLoading, setLoading } = useUserStore(); // ✅ Importado do store

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
      if (firebaseUser) {
        // ✅ CORREÇÃO 2: Trocado 'db' por 'firestore'
        const userDocRef = doc(firestore, 'users', firebaseUser.uid); 
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          
          // ✅ CORREÇÃO 3: Trocado 'userData.tipo' por 'userData.perfil'
          if (userData.perfil) {
            registerForPushNotificationsAsync(firebaseUser.uid);
          }
          
          setUser(userData); 
        } else {
          // ✅ CORREÇÃO 4: Objeto 'setUser' ajustado para corresponder à UserProfile (sem 'telefone' e usando 'perfil')
          setUser({ 
              uid: firebaseUser.uid, 
              email: firebaseUser.email || 'N/A', 
              perfil: undefined, // Usando 'perfil' (opcional)
              nome: '', 
          }); 
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
      {/* ✅ CORREÇÃO 5: Trocado 'user.tipo' por 'user.perfil' */}
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
  }
});

export default App;