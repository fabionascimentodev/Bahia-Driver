import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView } from 'react-native';
import { firestore } from '../../config/firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { fetchUserProfile } from '../../services/userServices';
import { useUserStore } from '../../store/userStore';
import StarRating from '../../components/common/StarRating';
import { COLORS } from '../../theme/colors';

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
        <ScrollView contentContainerStyle={styles.container}>
            <Image
                source={ profile?.avatarUrl ? { uri: profile.avatarUrl } : require('../../../assets/logo-bahia-driver-azul.png') }
                style={styles.avatar}
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
    avatar: { width: 160, height: 160, borderRadius: 80, marginTop: 12, marginBottom: 12, backgroundColor: '#eee' },
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