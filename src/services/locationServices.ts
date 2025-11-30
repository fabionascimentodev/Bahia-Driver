import * as Location from 'expo-location';
import { calculateFare } from '../utils/fareCalculator';

// Firestore
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { firestore } from '../config/firebaseConfig';

// Interface base de coordenadas
export interface Coords {
    latitude: number;
    longitude: number;
    timestamp?: number;
    nome?: string;
}

/**
 * Solicita permissão de acesso à localização.
 */
export const requestLocationPermission = async (): Promise<boolean> => {
    try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            alert('É necessário permitir o acesso à localização.');
            return false;
        }
        return true;
    } catch (error) {
        console.error("Erro ao solicitar permissão:", error);
        return false;
    }
};

/**
 * Obtém a localização atual do usuário.
 */
export const getCurrentLocation = async (): Promise<Coords | null> => {
    try {
        const hasPermission = await requestLocationPermission();
        if (!hasPermission) return null;

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
        };
    } catch (error) {
        console.error("Erro ao obter localização:", error);
        return null;
    }
};

/**
 * Geocoding reverso com OSM (gratuito).
 */
export const reverseGeocode = async (coords: Coords): Promise<string> => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&accept-language=pt-BR`;

        const response = await fetch(url);
        const data = await response.json();

        if (data?.display_name) return data.display_name;

        // fallback
        const fallback = await Location.reverseGeocodeAsync(coords);
        if (fallback.length > 0) {
            const addr = fallback[0];
            return `${addr.street || ""}, ${addr.city || ""}`;
        }

        return "Endereço não encontrado";
    } catch (error) {
        console.error("Erro no geocoding reverso:", error);
        return "Endereço desconhecido";
    }
};

/**
 * Busca coordenadas a partir de um endereço.
 */
export const geocode = async (address: string): Promise<Coords | null> => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=pt-BR`;

        const response = await fetch(url);
        const data = await response.json();

        if (data?.length > 0) {
            return {
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                timestamp: Date.now(),
            };
        }

        // fallback
        const expo = await Location.geocodeAsync(address);
        if (expo.length > 0) {
            return {
                latitude: expo[0].latitude,
                longitude: expo[0].longitude,
                timestamp: Date.now(),
            };
        }

        return null;
    } catch (error) {
        console.error("Erro no geocoding:", error);
        return null;
    }
};

/**
 * Autocomplete de lugares (OSM).
 */
export const searchPlaces = async (query: string, userLocation?: Coords) => {
    try {
        let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            query
        )}&limit=8&accept-language=pt-BR`;

        if (userLocation) {
            url += `&viewbox=${userLocation.longitude - 0.1},${userLocation.latitude - 0.1},${userLocation.longitude + 0.1},${userLocation.latitude + 0.1}&bounded=1`;
        }

        const response = await fetch(url);
        const data = await response.json();

        return (data || []).map((item: any, index: number) => ({
            id: item.place_id || `p-${index}-${Date.now()}`,
            name: (item.display_name || "").split(",")[0],
            address: item.display_name,
            coords: {
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                timestamp: Date.now(),
            },
        }));
    } catch (error) {
        console.error("Erro no autocomplete:", error);
        return [];
    }
};

/**
 * Calcula distância entre dois pontos (Haversine).
 */
export const calculateDistance = (a: Coords, b: Coords): number => {
    const R = 6371;
    const dLat = (b.latitude - a.latitude) * (Math.PI / 180);
    const dLon = (b.longitude - a.longitude) * (Math.PI / 180);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(a.latitude * (Math.PI / 180)) *
            Math.cos(b.latitude * (Math.PI / 180)) *
            Math.sin(dLon / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
};

/**
 * Calcula preço estimado.
 */
export const calculateEstimatedPrice = (
    distanceKm: number,
    minutes?: number,
    highDemand: boolean = false
): number => {
    try {
        const fare = calculateFare({ km: distanceKm, minutes: minutes ?? 0, highDemand });
        return fare.total;
    } catch (err) {
        console.error('Erro ao calcular tarifa (fareCalculator):', err);
        // fallback para fórmula antiga caso algo dê errado
        const basePrice = 5;
        const pricePerKm = 2.5;
        return Number((basePrice + distanceKm * pricePerKm).toFixed(2));
    }
};

/**
 * Atualiza localização do motorista no Firestore.
 */
export const updateDriverLocation = async (driverId: string, coords: Coords) => {
    if (!driverId) return;

    try {
        const ref = doc(firestore, "driversLocation", driverId);

        await setDoc(
            ref,
            {
                latitude: coords.latitude,
                longitude: coords.longitude,
                updatedAt: serverTimestamp(),
            },
            { merge: true }
        );
    } catch (error) {
        console.error("Erro ao atualizar localização:", error);
    }
};

/**
 * Rastreia localização em tempo real.
 */
export const startLocationTracking = (
    onLocationUpdate: (coords: Coords) => void,
    onError?: (err: any) => void
) => {
    let watch: Location.LocationSubscription | null = null;

    const start = async () => {
        try {
            const ok = await requestLocationPermission();
            if (!ok) return;

            watch = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: 5000,
                    distanceInterval: 10,
                },
                (loc) => {
                    onLocationUpdate({
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude,
                        timestamp: loc.timestamp,
                    });
                }
            );
        } catch (err) {
            console.error("Erro no tracking:", err);
            onError?.(err);
        }
    };

    start();

    return () => {
        if (watch) {
            watch.remove();
            watch = null;
        }
    };
};
