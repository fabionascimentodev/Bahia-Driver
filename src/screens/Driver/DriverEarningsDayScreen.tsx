import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';

/*
  NOTE: This screen queries `rides` for a driver within a date range using `horaFim`.
  Firestore may require a composite index when combining equality filters with range
  filters and orderBy on `horaFim`. See `FIRESTORE_INDEXES.md` at the repo root for the
  recommended index configuration.

  The implementation tries the precise range query first (fast, indexed). If that
  fails (e.g. composite index missing), it falls back to a safer client-side filter
  — fetching a reasonably-sized batch and filtering by date locally to ensure the
  UI still shows results instead of being empty.
*/

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
    // Keep header generic; show the actual date/time on each ride item
    navigation.setOptions({ title: 'Detalhes' });
    loadFirstPage();
  }, [dateISO, user]);

  const parseHoraFim = (r: any): Date | null => {
    if (!r) return null;
    const hf = r.horaFim;
    if (!hf) {
      // try updatedAt Timestamp
      // try updatedAt, createdAt or other timestamp fields
      if (r.updatedAt && typeof r.updatedAt.toDate === 'function') return r.updatedAt.toDate();
      if (r.createdAt && typeof r.createdAt.toDate === 'function') return r.createdAt.toDate();
      if (typeof r.updatedAt === 'string') return new Date(r.updatedAt);
      if (typeof r.createdAt === 'string') return new Date(r.createdAt);
      return null;
    }

    // Firestore Timestamp
    if (hf && typeof hf.toDate === 'function') return hf.toDate();

    // numeric epoch (ms)
    if (typeof hf === 'number') return new Date(hf);

    // ISO string
    if (typeof hf === 'string') {
      const d = new Date(hf);
      if (!isNaN(d.getTime())) return d;
    }

    // Raw Timestamp-like object from admin SDK or serialized form
    // e.g. { seconds: 1700000000, nanoseconds: 123000000 } or { _seconds: ... }
    if (hf && typeof hf === 'object') {
      const seconds = (typeof hf.seconds === 'number' ? hf.seconds : (typeof hf._seconds === 'number' ? hf._seconds : null));
      const nanos = (typeof hf.nanoseconds === 'number' ? hf.nanoseconds : (typeof hf._nanoseconds === 'number' ? hf._nanoseconds : 0));
      if (seconds != null) {
        return new Date(seconds * 1000 + Math.floor(nanos / 1e6));
      }
    }

    // unknown format
    return null;
  };

  const parseMoney = (v: any): number => {
    if (v == null) return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      // remove currency symbols and spaces, accept both comma and dot decimals
      const cleaned = v.replace(/[^0-9,.-]+/g, '').replace(/,/g, '.');
      const n = Number(cleaned);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };
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

      // First try the precise range query (fast & indexed when available)
      let snap: any = null;
      try {
        snap = await getDocs(q);
      } catch (rangeErr) {
        // If Firestore rejects because a composite index is missing or for any other
        // reason, fall back to a safer client-side filter approach.
        console.warn('Range query failed, falling back to client-side filter:', rangeErr);
        // Fetch a larger page of the driver's finalized rides and filter locally.
        // This avoids depending on composite indexes for the range query.
        const fallbackLimit = 500; // reasonable upper bound for a single day scan
        // fallback query: avoid ordering by horaFim to *not* require a composite index
        const fallbackQuery = query(
          ridesCol,
          where('motoristaId', '==', driverId),
          where('status', '==', 'finalizada'),
          limit(fallbackLimit)
        );
        const fallbackSnap = await getDocs(fallbackQuery);
        const allDocs = fallbackSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
        const filtered = allDocs.filter((r: any) => {
          const when = parseHoraFim(r);
          if (!when) return false;
          return when >= new Date(startOfDay) && when <= new Date(endOfDay);
        });
        try {
          const sample = allDocs.slice(0, 6).map((d: any) => ({ id: d.id, horaFim: d.horaFim, updatedAt: d.updatedAt }));
          console.warn('DriverEarningsDay fallback sample horaFim formats (rangeErr path):', sample);
        } catch (_) { /* ignore logging errors */ }
        // We loaded everything we need for this day — treat as final page
        setRides(prev => [...prev, ...filtered]);
        setLastDoc(null);
        setHasMore(false);
        return;
      }

      const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));

      // If the precise range query returned no documents for the first page,
      // we may be facing a type mismatch or timezone issue (e.g. horaFim stored
      // as a Firestore Timestamp or differently formatted string). In that case
      // the query succeeds but yields 0 results — still we should try a safe
      // client-side fallback so the UI doesn't incorrectly appear empty.
      if ((!docs || docs.length === 0) && !cursor) {
        console.warn('Range query returned no documents — trying client-side fallback');
        // Fallback: get a larger batch and filter locally
        const fallbackLimit = 500;
        // fallback query path for empty-results: avoid ordering to prevent index errors
        const fallbackQuery = query(
          ridesCol,
          where('motoristaId', '==', driverId),
          where('status', '==', 'finalizada'),
          limit(fallbackLimit)
        );
        const fallbackSnap = await getDocs(fallbackQuery);
        const allDocs = fallbackSnap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
        const filtered = allDocs.filter((r: any) => {
          const when = parseHoraFim(r);
          if (!when) return false;
          return when >= new Date(startOfDay) && when <= new Date(endOfDay);
        });
        try {
          const sample = allDocs.slice(0, 6).map((d: any) => ({ id: d.id, horaFim: d.horaFim, updatedAt: d.updatedAt }));
          console.warn('DriverEarningsDay fallback sample horaFim formats (empty-results path):', sample);
        } catch (_) { /* ignore logging errors */ }
        setRides(prev => [...prev, ...filtered]);
        setLastDoc(null);
        setHasMore(false);
        return;
      }
      setRides(prev => [...prev, ...docs]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      if (docs.length < PAGE_SIZE) setHasMore(false);
    } catch (e) {
      console.warn('Erro ao carregar rides por página:', e);
      setHasMore(false);
    }
  };

  const renderRide = ({ item }: any) => {
    const when = parseHoraFim(item);
    const dateStr = when ? when.toLocaleDateString('pt-BR') : '—';
    const timeStr = when ? when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
    const origin = item.origem?.nome || item.origem?.address || 'Origem';
    const dest = item.destino?.nome || item.destino?.address || 'Destino';
    const passengerName = item.passageiroNome || item.passageiro?.nome || item.passageiroName || 'Passageiro';

    // Try multiple sources for the monetary value and parse robustly
    const rawDriverValue = item.valor_motorista ?? item.valorMotorista ?? null;
    const rawTotal = item.valor_total ?? item.valorTotal ?? item.preçoEstimado ?? item.precoEstimado ?? null;
    const rawTax = item.valor_taxa ?? item.valorTaxa ?? 0;

    let numericValue = 0;
    if (rawDriverValue != null) numericValue = parseMoney(rawDriverValue);
    else if (rawTotal != null) numericValue = Math.max(0, parseMoney(rawTotal) - parseMoney(rawTax));

    const value = numericValue.toFixed(2);
    const payment = item.tipo_pagamento || item.paymentType || item.paymentMethod || '—';

    return (
      <View style={styles.rideItem}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rideTime}>{dateStr} • {timeStr}</Text>
          <Text style={styles.rideRoute}>{origin} → {dest}</Text>
          <Text style={styles.ridePayment}>{payment} • {passengerName}</Text>
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
