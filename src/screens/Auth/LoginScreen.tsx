import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import { COLORS } from '../../theme/colors';

// 1. Definição dos parâmetros da pilha de autenticação
type AuthStackParamList = {
    Login: undefined;
    ProfileSelection: undefined;
    DriverRegistration: undefined;
};

// 2. Tipagem das Props de navegação para esta tela
type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// 3. Componente LoginScreen
// CORREÇÃO FINAL: Usamos a sintaxe de função com props tipadas para satisfazer o React Navigation.
const LoginScreen = (props: Props) => {
    // Destrutura navigation para uso interno
    const { navigation } = props; 
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Erro', 'Preencha todos os campos.');
            return;
        }

        setLoading(true);
        try {
            // Tenta fazer login com email e senha
            await signInWithEmailAndPassword(auth, email, password);
            // Sucesso no login: App.tsx cuida do redirecionamento após carregar o perfil.
        } catch (error: any) {
            console.error("Erro no login:", error.code, error.message);
            Alert.alert('Erro no Login', 'Verifique seu e-mail e senha. Credenciais inválidas ou conta não existe.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Bem-vindo ao Bahia Driver</Text>

            <TextInput
                style={styles.input}
                placeholder="E-mail"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.grayUrbano}
            />
            <TextInput
                style={styles.input}
                placeholder="Senha"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={COLORS.grayUrbano}
            />

            <TouchableOpacity 
                style={[styles.button, { backgroundColor: COLORS.blueBahia }]} 
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={COLORS.whiteAreia} />
                ) : (
                    <Text style={styles.buttonText}>Entrar</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity 
                style={styles.linkButton} 
                onPress={() => navigation.navigate('ProfileSelection')}
            >
                <Text style={styles.linkText}>Ainda não tem conta? Cadastre-se</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 40,
    },
    input: {
        width: '100%',
        padding: 15,
        borderWidth: 1,
        borderColor: COLORS.grayClaro,
        borderRadius: 8,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: '#fff',
        color: COLORS.blackProfissional,
    },
    button: {
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    },
    linkButton: {
        marginTop: 20,
    },
    linkText: {
        color: COLORS.blueBahia,
        fontSize: 16,
        textDecorationLine: 'underline',
    },
});

export default LoginScreen;