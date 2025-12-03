import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';

const PAGE_SIZE = 20;

const DriverEarningsDayScreen: React.FC = ({ route, navigation }: any) => {
  const user = useUserStore(s => s.user);
  const dateISO: string = route?.params?.dateISO;
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<any[]>([]);
  const [lastDoc, setLastDoc] = useState<any | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!dateISO || !user?.uid) {
      setLoading(false);
      return;
    }
    navigation.setOptions({ title: `Detalhes — ${new Date(dateISO).toLocaleDateString('pt-BR')}` });
    loadFirstPage();
  }, [dateISO, user]);

  const loadFirstPage = async () => {
    setLoading(true);
    try {
      setRides([]);
      setLastDoc(null);
      setHasMore(true);
      await loadPage(null);
    } catch (e) {
      console.warn('Erro ao carregar rides (first):', e);
    } finally {
      setLoading(false);
    }
  };

  const loadPage = async (cursor: any | null) => {
    try {
      const { collection, query, where, orderBy, limit, startAfter, getDocs } = require('firebase/firestore');
      const { firestore } = require('../../config/firebaseConfig');
      const ridesCol = collection(firestore, 'rides');

      const driverId = user?.uid;
      if (!driverId) return;

      const day = new Date(dateISO);
      const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0).toISOString();
      const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).toISOString();

      let q: any;
      if (cursor && lastDoc) {
        q = query(
          ridesCol,
          where('motoristaId', '==', driverId),
          where('status', '==', 'finalizada'),
          where('horaFim', '>=', startOfDay),
          where('horaFim', '<=', endOfDay),
          orderBy('horaFim', 'desc'),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          ridesCol,
          where('motoristaId', '==', driverId),
          where('status', '==', 'finalizada'),
          where('horaFim', '>=', startOfDay),
          where('horaFim', '<=', endOfDay),
          orderBy('horaFim', 'desc'),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
      setRides(prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      if (docs.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      console.warn('Erro ao carregar rides por página:', e);
      setHasMore(false);
    }
  };

  const renderRide = ({ item }: any) => {
    const when = item.horaFim ? new Date(item.horaFim) : (item.updatedAt && typeof item.updatedAt.toDate === 'function' ? item.updatedAt.toDate() : new Date());
    const timeStr = when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const origin = item.origem?.nome || item.origem?.address || 'Origem';
    const dest = item.destino?.nome || item.destino?.address || 'Destino';
    const value = Number(item.valor_motorista ?? (item.valor_total ? (item.valor_total - (item.valor_taxa || 0)) : 0)).toFixed(2);
    const payment = item.tipo_pagamento || item.paymentType || item.paymentMethod || '—';

    return (
      <View style={styles.rideItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rideTime}>{timeStr}</Text>
          <Text style={styles.rideRoute}>{origin} → {dest}</Text>
          <Text style={styles.ridePayment}>{payment}</Text>
        </View>
        <Text style={styles.rideValue}>R$ {value}</Text>
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.blueBahia} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.whiteAreia }]}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        contentContainerStyle={{ padding: 12 }}
        onEndReached={() => { if (hasMore) loadPage(lastDoc); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={{ color: COLORS.grayUrbano, textAlign: 'center', marginTop: 20 }}>Nenhuma corrida encontrada nesse dia.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rideItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.grayClaro },
  rideTime: { color: COLORS.grayUrbano, fontSize: 12 },
  rideRoute: { color: COLORS.blackProfissional, fontWeight: '600' },
  ridePayment: { color: COLORS.grayUrbano, fontSize: 12 },
  rideValue: { color: COLORS.blueBahia, fontWeight: '700', marginLeft: 8 },
});

export default DriverEarningsDayScreen;
