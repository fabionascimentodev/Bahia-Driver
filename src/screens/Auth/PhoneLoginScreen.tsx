import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/colors';
import { requestPhoneSignIn, confirmPhoneSignIn } from '../../services/userServices';
import { logger } from '../../services/loggerService';

const PhoneLoginScreen: React.FC<any> = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);

  const sendOtp = async () => {
    if (!phone || phone.trim().length < 8) {
      Alert.alert('Telefone inválido', 'Informe um número de telefone válido com código de país (ex: +55...)');
      return;
    }
    setLoading(true);
    try {
      const cr = await requestPhoneSignIn(phone);
      setConfirmationResult(cr);
      Alert.alert('Código enviado', 'Um código foi enviado por SMS. Digite-o para confirmar.');
    } catch (err: any) {
      logger.error('PHONE_LOGIN', 'Erro ao enviar OTP', err);
      Alert.alert('Erro', err?.message || 'Falha ao enviar OTP');
    } finally { setLoading(false); }
  };

  const confirm = async () => {
    if (!confirmationResult) { Alert.alert('Atenção', 'Envie o código primeiro.'); return; }
    if (!code || code.trim().length < 4) { Alert.alert('Código inválido', 'Informe o código recebido por SMS.'); return; }
    setLoading(true);
    try {
      await confirmPhoneSignIn(confirmationResult, code);
      // onAuthStateChanged no App.tsx fará o restante (criar perfil se necessário e redirecionar)
      logger.success('PHONE_LOGIN', 'Login por telefone realizado');
    } catch (err: any) {
      logger.error('PHONE_LOGIN', 'Erro ao confirmar OTP', err);
      const codeErr = err?.code || null;
      if (codeErr === 'phone-linked-elsewhere' || codeErr === 'phone-already-linked') {
        Alert.alert('Telefone já em uso', 'Este número está vinculado a outra conta. Tente entrar com o e-mail associado ou entre com telefone se desejar.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Entrar com e-mail', onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert('Erro', err?.message || 'Código inválido ou expirado');
      }
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.whiteAreia }}>
      <View style={styles.container}>
        <Text style={styles.header}>Entrar com Telefone</Text>

        <TextInput
          style={styles.input}
          placeholder="+55 71 9xxxx-xxxx"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!loading}
        />

        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.blueBahia }]} onPress={sendOtp} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Enviar código (SMS)</Text>}
        </TouchableOpacity>

        <Text style={{ marginTop: 18, color: COLORS.grayUrbano }}>Código</Text>
        <TextInput style={styles.input} placeholder="000000" value={code} onChangeText={setCode} keyboardType="number-pad" editable={!loading} />

        <TouchableOpacity style={[styles.button, { backgroundColor: COLORS.success }]} onPress={confirm} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirmar código</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop: 12 }} onPress={() => navigation.navigate('Login')}>
          <Text style={{ color: COLORS.blueBahia }}>Voltar ao login por email</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  header: { fontSize: 22, fontWeight: '700', color: COLORS.blueBahia, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, marginTop: 8, backgroundColor: '#fff' },
  button: { padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

export default PhoneLoginScreen;
