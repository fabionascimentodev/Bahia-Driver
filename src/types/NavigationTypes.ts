// src/types/NavigationTypes.ts
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Tipos para o AuthNavigator
export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ProfileSelection: undefined;
  DriverRegistration: undefined;
};

// Tipos para o AppNavigator (MainNavigator)
export type AppStackParamList = {
  HomePassageiro: undefined;
  HomeMotorista: undefined;

  // === CORRIGIDO ===
  // Essas telas recebem parâmetros!
  RideTracking: { rideId: string };
  RideAction: { rideId: string };
  PostRide: { rideId: string };
};

// Props types para cada tela do Auth
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
export type ProfileSelectionScreenProps = NativeStackScreenProps<AuthStackParamList, 'ProfileSelection'>;
export type DriverRegistrationScreenProps = NativeStackScreenProps<AuthStackParamList, 'DriverRegistration'>;

// Props types para o AppNavigator
export type HomePassageiroScreenProps = NativeStackScreenProps<AppStackParamList, 'HomePassageiro'>;
export type HomeMotoristaScreenProps = NativeStackScreenProps<AppStackParamList, 'HomeMotorista'>;

// === CORRIGIDO ===
export type RideTrackingScreenProps = NativeStackScreenProps<AppStackParamList, 'RideTracking'>;
export type RideActionScreenProps = NativeStackScreenProps<AppStackParamList, 'RideAction'>;
export type PostRideScreenProps = NativeStackScreenProps<AppStackParamList, 'PostRide'>;
