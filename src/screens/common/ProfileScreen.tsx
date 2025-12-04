import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  Animated,
} from "react-native";
import { firestore } from "../../config/firebaseConfig";
import { collection, query, where, getDocs } from "firebase/firestore";
import { fetchUserProfile } from "../../services/userServices";
import financeService from "../../services/financeService";
import { useUserStore } from "../../store/userStore";
import { COLORS } from "../../theme/colors";
import StarRating from "../../components/common/StarRating";
import {
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  Switch,
  View as RNView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setModoAtual } from "../../services/userServices";
import { navigateToRoute } from "../../services/navigationService";
import supportService from "../../services/supportService";
import audioService from '../../services/audioService';
import useResponsiveLayout from "../../hooks/useResponsiveLayout";

interface Props {
  route: any;
}

const ProfileScreen: React.FC<Props> = ({ route, navigation }: any) => {
  const currentUser = useUserStore((state) => state.user);
  const setUserGlobal = useUserStore((state) => state.setUser);
  const role: "motorista" | "passageiro" = route?.params?.role || "passageiro";
  const userIdParam: string | undefined = route?.params?.userId;

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedRides, setCompletedRides] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [earnings, setEarnings] = useState<any | null>(null);
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportSubject, setSupportSubject] = useState(
    "Relato de problema / solicitação"
  );
  const [supportMessage, setSupportMessage] = useState("");
  const [contactEmail, setContactEmail] = useState<string | null>(null);
  const [sendingSupport, setSendingSupport] = useState(false);
  const [relatos, setRelatos] = useState<any[]>([]);
  const [relatoText, setRelatoText] = useState("");
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [soundVolume, setSoundVolume] = useState<number>(1);
  const theme = COLORS;
  const { screenWidth, footerBottom } = useResponsiveLayout();
  const avatarSize = Math.round(Math.min(160, screenWidth * 0.36));

  // Animated IconButton component (internal)
  const IconButton = ({
    iconName,
    label,
    onPress,
    accessibilityLabel,
    earnings,
  }: any) => {
    const scale = React.useRef(new Animated.Value(1)).current;
    const handlePressIn = () => {
      Animated.spring(scale, { toValue: 0.92, useNativeDriver: true }).start();
    };
    const handlePressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: true,
      }).start();
    };

    return (
      <View style={{ alignItems: "center" }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={accessibilityLabel}
        >
          <Animated.View
            style={[
              styles.iconCircle,
              earnings ? styles.iconCircleEarnings : null,
              { transform: [{ scale }] },
            ]}
          >
            <Ionicons name={iconName} size={22} color={COLORS.whiteAreia} />
          </Animated.View>
        </TouchableOpacity>
        <Text style={styles.iconLabel}>{label}</Text>
      </View>
    );
  };

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
        if (role === "motorista") {
          q = query(
            collection(firestore, "rides"),
            where("motoristaId", "==", uid),
            where("status", "==", "finalizada")
          );
        } else {
          q = query(
            collection(firestore, "rides"),
            where("passageiroId", "==", uid),
            where("status", "==", "finalizada")
          );
        }

        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => d.data() as any);
        setCompletedRides(docs.length);

        // Calculate average rating (best-effort)
        let sum = 0;
        let count = 0;
        docs.forEach((r) => {
          if (role === "motorista") {
            const v = r.passageiroAvaliacao;
            if (typeof v === "number" && v > 0) {
              sum += v;
              count += 1;
            }
          } else {
            // ride-level ratings (some flows may store avaliacoes on the ride)
            if (Array.isArray(r.avaliacoes)) {
              r.avaliacoes.forEach((a: any) => {
                if (typeof a === "number") {
                  sum += a;
                  count += 1;
                }
              });
            }
          }
        });

        // Additionally include any ratings stored directly on the user profile
        // (driver gives ratings by writing to `users/{uid}.avaliacoes`). This
        // ensures passenger averages include ratings made by drivers.
        if (role !== "motorista" && profile && Array.isArray(profile.avaliacoes)) {
          profile.avaliacoes.forEach((a: any) => {
            if (typeof a === 'number') {
              sum += a;
              count += 1;
            }
          });
        }

        if (count > 0) setAvgRating(Number((sum / count).toFixed(2)));
        else setAvgRating(null);

        // load earnings summary for drivers
        if (role === "motorista") {
          try {
            const s = await financeService.getEarningsSummary(uid);
            setEarnings(s);
          } catch (e) {
            console.warn("Erro ao obter resumo de ganhos:", e);
          }
        }

        // load relatos (supportReports) for this user
        await loadRelatos();
      } catch (err) {
        console.error("Erro carregando perfil:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [route?.params, currentUser]);

  // load audio settings for profile UI
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await audioService.init();
        const s = audioService.getSettings();
        if (mounted && s) {
          setSoundEnabled(Boolean(s.enabled));
          setSoundVolume(typeof s.volume === 'number' ? s.volume : 1);
        }
      } catch (e) {
        // ignore
      }
    })();

    return () => { mounted = false; };
  }, []);

  const loadRelatos = async () => {
    try {
      const {
        collection: cf,
        query: qf,
        where: wf,
        getDocs,
        orderBy,
      } = (await Promise.resolve(require("firebase/firestore"))) as any;
      const col = cf(firestore, "supportReports");
      const q = qf(col, wf("userId", "==", userIdParam || currentUser?.uid));
      const snap = await getDocs(q);
      const items: any[] = snap.docs.map((d: any) => ({
        id: d.id,
        ...d.data(),
      }));
      setRelatos(items.reverse());
    } catch (e) {
      console.warn("Erro ao carregar relatos:", e);
      setRelatos([]);
    }
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.blueBahia} />
      </View>
    );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingBottom: footerBottom + 20, backgroundColor: theme.whiteAreia },
      ]}
    >
      <Image
        source={
          profile?.avatarUrl
            ? { uri: profile.avatarUrl }
            : require("../../../assets/logo-bahia-driver-azul.png")
        }
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: Math.round(avatarSize / 2),
          },
        ]}
      />

      <Text style={styles.name}>{profile?.nome || "Usuário"}</Text>
      <Text style={styles.role}>
        {role === "motorista" ? "Motorista" : "Passageiro"}
      </Text>

      {/* Avaliação (star + média) - logo abaixo da foto */}
      <View style={styles.topRatingArea}>
        <Text style={styles.ratingTitleTop}>Avaliação</Text>
        <StarRating
          currentRating={avgRating ? Math.round(avgRating) : 0}
          onRate={() => {
            /* read-only */
          }}
        />
        <Text style={styles.ratingNoteTop}>
          {avgRating
            ? `${avgRating} média baseada em ${completedRides} corridas`
            : "Sem avaliações ainda"}
        </Text>
      </View>

      {/* Botão para alternar modo */}
      <View style={{ width: "100%", marginTop: 12 }}>
        {role === "passageiro" ? (
          <TouchableOpacity
            onPress={async () => {
              try {
                const uid = profile?.uid || currentUser?.uid;
                if (!uid) return;
                // Somente considerar motorista registrado quando há flag explicita isRegistered
                // ou quando houver uma propriedade isMotorista explícita. Não usar `perfil === 'motorista'`
                // para determinar registro do veículo — isso evita pular o fluxo de cadastro
                // quando o usuário já escolheu o perfil mas não completou o cadastro do veículo.
                const isMotoristaRegistered = Boolean(
                  profile?.isMotorista || profile?.motoristaData?.isRegistered
                );
                if (!isMotoristaRegistered) {
                  // Usuário já escolheu o perfil motorista, mas não concluiu cadastro de veículo.
                  // Pedir confirmação antes de redirecionar para o fluxo de cadastro do carro.
                  Alert.alert(
                    'Cadastro de veículo necessário',
                    'Para ativar o modo motorista você precisa cadastrar os dados do veículo. Deseja continuar para o cadastro do veículo agora?',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Continuar',
                        onPress: () => {
                          try {
                            const ok = navigateToRoute(navigation, 'CarRegistration');
                            if (!ok && typeof navigation?.navigate === 'function') {
                              navigation.navigate('CarRegistration' as any, { existingUser: true });
                            }
                          } catch (e) {
                            console.warn('Falha ao navegar para CarRegistration via navigateToRoute, tentando navigate diretamente', e);
                            try { navigation.navigate('CarRegistration' as any, { existingUser: true }); } catch (_) { /* ignore */ }
                          }
                        }
                      }
                    ]
                  );
                  return;
                }

                // se já for motorista, apenas alterna modo
                await setModoAtual(uid, "motorista");
                const updated = { ...(profile || {}), modoAtual: "motorista" };
                setProfile(updated);
                try {
                  setUserGlobal(updated as any);
                } catch (e) {
                  /* ignore */
                }
                // Navegar de forma segura para a tela principal do motorista
                navigateToRoute(navigation, "HomeMotorista");
              } catch (e) {
                Alert.alert(
                  "Erro",
                  "Não foi possível alternar para modo motorista."
                );
              }
            }}
            style={{
              width: "100%",
              padding: 12,
              backgroundColor: COLORS.blueBahia,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.whiteAreia, fontWeight: "700" }}>
              Modo Motorista
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={async () => {
              try {
                const uid = profile?.uid || currentUser?.uid;
                if (!uid) return;
                await setModoAtual(uid, "passageiro");
                const updated = { ...(profile || {}), modoAtual: "passageiro" };
                setProfile(updated);
                try {
                  setUserGlobal(updated as any);
                } catch (e) {
                  /* ignore */
                }
                // Navegar de forma segura para a tela principal do passageiro
                navigateToRoute(navigation, "HomePassageiro");
              } catch (e) {
                Alert.alert(
                  "Erro",
                  "Não foi possível alternar para modo passageiro."
                );
              }
            }}
            style={{
              width: "100%",
              padding: 12,
              backgroundColor: COLORS.blueBahia,
              borderRadius: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: COLORS.whiteAreia, fontWeight: "700" }}>
              Modo Passageiro
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sons / notificações sonoras (motorista) */}
      <View style={{ width: '100%', marginTop: 18, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontWeight: '700', color: COLORS.blueBahia }}>Sons e alertas</Text>
          <Switch
            value={soundEnabled}
            onValueChange={async (v) => {
              setSoundEnabled(v);
              try { await audioService.setEnabled(Boolean(v)); } catch (e) {}
            }}
          />
        </View>

        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: COLORS.grayUrbano }}>Volume: {(soundVolume * 100).toFixed(0)}%</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={async () => {
              const next = Math.max(0, Math.round((soundVolume - 0.1) * 100) / 100);
              setSoundVolume(next);
              try { await audioService.setVolume(next); } catch (e) {}
            }} style={{ padding: 8, backgroundColor: '#eee', borderRadius: 6, marginRight: 8 }}>
              <Ionicons name="remove" size={18} color={COLORS.blueBahia} />
            </TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              const next = Math.min(1, Math.round((soundVolume + 0.1) * 100) / 100);
              setSoundVolume(next);
              try { await audioService.setVolume(next); } catch (e) {}
            }} style={{ padding: 8, backgroundColor: '#eee', borderRadius: 6 }}>
              <Ionicons name="add" size={18} color={COLORS.blueBahia} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ marginTop: 10, flexDirection: 'row' }}>
          <TouchableOpacity onPress={async () => { try { await audioService.play('new_request'); } catch (e) {} }} style={{ padding: 10, backgroundColor: COLORS.blueBahia, borderRadius: 8, marginRight: 8 }}>
            <Text style={{ color: COLORS.whiteAreia, fontWeight: '700' }}>Testar som</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { try { await audioService.stop(); } catch (e) {} }} style={{ padding: 10, backgroundColor: '#ddd', borderRadius: 8 }}>
            <Text style={{ fontWeight: '700' }}>Parar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{completedRides}</Text>
          <Text style={styles.statLabel}>Corridas</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {avgRating ? avgRating.toFixed(1) : "-"}
          </Text>
          <Text style={styles.statLabel}>Avaliação média</Text>
        </View>
      </View>
      {/* Support / Atendimento */}
      <View style={{ width: "100%", marginTop: 14 }}>
        {/* Relato: visualizar e escrever relatos/comentários */}
        {/* Relato card removed: relato agora enviado via ícone/modal */}

        {/* Ações rápidas: Relato, Ajuda, Ver Ganhos (ícones) */}
        <View style={{ width: "100%", marginTop: 12, alignItems: "center" }}>
          <View style={styles.iconRow}>
            {/* IconButton: encapsula animação de scale ao tocar */}
            <IconButton
              iconName="chatbubbles"
              label="Relato"
              onPress={() => {
                // prefill contact email with registered email (if available) and open modal
                const registered = profile?.email || currentUser?.email || null;
                setContactEmail(registered);
                setSupportModalVisible(true);
              }}
              accessibilityLabel="Relatar/Sugerir"
            />

            <IconButton
              iconName="help-circle"
              label="Ajuda"
              onPress={() => setHelpModalVisible(true)}
              accessibilityLabel="Ajuda"
            />

            {role === "motorista" && (
              <IconButton
                iconName="wallet"
                label="Ganhos"
                onPress={() => navigateToRoute(navigation, "DriverEarnings")}
                accessibilityLabel="Ver Ganhos"
                earnings
              />
            )}
          </View>
        </View>
      </View>

      {/* Ganhos detalhados removidos: acessar via botão 'Ver Ganhos' */}
      {/* Support modal */}
      <Modal visible={supportModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <View
            style={{
              width: "92%",
              backgroundColor: COLORS.whiteAreia,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "700",
                color: COLORS.blueBahia,
              }}
            >
              Relato de problema / Solicitação / Sugestão
            </Text>
            <Text style={{ marginTop: 8, color: COLORS.grayUrbano }}>
              Descreva o problema, elogio ou sugestão. O relato será enviado e
              registrado; responderemos em até 24h. Obrigado!
            </Text>

            <TextInput
              placeholder="Assunto"
              value={supportSubject}
              onChangeText={setSupportSubject}
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: COLORS.grayClaro,
                padding: 10,
                borderRadius: 8,
              }}
            />

            <TextInput
              placeholder="Descreva o problema/comentário..."
              value={supportMessage}
              onChangeText={setSupportMessage}
              multiline
              numberOfLines={6}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: COLORS.grayClaro,
                padding: 10,
                borderRadius: 8,
                height: 120,
                textAlignVertical: "top",
              }}
            />

            <Text
              style={{ marginTop: 8, color: COLORS.grayUrbano, fontSize: 12 }}
            >
              E-mail para contato (opcional)
            </Text>
            <TextInput
              placeholder="seu@contato.com"
              value={contactEmail || ""}
              onChangeText={(t) => setContactEmail(t || null)}
              // if user already has a registered email, make the contact field read-only
              editable={!(profile?.email || currentUser?.email)}
              style={{
                marginTop: 6,
                borderWidth: 1,
                borderColor: COLORS.grayClaro,
                padding: 8,
                borderRadius: 8,
                backgroundColor: (profile?.email || currentUser?.email) ? '#f5f5f5' : undefined,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setSupportModalVisible(false)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: COLORS.grayClaro,
                }}
              >
                <Text>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!supportMessage || supportMessage.trim().length < 6) {
                    Alert.alert(
                      "Atenção",
                      "Descreva o problema com mais detalhes (mínimo 6 caracteres)."
                    );
                    return;
                  }
                  setSendingSupport(true);
                  try {
                    // record in firestore
                    const res: any = await supportService.submitSupportReport({
                      userId: userIdParam || currentUser?.uid,
                      userName: profile?.nome || currentUser?.nome || null,
                      role,
                      subject: supportSubject,
                      message: supportMessage,
                      contactEmail: contactEmail || null,
                    });

                    // If Firestore function can't send mail (missing SMTP), it will update status:
                    // 'pending_no_smtp'. We read back the doc to check.
                    if (res && res.success && res.id) {
                      try {
                        const { doc: docFn, getDoc } = await Promise.resolve(require('firebase/firestore'));
                        const { firestore: fb } = require('../../config/firebaseConfig');
                        const snap = await getDoc(docFn(fb, 'supportReports', res.id));
                        const data = snap && snap.exists ? snap.data() : null;
                        setSupportModalVisible(false);

                        if (data && data.status === 'pending_no_smtp') {
                          Alert.alert(
                            'Relato registrado',
                            'Seu relato foi salvo mas o envio por e-mail automático não pôde ser feito (SMTP não configurado). Deseja enviar pelo seu app de e-mail?',
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Abrir e-mail', onPress: () => supportService.openMailClient(supportSubject, supportMessage) },
                            ]
                          );
                        } else {
                          Alert.alert('Enviado', 'Seu relato foi registrado e será analisado. Responderemos em até 24h.');
                        }
                      } catch (e) {
                        // If read fails, still notify user that it was registered
                        setSupportModalVisible(false);
                        Alert.alert('Enviado', 'Seu relato foi registrado e será analisado. Responderemos em até 24h.');
                      }
                    } else {
                      throw new Error(res && res.error ? res.error : 'Falha ao registrar relato');
                    }
                  } catch (err) {
                    console.error("Erro ao enviar relato:", err);
                    Alert.alert(
                      "Erro",
                      "Não foi possível enviar seu relato agora. Tente novamente mais tarde"
                    );
                  } finally {
                    setSendingSupport(false);
                  }
                }}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: COLORS.blueBahia,
                }}
              >
                <Text style={{ color: COLORS.whiteAreia, fontWeight: "700" }}>
                  {sendingSupport ? "Enviando..." : "Enviar relato"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Help modal (Ajuda) */}
      <Modal visible={helpModalVisible} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <View
            style={{
              width: "92%",
              backgroundColor: COLORS.whiteAreia,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: COLORS.blueBahia,
              }}
            >
              Ajuda
            </Text>
            <ScrollView style={{ marginTop: 8, maxHeight: 420 }}>
              {role === "motorista" ? (
                <View>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como aceitar corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Toque em 'Aceitar' na notificação ou no card da corrida.
                    Certifique-se de estar com o app online e com localização
                    ativada.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como cancelar corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Abra a corrida em andamento e selecione 'Cancelar'
                    informando o motivo. Use com cautela para evitar
                    penalidades.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como finalizar corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    No painel da corrida, confirme o destino e toque em
                    'Finalizar' para encerrar e gerar o recibo.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como ver detalhes da corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Ao abrir uma corrida finalizada você verá informações sobre
                    passageiro, percurso, valor e nota.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como acessar a tela de ganhos
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Toque no botão 'Ver Ganhos' nesta tela para acessar o
                    relatório completo de ganhos.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como funciona o repasse/taxa
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    O aplicativo aplica uma taxa sobre o valor bruto; o valor
                    líquido aparece em 'Saldo disponível'. Consulte o extrato na
                    tela de Ganhos.
                  </Text>
                </View>
              ) : (
                <View>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como solicitar corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Na tela inicial do passageiro, informe o destino e confirme
                    para solicitar. Aguarde aceitação do motorista.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como acompanhar o trajeto
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Após o motorista aceitar, acompanhe o trajeto em tempo real
                    na tela de rastreamento.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como cancelar corrida
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Vá até a corrida em andamento e toque em 'Cancelar'.
                    Verifique possíveis taxas de cancelamento.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como pagar
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    O app oferece opções de pagamento configuradas em seu
                    perfil. Escolha no momento da finalização da viagem.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como avaliar o motorista
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Ao finalizar a corrida, você poderá dar uma nota e deixar um
                    comentário.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como ver histórico
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Acesse 'Histórico' na seção de perfil para ver viagens
                    passadas e recibos.
                  </Text>

                  <Text
                    style={{
                      fontWeight: "700",
                      color: COLORS.blackProfissional,
                      marginTop: 8,
                    }}
                  >
                    Como acessar suporte
                  </Text>
                  <Text style={{ color: COLORS.grayUrbano, marginTop: 4 }}>
                    Use o botão 'Relatar um problema' para enviar uma mensagem
                    ao suporte ou acesse a opção de contato.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setHelpModalVisible(false)}
                style={{
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: COLORS.grayClaro,
                }}
              >
                <Text style={{ color: COLORS.blackProfissional }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Avaliação duplicada removida — mantendo apenas o bloco superior de avaliação */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: {
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.whiteAreia,
    minHeight: "100%",
  },
  avatar: {
    marginTop: 12,
    marginBottom: 12,
    backgroundColor: COLORS.grayClaro,
  },
  name: { fontSize: 22, fontWeight: "700", color: COLORS.blackProfissional },
  role: { fontSize: 14, color: COLORS.grayUrbano, marginBottom: 18 },
  row: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    marginVertical: 12,
  },
  statBox: { alignItems: "center" },
  statNumber: { fontSize: 28, fontWeight: "700", color: COLORS.blueBahia },
  statLabel: { fontSize: 12, color: COLORS.grayUrbano },
  // ratingArea, ratingTitle, ratingNote removed (duplicate)

  topRatingArea: {
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  ratingTitleTop: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.blackProfissional,
  },
  ratingNoteTop: { fontSize: 13, color: COLORS.grayUrbano, marginTop: 6 },

  relatoCard: {
    width: "100%",
    backgroundColor: COLORS.whiteAreia,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.grayClaro,
  },
  relatoHeader: { marginBottom: 8 },
  relatoTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.blackProfissional,
  },
  relatoHint: { fontSize: 12, color: COLORS.grayUrbano },
  relatoEmpty: { fontSize: 13, color: COLORS.grayUrbano, marginVertical: 8 },
  relatoItem: {
    marginTop: 8,
    padding: 10,
    backgroundColor: COLORS.whiteAreia,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.grayClaro,
  },
  relatoMessage: { color: COLORS.blackProfissional },
  relatoMeta: { color: COLORS.grayUrbano, fontSize: 11, marginTop: 6 },
  relatoInput: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.grayClaro,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    color: COLORS.blackProfissional,
  },
  relatoButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8 },

  // Icon action row
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "80%",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.blueBahia,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
    elevation: 2,
  },
  iconCircleEarnings: { backgroundColor: COLORS.yellowSol },
  iconLabel: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 12,
    color: COLORS.grayUrbano,
  },

  helpButton: {
    width: "100%",
    padding: 12,
    backgroundColor: COLORS.blueBahia,
    borderRadius: 10,
    alignItems: "center",
  },
  earningsButton: {
    width: "100%",
    padding: 12,
    backgroundColor: COLORS.yellowSol,
    borderRadius: 10,
    alignItems: "center",
  },
});

export default ProfileScreen;
