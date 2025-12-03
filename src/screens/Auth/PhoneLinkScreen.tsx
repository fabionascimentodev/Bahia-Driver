import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';
import { requestPhoneSignIn, linkPhoneToCurrentUser } from '../../services/userServices';
import { logger } from '../../services/loggerService';

const PhoneLinkScreen: React.FC<any> = ({ route, navigation }) => {
  const phoneFromParams = route?.params?.phone || '';
  const [phone, setPhone] = useState(phoneFromParams);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [mergePassword, setMergePassword] = useState('');
  const [mergeProcessing, setMergeProcessing] = useState(false);

  const sendOtp = async () => {
    if (!phone || phone.trim().length < 8) { Alert.alert('Telefone inválido', 'Informe número válido'); return; }
    setLoading(true);
    try {
      const cr = await requestPhoneSignIn(phone);
      // ConfirmationResult em RN pode expor verificationId
      setVerificationId(cr.verificationId || cr._verificationId || null);
      Alert.alert('OTP enviado', 'Cheque o SMS e informe o código para vincular o telefone.');
    } catch (err: any) {
      logger.error('PHONE_LINK', 'Erro ao enviar OTP', err);
      Alert.alert('Erro', err?.message || 'Falha ao enviar OTP');
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!verificationId) { Alert.alert('Atenção', 'Envie o código primeiro.'); return; }
    if (!code || code.trim().length < 4) { Alert.alert('Código inválido', 'Informe o código recebido por SMS.'); return; }
    setLoading(true);
    try {
      await linkPhoneToCurrentUser(verificationId, code);
      Alert.alert('Sucesso', 'Telefone vinculado à sua conta.');
      navigation.reset({ index: 0, routes: [{ name: 'ProfileSelection' }] });
    } catch (err: any) {
      logger.error('PHONE_LINK', 'Erro ao confirmar link', err);
      const code = err?.code || (err?.message && 'unknown');
      if (code === 'phone-already-linked' || code === 'phone-linked-elsewhere') {
        Alert.alert(
          'Telefone já em uso',
          'Este número já está vinculado a outra conta. Deseja entrar com este telefone em vez de vincular?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Entrar com telefone', onPress: () => navigation.navigate('PhoneLogin') },
            { text: 'Mesclar contas', onPress: () => setMergeModalVisible(true) }
          ]
        );
      } else if (code === 'requires-recent-login') {
        Alert.alert('Autenticação necessária', 'Para vincular o telefone é necessário refazer o login. Saia e entre novamente e tente novamente.');
      } else {
        Alert.alert('Erro', err?.message || 'Falha ao vincular telefone');
      }
    } finally { setLoading(false); }
  };

  const handleMerge = async () => {
    // Mesclar a conta atual (source) com a conta que possui o telefone (target)
    if (!verificationId) { Alert.alert('Atenção', 'Envie o código primeiro.'); return; }
    if (!code || code.trim().length < 4) { Alert.alert('Atenção', 'Informe o código SMS primeiro.'); return; }
    if (!mergePassword || mergePassword.length < 6) { Alert.alert('Senha necessária', 'Informe sua senha do e-mail para confirmar a mescla.'); return; }
    setMergeProcessing(true);
    try {
      // guarda source info
      const sourceUser = auth.currentUser;
      if (!sourceUser) { Alert.alert('Erro', 'Usuário atual não autenticado'); setMergeProcessing(false); return; }
      const sourceUid = sourceUser.uid;
      const sourceEmail = sourceUser.email || '';

      // 1) Assinar na conta de destino (onde o telefone está) usando credential de telefone
      const { signInWithPhoneCredential, linkEmailToCurrentUser, mergeUserAccounts } = require('../../services/userServices') as any;
      await signInWithPhoneCredential(verificationId, code);

      // 2) Agora auth.currentUser é o target (telefone). Vincular email do source a essa conta usando a senha fornecida
      try {
        await linkEmailToCurrentUser(sourceEmail, mergePassword);
      } catch (linkErr: any) {
        // se falhar ao vincular email, rethrow
        throw linkErr;
      }

      // 3) Mesclar dados de Firestore do sourceUid para targetUid
      const targetUid = auth.currentUser?.uid;
      if (!targetUid) throw new Error('Não foi possível obter UID do usuário destino');
      await mergeUserAccounts(sourceUid, targetUid, true);

      Alert.alert('Mesclagem concluída', 'Suas contas foram mescladas com sucesso. Você agora está conectado na conta que usa este telefone.');
      navigation.reset({ index: 0, routes: [{ name: 'ProfileSelection' }] });
    } catch (err: any) {
      console.error('Erro ao mesclar contas:', err);
      const codeErr = err?.code || null;
      if (codeErr === 'auth/wrong-password' || (err && err.message && err.message.toLowerCase().includes('senha'))) {
        Alert.alert('Senha incorreta', 'A senha informada está incorreta.');
      } else {
        Alert.alert('Erro na mesclagem', err?.message || String(err));
      }
    } finally {
      setMergeProcessing(false);
      setMergeModalVisible(false);
      setMergePassword('');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.whiteAreia }}>
      <View style={styles.container}>
        <Text style={styles.header}>Vincular Telefone</Text>
        <Text style={{ color: COLORS.grayUrbano }}>O número será vinculado à conta atualmente autenticada.</Text>

        <TextInput style={styles.input} placeholder="+55 71 9xxxx-xxxx" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!loading} />
        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.blueBahia }]} onPress={sendOtp} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar código (SMS)</Text>}
        </TouchableOpacity>

        <Text style={{ marginTop: 12, color: COLORS.grayUrbano }}>Código</Text>
        <TextInput style={styles.input} placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad" editable={!loading} />

        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.success }]} onPress={confirm} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar e Vincular</Text>}
        </TouchableOpacity>

        
        {/* Modal de mesclagem: pergunta senha para mesclar contas */}
        {mergeModalVisible ? (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <View style={{ width: '92%', backgroundColor: COLORS.whiteAreia, padding: 12, borderRadius: 10 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.blueBahia }}>Mesclar contas</Text>
              <Text style={{ marginTop: 8, color: COLORS.grayUrbano }}>Informe a senha da conta de e-mail atual para confirmar a mesclagem com a conta que já usa este telefone.</Text>
              <TextInput value={mergePassword} onChangeText={setMergePassword} placeholder="Senha da conta" secureTextEntry style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginTop: 10 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity onPress={() => { setMergeModalVisible(false); setMergePassword(''); }} style={{ padding: 10, borderRadius: 8, backgroundColor: COLORS.grayClaro }}>
                  <Text>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleMerge} disabled={mergeProcessing} style={{ padding: 10, borderRadius: 8, backgroundColor: COLORS.blueBahia }}>
                  <Text style={{ color: '#fff' }}>{mergeProcessing ? 'Processando...' : 'Confirmar mesclagem'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '700', color: COLORS.blueBahia, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginTop: 8, backgroundColor: '#fff' },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

export default PhoneLinkScreen;
