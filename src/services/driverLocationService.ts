import * as Location from 'expo-location';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { Coords } from './locationServices'; // Importamos a interface de Coords
import { unifiedLocationService } from './unifiedLocationService';

// ID para a tarefa de rastreamento (usado em ambientes de produção com expo-task-manager)
// Aqui, usaremos apenas para fins de tipagem e referência.
// const LOCATION_TRACKING_TASK = 'location-tracking'; 

/**
 * Atualiza a localização do motorista no documento da corrida no Firestore.
 * @param rideId O ID da corrida ativa.
 * @param location O objeto de localização obtido do Expo.
 */
// Throttle control: evita chamadas de rota excessivas
let lastRouteCalcTimestamp: number | null = null;
let lastRouteCalcCoords: { latitude: number; longitude: number } | null = null;

const updateDriverLocationInFirestore = async (rideId: string, location: Coords) => {
    try {
        const rideRef = doc(firestore, 'rides', rideId);
        // Atualiza a localização do motorista
        await updateDoc(rideRef, {
            motoristaLocalizacao: {
                latitude: location.latitude,
                longitude: location.longitude,
                timestamp: location.timestamp,
            }
        });

        // Decide se devemos recalcular o ETA (throttle): no mínimo a cada 10 segundos
        const now = Date.now();
        const shouldCalcRoute = (() => {
            if (!lastRouteCalcTimestamp) return true;
            const deltaMs = now - lastRouteCalcTimestamp;
            if (deltaMs < 10000) return false; // menos de 10s -> pula
            // Se o motorista moveu mais de 20 metros, recalcula mesmo que tempo < 10s
            if (lastRouteCalcCoords) {
                const dx = (location.latitude - lastRouteCalcCoords.latitude) * 111139; // approx meters per deg latitude
                const dy = (location.longitude - lastRouteCalcCoords.longitude) * 111139 * Math.cos(location.latitude * Math.PI / 180);
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist > 20) return true;
            }
            return deltaMs >= 10000;
        })();

        if (shouldCalcRoute) {
            try {
                const rideSnap = await getDoc(rideRef as any);
                if (rideSnap.exists()) {
                    const rideData: any = rideSnap.data();
                    const origem = rideData.origem;
                    if (origem && origem.latitude && origem.longitude) {
                        const route = await unifiedLocationService.calculateRoute(location as any, { latitude: origem.latitude, longitude: origem.longitude } as any);
                        if (route) {
                            await updateDoc(rideRef, {
                                driverEtaSeconds: Math.round(route.duration),
                                driverEtaMinutes: Math.ceil(route.duration / 60),
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('Erro ao calcular/atualizar ETA do motorista:', err);
            } finally {
                lastRouteCalcTimestamp = now;
                lastRouteCalcCoords = { latitude: location.latitude, longitude: location.longitude };
            }
        }
        // console.log("Localização atualizada para a corrida:", rideId);
    } catch (error) {
        console.error("Erro ao atualizar localização do motorista:", error);
    }
};

let locationSubscription: Location.LocationSubscription | null = null;
let broadcastSubscription: Location.LocationSubscription | null = null;

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

/**
 * Inicia broadcast da localização do motorista para o documento `driversLocation/{driverId}`
 * Útil quando o motorista está online e ainda não está em uma corrida.
 */
export const startBroadcastLocation = async (driverId: string): Promise<void> => {
    if (!driverId) return;

    // evita múltiplas subscriptions
    if (broadcastSubscription) return;

    broadcastSubscription = await Location.watchPositionAsync(
        {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
        },
        (location) => {
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp,
            };

            // Usa função de locationServices para atualizar driversLocation
            try {
                // Import dinâmico para evitar ciclo de dependência em tempo de build
                const { updateDriverLocation } = require('./locationServices');
                updateDriverLocation(driverId, coords).catch((e: any) => console.error(e));
            } catch (e) {
                console.error('Erro ao iniciar broadcast de localização:', e);
            }
        }
    );
};

export const stopBroadcastLocation = (): void => {
    if (broadcastSubscription) {
        broadcastSubscription.remove();
        broadcastSubscription = null;
    }
};