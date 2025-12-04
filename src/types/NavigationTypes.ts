// src/types/NavigationTypes.ts
import { NativeStackScreenProps } from '@react-navigation/native-stack';

// Tipos para o AuthNavigator
export type AuthStackParamList = {
  Login: undefined;
  SignUp: { preferredProfile?: 'passageiro' | 'motorista'; vehicleData?: any } | undefined;
  PhoneLogin: undefined;
  PhoneLink: { phone?: string } | undefined;
  // ProfileSelection removed - profile choice happens inside SignUp now
  // DriverRegistration pode receber dados quando usado antes do signup (preSignup)
  UserRegistration: { preSignup?: boolean; vehicleData?: any } | undefined;
  CarRegistration: { prefillPersonal?: { nome: string; telefone: string; email: string; password: string; avatarUri?: string }; existingUser?: boolean } | undefined;
  // SignUp pode receber dados pré-preenchidos (vehicle / preferredProfile)
  // (mantido acima)
};


// Tipos para o AppNavigator (MainNavigator)
export type AppStackParamList = {
  HomePassageiro: undefined;
  // CarRegistration também pode ser exibida depois do signup (via fluxo auth ou app)
  CarRegistration: { prefillPersonal?: { nome: string; telefone: string; email: string; password: string; avatarUri?: string }; existingUser?: boolean; vehicleData?: any } | undefined;
  HomeMotorista: undefined;

  // === CORRIGIDO ===
  // Essas telas recebem parâmetros!
  RideTracking: { rideId: string };
  RideAction: { rideId: string };
  Chat: { rideId: string };
  PostRide: { rideId: string };
  DriverPostRide: { rideId: string };
  // Profile screens (optional userId param to view others' profiles)
  PassengerProfile: { userId?: string } | undefined;
  DriverProfile: { userId?: string } | undefined;
  DriverEarnings: undefined;
  DriverEarningsDay: { dateISO: string } | undefined;
};

// Props types para cada tela do Auth
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;
export type SignUpScreenProps = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;
export type UserRegistrationScreenProps = NativeStackScreenProps<AuthStackParamList, 'UserRegistration'>;
export type CarRegistrationScreenProps = NativeStackScreenProps<AuthStackParamList, 'CarRegistration'>;

// Props types para o AppNavigator
export type HomePassageiroScreenProps = NativeStackScreenProps<AppStackParamList, 'HomePassageiro'>;
export type HomeMotoristaScreenProps = NativeStackScreenProps<AppStackParamList, 'HomeMotorista'>;

// === CORRIGIDO ===
export type RideTrackingScreenProps = NativeStackScreenProps<AppStackParamList, 'RideTracking'>;
export type RideActionScreenProps = NativeStackScreenProps<AppStackParamList, 'RideAction'>;
export type PostRideScreenProps = NativeStackScreenProps<AppStackParamList, 'PostRide'>;
export type DriverPostRideScreenProps = NativeStackScreenProps<AppStackParamList, 'DriverPostRide'>;
export type PassengerProfileScreenProps = NativeStackScreenProps<AppStackParamList, 'PassengerProfile'>;
export type DriverProfileScreenProps = NativeStackScreenProps<AppStackParamList, 'DriverProfile'>;
export type DriverEarningsScreenProps = NativeStackScreenProps<AppStackParamList, 'DriverEarnings'>;
