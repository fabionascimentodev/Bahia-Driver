import * as Location from 'expo-location';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { Coords } from './locationServices'; // Importamos a interface de Coords

// ID para a tarefa de rastreamento (usado em ambientes de produção com expo-task-manager)
// Aqui, usaremos apenas para fins de tipagem e referência.
// const LOCATION_TRACKING_TASK = 'location-tracking'; 

/**
 * Atualiza a localização do motorista no documento da corrida no Firestore.
 * @param rideId O ID da corrida ativa.
 * @param location O objeto de localização obtido do Expo.
 */
const updateDriverLocationInFirestore = async (rideId: string, location: Coords) => {
    try {
        const rideRef = doc(firestore, 'rides', rideId);
        
        await updateDoc(rideRef, {
            motoristaLocalizacao: {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: location.timestamp,
            }
        });
        // console.log("Localização atualizada para a corrida:", rideId);
    } catch (error) {
        console.error("Erro ao atualizar localização do motorista:", error);
    }
};

let locationSubscription: Location.LocationSubscription | null = null;

/**
 * Inicia o rastreamento da localização do motorista e atualiza o Firestore em tempo real.
 * Requer que a permissão de localização já tenha sido concedida.
 * @param rideId O ID da corrida ativa.
 */
export const startDriverLocationTracking = async (rideId: string): Promise<void> => {
    if (!rideId) return;

    // Configurações de rastreamento:
    // interval: 5000ms (5 segundos)
    // distanceInterval: 10 metros
    locationSubscription = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, 
            distanceInterval: 10,
        },
        (location) => {
            const newCoords: Coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp,
            };
            
            updateDriverLocationInFirestore(rideId, newCoords);
        }
    );
};

/**
 * Para o rastreamento da localização do motorista.
 */
export const stopDriverLocationTracking = (): void => {
    if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
        // console.log("Rastreamento de localização do motorista parado.");
    }
};