import { useState, useEffect } from 'react';
import { query, where, onSnapshot, DocumentData, orderBy, limit, collection, getDocs } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { Ride } from '../types/RideTypes';

/**
 * Hook para motoristas: escuta corridas no estado 'buscando'.
 */
export const useNewRideListener = (isAvailable: boolean) => {
  const [newRides, setNewRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAvailable) {
      setNewRides([]); // Limpa as corridas se o motorista não estiver disponível
      setLoading(false);
      return;
    }
    
    const ridesQuery = query(
      collection(firestore, 'rides'), 
      where('status', '==', 'buscando'),
      orderBy('horarios.solicitado', 'asc'), // Prioriza corridas mais antigas
      limit(5) // Limita a 5 solicitações por vez
    );

    const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      const ridesData: Ride[] = [];
      snapshot.forEach(doc => {
        ridesData.push({ rideId: doc.id, ...doc.data() } as Ride);
      });
      
      setNewRides(ridesData);
      setLoading(false);
    }, (error) => {
      console.error('Erro no Listener de Novas Corridas:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAvailable]);

  return { newRides, loading };
};