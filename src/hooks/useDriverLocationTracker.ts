import { useEffect, useState, useRef } from 'react';
import * as Location from 'expo-location';
import { useUserStore } from '../store/userStore';
import { updateDriverLocation, Coords } from '../services/locationServices';
import { auth } from '../config/firebaseConfig';

const TRACKING_INTERVAL_MS = 5000; // Intervalo de 5 segundos para atualização

/**
 * Hook para rastrear e enviar a localização do motorista continuamente para o Firestore.
 * @param isTracking Indica se o rastreamento deve estar ativo (baseado no status 'disponivel').
 */
export const useDriverLocationTracker = (isTracking: boolean) => {
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const user = useUserStore(state => state.user);
  const driverId = auth.currentUser?.uid;

  useEffect(() => {
    // 💡 CORREÇÃO APLICADA: Substituindo 'user?.tipo' por 'user?.perfil'
    if (!driverId || user?.perfil !== 'motorista') {
      console.warn("Usuário não é motorista ou não está logado.");
      return;
    }

    const startTracking = async () => {
      // 1. Verifica se tem permissão (necessário, mas já feito na tela principal)
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.error('Permissão de localização não concedida para rastreamento.');
        return;
      }
      
      // 2. Inicia o loop de rastreamento
      intervalRef.current = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            // Otimização: Removendo timeInterval, pois setInterval já controla a frequência
          });
          
          const newCoords: Coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          };
          
          setCurrentLocation(newCoords);
          
          // 3. Envia para o Firestore
          if (isTracking) {
             await updateDriverLocation(driverId, newCoords);
          }

        } catch (error) {
          console.error("Erro no loop de rastreamento:", error);
        }
      }, TRACKING_INTERVAL_MS);
      
      console.log(`Rastreamento iniciado para ${driverId} a cada ${TRACKING_INTERVAL_MS}ms.`);
    };
    
    // 4. Lógica de Iniciar/Parar
    if (isTracking && !intervalRef.current) {
      startTracking();
    } else if (!isTracking && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log(`Rastreamento parado para ${driverId}.`);
    }

    // 5. Limpeza ao desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isTracking, driverId, user?.perfil]); // 💡 CORREÇÃO AQUI

  return currentLocation;
};