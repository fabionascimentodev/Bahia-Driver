import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Modal, FlatList } from 'react-native';
import { COLORS } from '../../theme/colors';
import financeService from '../../services/financeService';
import { useUserStore } from '../../store/userStore';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DriverEarningsScreen: React.FC = () => {
  const user = useUserStore(s => s.user);
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState<any | null>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [days, setDays] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!user?.uid) { setLoading(false); return; }
      setLoading(true);
      try {
        const s = await financeService.getEarningsSummary(user.uid);
        setEarnings(s);
        // load raw rides for last days (we'll filter client-side for last 7 days)
        try {
          const { collection, query, where, getDocs } = require('firebase/firestore');
          const { firestore } = require('../../config/firebaseConfig');
          const ridesCol = collection(firestore, 'rides');
          const q = query(ridesCol, where('motoristaId', '==', user.uid), where('status', '==', 'finalizada'));
          const snap = await getDocs(q);
          const docs = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));
          setRides(docs);
          // helper: robust money parser (accepts numbers, strings with comma/dot, currency symbols)
          const parseMoney = (v: any): number => {
            if (v == null) return 0;
            if (typeof v === 'number') return v;
            if (typeof v === 'string') {
              const cleaned = v.replace(/[^0-9,.-]+/g, '').replace(/,/g, '.');
              const n = Number(cleaned);
              return isNaN(n) ? 0 : n;
            }
            return 0;
          };

          // build last 7 days summary
          const today = new Date();
          const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()); // start of today
          const daysArr: any[] = [];
          for (let i = 0; i <= 6; i++) {
            const day = new Date(start.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
            const startOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
            const endOfDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
            const dayNameShort = day.toLocaleDateString('pt-BR', { weekday: 'long' });
            // filter rides that finished this day
            const ridesForDay = docs.filter((r: any) => {
              let when = null;
              if (r.horaFim) {
                when = new Date(r.horaFim);
              } else if (r.updatedAt && typeof r.updatedAt.toDate === 'function') {
                when = r.updatedAt.toDate();
              } else if (r.updatedAt && typeof r.updatedAt === 'string') {
                when = new Date(r.updatedAt);
              }
              if (!when) return false;
              return when >= startOfDay && when <= endOfDay;
            });

            const total = ridesForDay.reduce((sum: number, r: any) => {
              const rawDriver = r.valor_motorista ?? r.valorMotorista ?? null;
              const rawTotal = r.valor_total ?? r.valorTotal ?? r.preçoEstimado ?? r.precoEstimado ?? null;
              const rawTax = r.valor_taxa ?? r.valorTaxa ?? 0;
              let valorMotorista = 0;
              if (rawDriver != null) valorMotorista = parseMoney(rawDriver);
              else if (rawTotal != null) valorMotorista = Math.max(0, parseMoney(rawTotal) - parseMoney(rawTax));
              return sum + (isNaN(valorMotorista) ? 0 : valorMotorista);
            }, 0);

            daysArr.push({
              date: day,
              label: dayNameShort.charAt(0).toUpperCase() + dayNameShort.slice(1),
              count: ridesForDay.length,
              total: Number(total.toFixed(2)),
              rides: ridesForDay,
            });
          }

          setDays(daysArr.reverse());
        } catch (rideErr) {
          console.warn('Erro ao carregar corridas para detalhamento:', rideErr);
        }
      } catch (e) {
        console.warn('Erro ao carregar ganhos:', e);
      } finally { setLoading(false); }
    };
    load();
  }, [user]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.blueBahia} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.whiteAreia }]}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Ganhos</Text>
        {earnings ? (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Saldo disponível</Text>
              <Text style={styles.cardValue}>R$ {Number(earnings.balance || 0).toFixed(2)}</Text>
            </View>

            <View style={styles.row}>
              <View style={styles.smallCard}><Text style={styles.smallLabel}>Diário</Text><Text style={styles.smallValue}>R$ {Number(earnings.daily.driverGross || 0).toFixed(2)}</Text></View>
              <View style={styles.smallCard}><Text style={styles.smallLabel}>Semanal</Text><Text style={styles.smallValue}>R$ {Number(earnings.weekly.driverGross || 0).toFixed(2)}</Text></View>
              <View style={styles.smallCard}><Text style={styles.smallLabel}>Mensal</Text><Text style={styles.smallValue}>R$ {Number(earnings.monthly.driverGross || 0).toFixed(2)}</Text></View>
            </View>
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: COLORS.grayUrbano }}>Detalhamento por dia (últimos 7 dias)</Text>
              <View style={{ marginTop: 8 }}>
                {days && days.length > 0 ? days.map((d: any, idx: number) => (
                  <TouchableOpacity key={idx} style={styles.dayRow} onPress={() => { navigation.navigate('DriverEarningsDay', { dateISO: d.date.toISOString() } as any); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{d.label}</Text></View>
                      <View style={{ marginLeft: 10 }}>
                        <Text style={styles.dayCount}>{d.count} corridas</Text>
                        <Text style={styles.dayDate}>{d.date.toLocaleDateString('pt-BR')}</Text>
                      </View>
                    </View>
                    <Text style={styles.dayTotal}>R$ {Number(d.total || 0).toFixed(2)}</Text>
                  </TouchableOpacity>
                )) : (
                  <Text style={{ color: COLORS.grayUrbano }}>Nenhum dado por dia disponível.</Text>
                )}
              </View>
            </View>
          </View>
        ) : (
          <Text style={{ color: COLORS.grayUrbano }}>Nenhum dado de ganhos disponível.</Text>
        )}
        {/* Day details moved to dedicated screen 'DriverEarningsDay' for better navigation and pagination */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.blackProfissional, marginBottom: 12 },
  card: { backgroundColor: COLORS.whiteAreia, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.grayClaro },
  cardLabel: { color: COLORS.grayUrbano },
  cardValue: { color: COLORS.success, fontWeight: '700', fontSize: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  smallCard: { flex: 1, padding: 10, backgroundColor: COLORS.whiteAreia, borderRadius: 8, borderWidth: 1, borderColor: COLORS.grayClaro, marginHorizontal: 4 },
  smallLabel: { color: COLORS.grayUrbano, fontSize: 12 },
  smallValue: { color: COLORS.blueBahia, fontWeight: '700' },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.grayClaro, marginBottom: 8 },
  dayBadge: { minWidth: 84, height: 36, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.blueBahia },
  dayBadgeText: { color: COLORS.whiteAreia, fontWeight: '700' },
  dayCount: { color: COLORS.blackProfissional, fontWeight: '600' },
  dayDate: { color: COLORS.grayUrbano, fontSize: 12 },
  dayTotal: { color: COLORS.success, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '92%', maxHeight: '80%', backgroundColor: COLORS.whiteAreia, borderRadius: 12, padding: 12 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.blueBahia, marginBottom: 8 },
  rideItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.grayClaro },
  rideTime: { color: COLORS.grayUrbano, fontSize: 12 },
  rideRoute: { color: COLORS.blackProfissional, fontWeight: '600' },
  ridePayment: { color: COLORS.grayUrbano, fontSize: 12 },
  rideValue: { color: COLORS.blueBahia, fontWeight: '700', marginLeft: 8 },
  closeButton: { marginTop: 8, padding: 12, backgroundColor: COLORS.blueBahia, borderRadius: 8, alignItems: 'center' },
});

export default DriverEarningsScreen;
