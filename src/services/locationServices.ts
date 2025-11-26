import * as Location from 'expo-location';
// Importações necessárias para o Firestore (assumidas)
import { firestore } from '../config/firebaseConfig'; 
// ✅ CORREÇÃO 1: Adicionar serverTimestamp à importação
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'; 

// Interface para coordenadas base (como as retornadas pelo GPS)
export interface Coords {
    latitude: number;
    longitude: number;
    timestamp: number; // Campo obrigatório
}



/**
 * Solicita permissão de acesso à localização do usuário.
 */
export const requestLocationPermission = async (): Promise<boolean> => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        alert('É necessário permitir o acesso à localização para usar o aplicativo.');
        return false;
    }
    return true;
};



/**
 * Obtém a localização atual do usuário.
 */
export const getCurrentLocation = async (): Promise<Coords | null> => {
    try {
        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
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
 * Busca endereços (geocoding reverso) a partir de coordenadas.
 * @param coords As coordenadas (latitude, longitude)
 */
export const reverseGeocode = async (coords: { latitude: number, longitude: number }): Promise<string> => {
    try {
        const addresses = await Location.reverseGeocodeAsync(coords);
        if (addresses.length > 0) {
            const address = addresses[0];
            // Formatação simples do endereço
            return `${address.street || 'Rua Desconhecida'}, ${address.city || 'Cidade Desconhecida'}`;
        }
        return "Endereço Desconhecido";
    } catch (error) {
        console.error("Erro no geocoding reverso:", error);
        return "Erro ao buscar endereço";
    }
};



/**
 * Busca coordenadas (geocoding) a partir de um endereço.
 * @param address O endereço ou nome do local
 */
export const geocode = async (address: string): Promise<Coords | null> => {
    try {
        const locations = await Location.geocodeAsync(address);
        if (locations.length > 0) {
            // Expo Geocoding não retorna timestamp, então simulamos ou usamos Date.now()
            return {
                latitude: locations[0].latitude,
                longitude: locations[0].longitude,
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
 * Atualiza a localização em tempo real do motorista no Firestore.
 * @param driverId UID do motorista.
 * @param coords Coordenadas de latitude e longitude.
 */
export const updateDriverLocation = async (driverId: string, coords: Coords) => {
    if (!driverId) {
        console.error("UID do motorista é inválido para atualização de localização.");
        return;
    }

    try {
        // Referência ao documento do motorista na coleção 'driversLocation'
        const driverDocRef = doc(firestore, 'driversLocation', driverId);

        // Atualiza o documento com a localização e timestamp
        await setDoc(driverDocRef, {
            latitude: coords.latitude,
            longitude: coords.longitude,
            // ✅ CORREÇÃO 2: Usando serverTimestamp() para garantir o horário do servidor
            updatedAt: serverTimestamp(),
        }, { merge: true }); // Usar merge para não apagar outros campos

    } catch (error) {
        console.error("Erro ao atualizar localização do motorista:", error);
        throw new Error("Falha ao salvar localização no banco de dados.");
    }
};