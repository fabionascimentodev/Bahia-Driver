import { useState, useEffect } from 'react';
import { doc, onSnapshot, DocumentData } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { Coords } from '../services/locationServices';

/**
 * Hook para escutar a localização em tempo real de um motorista específico.
 * Usa um Firestore Listener.
 * @param driverId O UID do motorista cuja localização queremos rastrear.
 */
export const useRealtimeLocation = (driverId: string | null) => {
  const [location, setLocation] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) {
      setLocation(null);
      return;
    }

    // 1. Cria a referência para o documento do motorista
    const locationRef = doc(firestore, 'driversLocation', driverId);

    // 2. Inicia o listener em tempo real
    const unsubscribe = onSnapshot(
      locationRef, 
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as DocumentData;
          // 3. Atualiza o estado com a nova coordenada
          setLocation({
            latitude: data.latitude,
            longitude: data.longitude,
            timestamp: data.timestamp,
          });
          setError(null);
        } else {
          // O motorista não está enviando localização (ficou indisponível, por exemplo)
          setLocation(null);
          setError(`Motorista ${driverId} sem dados de localização.`);
        }
      }, 
      (firebaseError) => {
        // Trata erros do listener (ex: permissão negada, problema de conexão)
        console.error("Erro no Firestore Listener:", firebaseError);
        setError("Erro ao rastrear a localização.");
      }
    );

    // 4. Retorna a função de limpeza (unsubscribe)
    return () => unsubscribe();
  }, [driverId]); // O listener reinicia se o driverId mudar

  return { location, error };
};