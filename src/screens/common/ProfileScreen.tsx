import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { firestore } from '../../config/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { fetchUserProfile } from '../../services/userServices';
import financeService from '../../services/financeService';
import { useUserStore } from '../../store/userStore';
import { COLORS } from '../../theme/colors';
import StarRating from '../../components/common/StarRating';
import { Alert, Modal, TextInput, TouchableOpacity, Switch, View as RNView } from 'react-native';
import supportService from '../../services/supportService';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

interface Props {
    route: any;
}

const ProfileScreen: React.FC<Props> = ({ route }) => {
    const currentUser = useUserStore(state => state.user);
    const role: 'motorista' | 'passageiro' = route?.params?.role || 'passageiro';
    const userIdParam: string | undefined = route?.params?.userId;

    const [profile, setProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [completedRides, setCompletedRides] = useState(0);
    const [avgRating, setAvgRating] = useState<number | null>(null);
    const [earnings, setEarnings] = useState<any | null>(null);
    const [supportModalVisible, setSupportModalVisible] = useState(false);
    const [supportSubject, setSupportSubject] = useState('Relato de problema / solicitação');
    const [supportMessage, setSupportMessage] = useState('');
    const [contactEmail, setContactEmail] = useState<string | null>(null);
    const [sendingSupport, setSendingSupport] = useState(false);
    const theme = COLORS;
    const { screenWidth, footerBottom } = useResponsiveLayout();
    const avatarSize = Math.round(Math.min(160, screenWidth * 0.36));

    useEffect(() => {
        const uid = userIdParam || currentUser?.uid;
        if (!uid) {
            setLoading(false);
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const userProfile = await fetchUserProfile(uid);
                setProfile(userProfile);

                // Query completed rides depending on role
                let q;
                if (role === 'motorista') {
                    q = query(collection(firestore, 'rides'), where('motoristaId', '==', uid), where('status', '==', 'finalizada'));
                } else {
                    q = query(collection(firestore, 'rides'), where('passageiroId', '==', uid), where('status', '==', 'finalizada'));
                }

                const snap = await getDocs(q);
                const docs = snap.docs.map(d => d.data() as any);
                setCompletedRides(docs.length);

                // Calculate average rating (best-effort)
                let sum = 0;
                let count = 0;
                docs.forEach(r => {
                    if (role === 'motorista') {
                        const v = r.passageiroAvaliacao;
                        if (typeof v === 'number' && v > 0) { sum += v; count += 1; }
                    } else {
                        if (Array.isArray(r.avaliacoes)) {
                            r.avaliacoes.forEach((a: any) => { if (typeof a === 'number') { sum += a; count += 1; } });
                        }
                    }
                });

                if (count > 0) setAvgRating(Number((sum / count).toFixed(2)));
                else setAvgRating(null);

                // load earnings summary for drivers
                if (role === 'motorista') {
                    try {
                        const s = await financeService.getEarningsSummary(uid);
                        setEarnings(s);
                    } catch (e) {
                        console.warn('Erro ao obter resumo de ganhos:', e);
                    }
                }

            } catch (err) {
                console.error('Erro carregando perfil:', err);
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [route?.params, currentUser]);

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.blueBahia} /></View>;

    return (
        <ScrollView contentContainerStyle={[styles.container, { paddingBottom: footerBottom + 20, backgroundColor: theme.whiteAreia }]}>
                <Image
                    source={ profile?.avatarUrl ? { uri: profile.avatarUrl } : require('../../../assets/logo-bahia-driver-azul.png') }
                    style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: Math.round(avatarSize / 2) }]}
                />

            <Text style={styles.name}>{profile?.nome || 'Usuário'}</Text>
            <Text style={styles.role}>{role === 'motorista' ? 'Motorista' : 'Passageiro'}</Text>

            <View style={styles.row}>
                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{completedRides}</Text>
                    <Text style={styles.statLabel}>Corridas</Text>
                </View>

                <View style={styles.statBox}>
                    <Text style={styles.statNumber}>{avgRating ? avgRating.toFixed(1) : '-'}</Text>
                    <Text style={styles.statLabel}>Avaliação média</Text>
                </View>
            </View>
            {/* Support / Atendimento */}
            <View style={{ width: '100%', marginTop: 14 }}>
                {/* Support CTA */}
                <TouchableOpacity
                    onPress={() => {
                        setSupportModalVisible(true);
                        setSupportMessage('');
                        setSupportSubject('Relato de problema / solicitação');
                        setContactEmail(profile?.email || currentUser?.email || null);
                    }}
                    style={{ width: '100%', padding: 12, backgroundColor: COLORS.blueBahia, borderRadius: 10, alignItems: 'center' }}
                >
                    <Text style={{ color: COLORS.whiteAreia, fontWeight: '700' }}>Relatar um problema / Contato com suporte</Text>
                </TouchableOpacity>
            </View>
            
            {role === 'motorista' && earnings ? (
                <View style={{ width: '100%', marginTop: 12 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blackProfissional }}>Ganhos</Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                        <View style={{ flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 8, marginRight: 6 }}>
                            <Text style={{ fontSize: 12, color: COLORS.grayUrbano }}>Diário (24h)</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blueBahia }}>R$ {Number(earnings.daily.driverGross || 0).toFixed(2)}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.grayUrbano }}>Taxas: R$ {Number(earnings.daily.platformFees || 0).toFixed(2)}</Text>
                        </View>

                        <View style={{ flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 8, marginHorizontal: 6 }}>
                            <Text style={{ fontSize: 12, color: COLORS.grayUrbano }}>Semanal (7d)</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blueBahia }}>R$ {Number(earnings.weekly.driverGross || 0).toFixed(2)}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.grayUrbano }}>Taxas: R$ {Number(earnings.weekly.platformFees || 0).toFixed(2)}</Text>
                        </View>

                        <View style={{ flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 8, marginLeft: 6 }}>
                            <Text style={{ fontSize: 12, color: COLORS.grayUrbano }}>Mensal (30d)</Text>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blueBahia }}>R$ {Number(earnings.monthly.driverGross || 0).toFixed(2)}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.grayUrbano }}>Taxas: R$ {Number(earnings.monthly.platformFees || 0).toFixed(2)}</Text>
                        </View>
                    </View>

                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#fff', borderRadius: 8 }}>
                        <Text style={{ fontSize: 12, color: COLORS.grayUrbano }}>Saldo disponível: <Text style={{ fontWeight: '700', color: COLORS.success }}>R$ {Number(earnings.balance || 0).toFixed(2)}</Text></Text>
                        <Text style={{ fontSize: 12, color: COLORS.grayUrbano, marginTop: 4 }}>Dívida atual: <Text style={{ fontWeight: '700', color: COLORS.danger }}>R$ {Number(earnings.debt || 0).toFixed(2)}</Text></Text>
                    </View>
                    {/* Weekday earnings breakdown (last 7 days) */}
                    {earnings.earningsByWeekday ? (
                        <View style={{ marginTop: 12, padding: 10, backgroundColor: '#fff', borderRadius: 8 }}>
                            <Text style={{ fontSize: 12, color: COLORS.grayUrbano }}>Ganhos por dia (últimos 7 dias)</Text>
                            <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'flex-end' }}>
                                {(() => {
                                    const weekdayKeys = Object.keys(earnings.earningsByWeekday);
                                    const values = weekdayKeys.map((k: any) => Number(earnings.earningsByWeekday[k] || 0));
                                    const max = Math.max(...values, 1);
                                    return weekdayKeys.map((k: any, idx: number) => (
                                        <View key={k} style={{ flex: 1, alignItems: 'center', marginHorizontal: 4 }}>
                                            <View style={{ width: '100%', height: 48, justifyContent: 'flex-end' }}>
                                                <View style={{ height: Math.round((values[idx] / max) * 48) || 4, width: '70%', backgroundColor: COLORS.blueBahia, borderRadius: 4 }} />
                                            </View>
                                            <Text style={{ marginTop: 6, fontSize: 12, color: COLORS.blackProfissional }}>{k}</Text>
                                            <Text style={{ fontSize: 11, color: COLORS.grayUrbano }}>R$ {Number(values[idx]).toFixed(0)}</Text>
                                        </View>
                                    ));
                                })()}
                            </View>
                        </View>
                    ) : null}
                </View>
            ) : null}
            {/* Support modal */}
            <Modal visible={supportModalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                    <View style={{ width: '92%', backgroundColor: COLORS.whiteAreia, borderRadius: 12, padding: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blueBahia }}>Enviar relato ao suporte</Text>
                        <Text style={{ marginTop: 8, color: COLORS.grayUrbano }}>Descreva o problema ou sugestão. O relato será enviado por e-mail e registrado; responderemos em até 24h.</Text>

                        <TextInput
                            placeholder="Assunto"
                            value={supportSubject}
                            onChangeText={setSupportSubject}
                            style={{ marginTop: 12, borderWidth: 1, borderColor: COLORS.grayClaro, padding: 10, borderRadius: 8 }}
                        />

                        <TextInput
                            placeholder="Descreva o problema/comentário..."
                            value={supportMessage}
                            onChangeText={setSupportMessage}
                            multiline
                            numberOfLines={6}
                            style={{ marginTop: 10, borderWidth: 1, borderColor: COLORS.grayClaro, padding: 10, borderRadius: 8, height: 120, textAlignVertical: 'top' }}
                        />

                        <Text style={{ marginTop: 8, color: COLORS.grayUrbano, fontSize: 12 }}>E-mail para contato (opcional)</Text>
                        <TextInput
                            placeholder="seu@contato.com"
                            value={contactEmail || ''}
                            onChangeText={(t) => setContactEmail(t || null)}
                            style={{ marginTop: 6, borderWidth: 1, borderColor: COLORS.grayClaro, padding: 8, borderRadius: 8 }}
                        />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                            <TouchableOpacity onPress={() => setSupportModalVisible(false)} style={{ padding: 10, borderRadius: 8, backgroundColor: COLORS.grayClaro }}>
                                <Text>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    if (!supportMessage || supportMessage.trim().length < 6) {
                                        Alert.alert('Atenção', 'Descreva o problema com mais detalhes (mínimo 6 caracteres).');
                                        return;
                                    }
                                    setSendingSupport(true);
                                    try {
                                        // record in firestore
                                        await supportService.submitSupportReport({
                                            userId: userIdParam || currentUser?.uid,
                                            userName: profile?.nome || currentUser?.nome || null,
                                            role,
                                            subject: supportSubject,
                                            message: supportMessage,
                                            contactEmail: contactEmail || null,
                                        });

                                        // We record the report in Firestore; Cloud Function will send email to support if SMTP configured.
                                        setSupportModalVisible(false);
                                        Alert.alert('Enviado', 'Seu relato foi registrado e será analisado. Responderemos em até 24h.');
                                    } catch (err) {
                                        console.error('Erro ao enviar relato:', err);
                                        Alert.alert('Erro', 'Não foi possível enviar seu relato agora. Tente novamente mais tarde');
                                    } finally {
                                        setSendingSupport(false);
                                    }
                                }}
                                style={{ padding: 10, borderRadius: 8, backgroundColor: COLORS.blueBahia }}
                            >
                                <Text style={{ color: COLORS.whiteAreia, fontWeight: '700' }}>{sendingSupport ? 'Enviando...' : 'Enviar relato'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <View style={styles.ratingArea}>
                <Text style={styles.ratingTitle}>Avaliação</Text>
                <StarRating currentRating={avgRating ? Math.round(avgRating) : 0} onRate={() => { /* read-only here */ }} />
                <Text style={styles.ratingNote}>{avgRating ? `${avgRating} média baseada em ${completedRides} corridas` : 'Sem avaliações ainda'}</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { alignItems: 'center', padding: 24, backgroundColor: COLORS.whiteAreia, minHeight: '100%' },
    avatar: { marginTop: 12, marginBottom: 12, backgroundColor: '#eee' },
    name: { fontSize: 22, fontWeight: '700', color: COLORS.blackProfissional },
    role: { fontSize: 14, color: COLORS.grayUrbano, marginBottom: 18 },
    row: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', marginVertical: 12 },
    statBox: { alignItems: 'center' },
    statNumber: { fontSize: 28, fontWeight: '700', color: COLORS.blueBahia },
    statLabel: { fontSize: 12, color: COLORS.grayUrbano },
    ratingArea: { width: '100%', alignItems: 'center', marginTop: 8 },
    ratingTitle: { fontSize: 16, fontWeight: '600', color: COLORS.blackProfissional },
    ratingNote: { fontSize: 12, color: COLORS.grayUrbano, marginTop: 8 }
});

export default ProfileScreen;