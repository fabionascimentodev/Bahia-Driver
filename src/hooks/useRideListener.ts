import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
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
    
    // Tentamos usar a consulta composta (eficiente). Se Firestore requerer um índice
    // composto, caímos para um listener mais simples e filtramos no cliente.
    const ridesQuery = query(
      collection(firestore, 'rides'), 
      where('status', '==', 'buscando'),
      where('visibleToDrivers', '==', true),
      orderBy('horarios.solicitado', 'asc'), // Prioriza corridas mais antigas
      limit(5) // Limita a 5 solicitações por vez
    );

    const alertedCanceledIds = useRef(new Set<string>());

    let unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
      try {
        const changes = snapshot.docChanges();
        changes.forEach((change) => {
          if (change.type === 'removed') {
            const rideId = change.doc.id;
            const data = change.doc.data() as any;
            if (!alertedCanceledIds.current.has(rideId)) {
              if (data?.status === 'cancelada' || data?.canceladoPor || data?.visibleToDrivers === false) {
                alertedCanceledIds.current.add(rideId);
                Alert.alert('Corrida cancelada pelo passageiro');
              }
            }
          }
        });
      } catch (e) {
        // ignore if docChanges not available
      }

      const ridesData: Ride[] = [];
      snapshot.forEach(doc => {
        ridesData.push({ rideId: doc.id, ...doc.data() } as Ride);
      });
      setNewRides(ridesData);
      setLoading(false);
    }, (error) => {
      console.error('Erro no Listener de Novas Corridas (composto):', error);
      const msg = error?.message || String(error);
      if (msg.includes('requires an index') || msg.includes('índice')) {
        console.warn('Listener composto requisitou índice; registrando listener fallback sem índice.');
        if (unsubscribe) unsubscribe();
        const simpleQuery = query(
          collection(firestore, 'rides'),
          where('status', '==', 'buscando'),
          limit(50)
        );
        unsubscribe = onSnapshot(simpleQuery, (snap2) => {
          try {
            const changes = snap2.docChanges();
            changes.forEach((change) => {
              if (change.type === 'removed') {
                const rideId = change.doc.id;
                const data = change.doc.data() as any;
                if (!alertedCanceledIds.current.has(rideId)) {
                  if (data?.status === 'cancelada' || data?.canceladoPor || data?.visibleToDrivers === false) {
                    alertedCanceledIds.current.add(rideId);
                    console.info('Corrida cancelada pelo passageiro - rideId:', rideId);
                  }
                }
              }
            });
          } catch (e) {
            // ignore if docChanges not supported
          }

          const arr: Ride[] = [];
          snap2.forEach(d => {
            const data = { rideId: d.id, ...d.data() } as Ride & any;
            if (data.visibleToDrivers !== false) arr.push(data as Ride);
          });
          // ordenar por solicitacao se existir
          arr.sort((a: any, b: any) => {
            const ta = a.horarios?.solicitado?.toMillis ? a.horarios.solicitado.toMillis() : (a.horarios?.solicitado ? new Date(a.horarios.solicitado).getTime() : 0);
            const tb = b.horarios?.solicitado?.toMillis ? b.horarios.solicitado.toMillis() : (b.horarios?.solicitado ? new Date(b.horarios.solicitado).getTime() : 0);
            return ta - tb; // asc
          });
          setNewRides(arr);
          setLoading(false);
        }, (err2) => {
          console.error('Erro no listener fallback:', err2);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => { if (unsubscribe) unsubscribe(); };
  }, [isAvailable]);

  return { newRides, loading };
};