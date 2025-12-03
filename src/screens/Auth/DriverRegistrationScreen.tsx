import React, { useState, useRef } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
    Modal,
  ScrollView, 
  ActivityIndicator, 
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { launchImageLibrary } from 'react-native-image-picker';
import { COLORS } from '../../theme/colors';
import { useUserStore } from '../../store/userStore';
import { saveDriverVehicleData, uploadVehiclePhoto, uploadCnhPhoto, VehicleData } from '../../services/userServices';
import { uploadUserAvatar } from '../../services/userServices';
import { logger } from '../../services/loggerService';
import { DriverRegistrationScreenProps } from '../../types/NavigationTypes';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

const DriverRegistrationScreen: React.FC<DriverRegistrationScreenProps> = ({ navigation }) => {
    const user = useUserStore(state => state.user);
    const setUser = useUserStore(state => state.setUser);
    const [modelo, setModelo] = useState('');
    const [placa, setPlaca] = useState('');
    const [cor, setCor] = useState('');
    const [ano, setAno] = useState('');
    const [fotoUri, setFotoUri] = useState<string | null>(null);
    const [avatarUri, setAvatarUri] = useState<string | null>(null);
    const [cnhUri, setCnhUri] = useState<string | null>(null);
    const [antecedenteFileUri, setAntecedenteFileUri] = useState<string | null>(null);
    const [antecedenteFileName, setAntecedenteFileName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const { footerBottom, screenHeight } = useResponsiveLayout();
    const theme = COLORS;
    const imagePreviewHeight = Math.round(Math.min(320, screenHeight * 0.28));

    // 1. Função de seleção de imagem
    const [cropModalVisible, setCropModalVisible] = useState(false);
    const [tempImageUri, setTempImageUri] = useState<string | null>(null);
    const [tempTarget, setTempTarget] = useState<'foto' | 'avatar' | 'cnh' | null>(null);
    const [naturalSize, setNaturalSize] = useState<{width:number;height:number} | null>(null);
    const [containerSize, setContainerSize] = useState<{width:number;height:number}>({ width: 0, height: 0 });
    const [panState, setPanState] = useState<{positionX:number; positionY:number; scale:number}>({ positionX: 0, positionY: 0, scale: 1 });
    const imageZoomRef = useRef<any>(null);

    const pickImage = async () => {
        try {
            const options: any = { mediaType: 'photo', quality: 0.8 };
            const res: any = await new Promise((resolve) => launchImageLibrary(options, resolve));
            if (!res.didCancel && res.assets && res.assets[0]) {
                const uri = res.assets[0].uri;
                setTempImageUri(uri);
                Image.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }), (e) => { console.warn('fail getSize', e); setNaturalSize(null); });
                setTempTarget('foto');
                setCurrentCropType('square');
                setCropModalVisible(true);
                logger.info('DRIVER_REGISTRATION', 'Foto do veículo selecionada (aguardando crop)');
            }
        } catch (e) {
            console.warn('Erro ao abrir seletor nativo de imagens (DriverRegistration - foto):', e);
        }
    };

    // cropMode: 'square' (1:1) or 'ratio' (use aspect width/height)
    const cropCenter = async (uri: string, cropMode: 'square' | 'ratio' = 'square', aspectWidth = 4, aspectHeight = 3) => {
        // Use dynamic require to avoid bundler failure when the package isn't installed.
        let ImageManipulator: any = null;
        try {
            // prefer dynamic import if available
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            ImageManipulator = require('expo-image-manipulator');
        } catch (e) {
            console.warn('expo-image-manipulator não instalado — usando imagem original sem crop');
            return uri; // no crop available
        }
        try {
            // get image dimensions
            const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
                Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
            });

            const { width, height } = size;
            let cropSpec: any = null;
            if (cropMode === 'square') {
                const side = Math.min(width, height);
                const originX = Math.floor((width - side) / 2);
                const originY = Math.floor((height - side) / 2);
                cropSpec = { originX, originY, width: side, height: side };
            } else {
                // center crop to the requested aspect ratio (aspectWidth:aspectHeight)
                const targetRatio = aspectWidth / aspectHeight;
                let targetWidth = width;
                let targetHeight = Math.floor(targetWidth / targetRatio);
                if (targetHeight > height) {
                    targetHeight = height;
                    targetWidth = Math.floor(targetHeight * targetRatio);
                }
                const originX = Math.floor((width - targetWidth) / 2);
                const originY = Math.floor((height - targetHeight) / 2);
                cropSpec = { originX, originY, width: targetWidth, height: targetHeight };
            }

            // crop then resize to square to avoid distortion when displayed in square previews
            const result = await ImageManipulator.manipulateAsync(uri, [
                { crop: cropSpec },
                { resize: { width: 800, height: 800 } },
            ], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });

            return result.uri;
        } catch (e) {
            console.warn('Falha ao cortar imagem:', e);
            return uri; // fallback: return original
        }
    };

    const [currentCropType, setCurrentCropType] = useState<'square' | 'cnh' | 'none'>('square');

    const handleCropAndAccept = async () => {
        if (!tempImageUri) return;
        setLoading(true);
            try {
                // If image manipulator and measurements exist, try interactive crop
                let ImageManipulator: any = null;
                try {
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    ImageManipulator = require('expo-image-manipulator');
                } catch (_) {
                    ImageManipulator = null;
                }

                if (ImageManipulator && naturalSize && containerSize.width > 0 && containerSize.height > 0) {
                    // Use measured container size directly. Avoid re-applying modal width factors
                    // which caused incorrect mapping between displayed pixels and natural pixels.
                    const containerW = containerSize.width;
                    const containerH = containerSize.height;

                    // compute base (scale=1) display image size
                    const imgRatio = naturalSize.width / naturalSize.height;
                    let baseW = containerW;
                    let baseH = Math.round(baseW / imgRatio);
                    if (baseH > containerH) {
                        baseH = containerH;
                        baseW = Math.round(baseH * imgRatio);
                    }

                    const scale = panState.scale || 1;
                    const renderedW = baseW * scale;
                    const renderedH = baseH * scale;

                    const imageLeft = (containerW / 2 - renderedW / 2) + panState.positionX;
                    const imageTop = (containerH / 2 - renderedH / 2) + panState.positionY;

                    let cropBoxW: number;
                    let cropBoxH: number;
                    if (currentCropType === 'cnh') {
                        // 4:3 wide box
                        cropBoxW = Math.min(containerW, containerH) * 0.9;
                        cropBoxH = Math.round((cropBoxW * 3) / 4);
                    } else {
                        // square
                        cropBoxW = Math.min(containerW, containerH) * 0.75;
                        cropBoxH = cropBoxW;
                    }

                    const cropLeft = (containerW / 2 - cropBoxW / 2);
                    const cropTop = (containerH / 2 - cropBoxH / 2);

                    // Debug information to help locate mapping issues on devices
                    // eslint-disable-next-line no-console
                    console.log('DriverRegistration CROP', { naturalSize, containerW, containerH, baseW, baseH, scale, renderedW, renderedH, panState, cropBoxW, cropBoxH });

                    const offsetX = cropLeft - imageLeft;
                    const offsetY = cropTop - imageTop;

                    const factorX = naturalSize.width / renderedW;
                    const factorY = naturalSize.height / renderedH;

                    let originX = Math.round(offsetX * factorX);
                    let originY = Math.round(offsetY * factorY);
                    let width = Math.round(cropBoxW * factorX);
                    let height = Math.round(cropBoxH * factorY);

                    originX = Math.max(0, Math.min(originX, naturalSize.width - 1));
                    originY = Math.max(0, Math.min(originY, naturalSize.height - 1));
                    if (originX + width > naturalSize.width) width = naturalSize.width - originX;
                    if (originY + height > naturalSize.height) height = naturalSize.height - originY;

                    const manipulated = await ImageManipulator.manipulateAsync(tempImageUri, [
                        { crop: { originX, originY, width, height } },
                        { resize: { width: 800, height: 800 } },
                    ], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });

                    if (tempTarget === 'foto') setFotoUri(manipulated.uri);
                    else if (tempTarget === 'avatar') setAvatarUri(manipulated.uri);
                    else if (tempTarget === 'cnh') setCnhUri(manipulated.uri);
                } else {
                    const cropped = await cropCenter(
                        tempImageUri,
                        currentCropType === 'cnh' ? 'ratio' : 'square',
                        currentCropType === 'cnh' ? 4 : 1,
                        currentCropType === 'cnh' ? 3 : 1
                    );
                    if (tempTarget === 'foto') setFotoUri(cropped);
                    else if (tempTarget === 'avatar') setAvatarUri(cropped);
                    else if (tempTarget === 'cnh') setCnhUri(cropped);
                }
            logger.info('DRIVER_REGISTRATION', 'Imagem cortada e aceita');
        } catch (e) {
            console.warn('Erro ao cortar/aceitar imagem:', e);
        } finally {
            setTempImageUri(null);
            setTempTarget(null);
            setCropModalVisible(false);
            setLoading(false);
        }
    };

    const handleAcceptWithoutCrop = () => {
        if (!tempImageUri) return;
            if (tempTarget === 'foto') setFotoUri(tempImageUri);
            else if (tempTarget === 'avatar') setAvatarUri(tempImageUri);
            else if (tempTarget === 'cnh') setCnhUri(tempImageUri);
            setTempImageUri(null);
            setTempTarget(null);
            setCropModalVisible(false);
        logger.info('DRIVER_REGISTRATION', 'Imagem aceita sem corte');
    };

    const pickAvatar = async () => {
        try {
            const options: any = { mediaType: 'photo', quality: 0.7 };
            const res: any = await new Promise((resolve) => launchImageLibrary(options, resolve));
            if (!res.didCancel && res.assets && res.assets[0]) {
                const uri = res.assets[0].uri;
                setAvatarUri(uri);
                Image.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }), (e) => { console.warn('fail getSize', e); setNaturalSize(null); });
                logger.info('DRIVER_REGISTRATION', 'Avatar selecionado (usando imagem inteira, sem crop)');
            }
        } catch (e) {
            console.warn('Erro ao abrir seletor nativo de imagens (DriverRegistration - avatar):', e);
        }
    };

    const pickCnhImage = async () => {
        // Mostra instrução antes de abrir a galeria
        Alert.alert(
            'Foto da CNH',
            'Por favor envie a foto da CNH aberta (frente e verso visíveis).',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'OK', onPress: async () => {
                    try {
                        const options: any = { mediaType: 'photo', quality: 0.8 };
                        const res: any = await new Promise((resolve) => launchImageLibrary(options, resolve));
                        if (!res.didCancel && res.assets && res.assets[0]) {
                            const uri = res.assets[0].uri;
                            setTempImageUri(uri);
                            Image.getSize(uri, (w, h) => setNaturalSize({ width: w, height: h }), (e) => { console.warn('fail getSize', e); setNaturalSize(null); });
                            setTempTarget('cnh');
                            setCurrentCropType('cnh');
                            setCropModalVisible(true);
                            logger.info('DRIVER_REGISTRATION', 'Foto da CNH selecionada (aguardando crop/aceitar)');
                        }
                    } catch (e) {
                        console.warn('Erro ao abrir seletor nativo de imagens (DriverRegistration - cnh):', e);
                    }
                } }
            ],
            { cancelable: true }
        );
    };

    const pickAntecedenteFile = async () => {
        try {
            // Usar require dinamicamente e silenciar o TS se o pacote não estiver instalado.
            // Isso evita erro de compilação para quem não tiver a dependência instalada.
            // @ts-ignore
            const DocumentPicker: any = require('expo-document-picker');
            if (!DocumentPicker) throw new Error('DocumentPicker não disponível');
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.type === 'success') {
                setAntecedenteFileUri(result.uri);
                setAntecedenteFileName(result.name || null);
                logger.info('DRIVER_REGISTRATION', 'Arquivo de antecedentes selecionado', { name: result.name });
            }
        } catch (err) {
            console.warn('Erro ao selecionar arquivo de antecedentes (document picker não disponível):', err);
            Alert.alert('Erro', 'Não foi possível abrir o seletor de arquivos. Verifique se o app tem suporte a seleção de documentos.');
        }
    };

    // 2. Função de finalização do cadastro - CORRIGIDA
    const handleRegisterVehicle = async () => {
        if (!user?.uid) {
            Alert.alert('Erro', 'Usuário não autenticado.');
            logger.error('DRIVER_REGISTRATION', 'Tentativa de cadastro sem usuário autenticado');
            return;
        }

        const anoNum = parseInt(ano, 10);
        if (!modelo || !placa || !cor || isNaN(anoNum) || !fotoUri || !cnhUri) {
            Alert.alert('Atenção', 'Preencha todos os dados do veículo, selecione a foto e envie a foto da CNH.');
            logger.warn('DRIVER_REGISTRATION', 'Campos obrigatórios não preenchidos', { 
                modelo, placa, cor, ano, hasPhoto: !!fotoUri 
            });
            return;
        }
        
        setLoading(true);
        let photoUrl = '';

        try {
            logger.info('DRIVER_REGISTRATION', 'Iniciando cadastro do veículo', { 
                modelo, placa, cor, ano: anoNum 
            });
            
            // 2.1. Upload da foto do veículo para Firebase Storage
            logger.info('DRIVER_REGISTRATION', 'Fazendo upload da foto do veículo para Storage');
            photoUrl = await uploadVehiclePhoto(user.uid, fotoUri, placa);

            // 2.1c. Upload da foto da CNH (documento do motorista)
            let cnhUrl = '';
            if (cnhUri) {
                try {
                    logger.info('DRIVER_REGISTRATION', 'Fazendo upload da foto da CNH');
                    cnhUrl = await uploadCnhPhoto(user.uid, cnhUri);
                } catch (err) {
                    logger.warn('DRIVER_REGISTRATION', 'Falha ao enviar CNH, continuando', err);
                }
            }

            // 2.1d. Upload do arquivo de antecedentes (opcional)
            let antecedenteFileUrl = '';
            try {
                if (antecedenteFileUri) {
                    const { uploadAntecedenteFile } = require('../../services/userServices');
                    antecedenteFileUrl = await uploadAntecedenteFile(user.uid, antecedenteFileUri, antecedenteFileName || undefined);
                }
            } catch (err) {
                logger.warn('DRIVER_REGISTRATION', 'Falha ao enviar arquivo de antecedentes, continuando', err);
            }

            // 2.1b Upload do avatar do usuário (opcional)
            if (avatarUri) {
                try {
                    await uploadUserAvatar(user.uid, avatarUri);
                } catch (err) {
                    logger.warn('DRIVER_REGISTRATION', 'Falha ao enviar avatar, continuando', err);
                }
            }

            // 2.2. Prepara os dados
            const vehicleData: VehicleData = {
                modelo,
                placa: placa.toUpperCase(),
                cor,
                ano: anoNum,
                fotoUrl: photoUrl,
                cnhUrl: cnhUrl,
                antecedenteFileUrl: antecedenteFileUrl,
            };

            // 2.3. Salva os dados do veículo e finaliza o registro
            logger.info('DRIVER_REGISTRATION', 'Salvando dados do veículo no Firestore');
            await saveDriverVehicleData(user.uid, vehicleData);

            logger.success('DRIVER_REGISTRATION', 'Cadastro do motorista concluído com sucesso', { 
                placa: vehicleData.placa 
            });

            // ✅ CORREÇÃO: Atualiza o estado local do usuário para forçar o App.tsx reavaliar
            if (user) {
                const updatedUser = {
                    ...user,
                    motoristaData: {
                        ...user.motoristaData,
                        veiculo: vehicleData,
                        isRegistered: true,
                        status: 'indisponivel'
                    }
                };
                // Cast para UserProfile para evitar incompatibilidades transitórias de tipos
                setUser(updatedUser as any);
            }
            
            // ✅ CORREÇÃO: Navegação simplificada - apenas mostra alerta de sucesso
            // O App.tsx vai automaticamente redirecionar para HomeMotorista devido à atualização do estado
            Alert.alert(
                'Sucesso!', 
                'Cadastro finalizado! Você será redirecionado para a tela inicial do motorista.',
                [
                    { 
                        text: 'OK' 
                        // Não precisa fazer navegação - o App.tsx já vai redirecionar automaticamente
                    }
                ]
            );

        } catch (error) {
            console.error('Erro no registro do veículo:', error);
            logger.error('DRIVER_REGISTRATION', 'Falha no cadastro do veículo', error);
            Alert.alert('Erro', 'Falha ao finalizar o cadastro. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Função para voltar - CORRIGIDA
    const handleBack = () => {
        logger.info('DRIVER_REGISTRATION', 'Saindo do cadastro - navegando para Login');
        // ✅ CORREÇÃO: Navega para Login (que existe no AuthStack)
        navigation.navigate('Login');
    };

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.whiteAreia }] }>
            <ScrollView contentContainerStyle={[styles.container, { paddingBottom: footerBottom + 20, backgroundColor: theme.whiteAreia }]}>
                {/* ✅ BOTÃO VOLTAR */}
                <TouchableOpacity 
                    style={styles.backButton}
                    onPress={handleBack}
                    disabled={loading}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.blueBahia} />
                    <Text style={styles.backButtonText}>Voltar</Text>
                </TouchableOpacity>

                <Text style={[styles.header, { color: theme.blueBahia }]}>Dados do Veículo</Text>
                <Text style={styles.subtitle}>
                    Para se tornar um Bahia Driver, precisamos dos dados do seu veículo.
                </Text>

                {/* Input Modelo */}
                <View style={styles.inputGroup}>
                    <Ionicons name="car-sport-outline" size={24} color={theme.blueBahia} style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Modelo do Veículo (Ex: Hyundai HB20)"
                        value={modelo}
                        onChangeText={setModelo}
                        placeholderTextColor={theme.grayUrbano}
                    />
                </View>

                {/* Input Placa */}
                <View style={styles.inputGroup}>
                    <Ionicons name="pricetag-outline" size={24} color={theme.blueBahia} style={styles.icon} />
                    <TextInput
                        style={styles.input}
                        placeholder="Placa (Ex: ABC1234)"
                        value={placa}
                        onChangeText={text => setPlaca(text.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())}
                        autoCapitalize="characters"
                        maxLength={7}
                        placeholderTextColor={theme.grayUrbano}
                    />
                </View>

                {/* Input Cor e Ano */}
                <View style={styles.row}>
                    <View style={[styles.inputGroup, styles.rowInput]}>
                        <Ionicons name="color-palette-outline" size={24} color={theme.blueBahia} style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Cor"
                            value={cor}
                            onChangeText={setCor}
                            placeholderTextColor={theme.grayUrbano}
                        />
                    </View>
                    <View style={[styles.inputGroup, styles.rowInput]}>
                        <Ionicons name="calendar-outline" size={24} color={theme.blueBahia} style={styles.icon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Ano"
                            value={ano}
                            onChangeText={setAno}
                            keyboardType="numeric"
                            maxLength={4}
                            placeholderTextColor={theme.grayUrbano}
                        />
                    </View>
                </View>

                {/* Upload de Foto */}
                <TouchableOpacity 
                    style={[styles.photoButton, { backgroundColor: theme.yellowSol }]} 
                    onPress={pickImage}
                    disabled={loading}
                >
                    <Ionicons name="camera-outline" size={30} color={theme.whiteAreia} />
                    <Text style={styles.photoButtonText}>
                        {fotoUri ? 'Foto Selecionada' : 'Adicionar Foto do Veículo'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={[styles.photoButton, { backgroundColor: theme.blueBahia, marginTop: 8 }]} 
                    onPress={pickAvatar}
                    disabled={loading}
                >
                    <Ionicons name="person-circle-outline" size={30} color={theme.whiteAreia} />
                    <Text style={styles.photoButtonText}>
                        {avatarUri ? 'Avatar Selecionado' : 'Adicionar Avatar (Opcional)'}
                    </Text>
                </TouchableOpacity>

                {fotoUri && (
                    <Image source={{ uri: fotoUri }} style={[styles.imagePreview, { height: imagePreviewHeight }]} />
                )}

                {/* Modal de pré-visualização / crop (leve) */}
                <Modal visible={cropModalVisible} transparent animationType="slide">
                    <View style={styles.cropModalOverlay}>
                        <View style={styles.cropModalContainer}>
                            <View style={styles.cropTopRow}>
                                <TouchableOpacity onPress={() => { setCropModalVisible(false); setTempImageUri(null); }}>
                                    <Ionicons name="arrow-back" size={26} color={theme.grayUrbano} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.cropTopRightButton}
                                    onPress={async () => await handleCropAndAccept()}
                                    accessibilityLabel="Cortar imagem"
                                >
                                    <Text style={styles.cropTopRightButtonText}>CORTAR</Text>
                                </TouchableOpacity>
                            </View>

                            {tempImageUri ? (
                                (() => {
                                    let ImagePanZoom: any = null;
                                    try {
                                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                                        ImagePanZoom = require('react-native-image-pan-zoom').default;
                                    } catch (e) {
                                        ImagePanZoom = null;
                                    }

                                    // Prefer measured container size (from onLayout). If not yet measured, use sensible fallback.
                                    const containerW = containerSize.width || Math.round(Math.min(520, screenHeight * 0.6));
                                    const containerH = containerSize.height || Math.round(Math.min(520, screenHeight * 0.6));

                                    if (ImagePanZoom && naturalSize) {
                                        const imgRatio = naturalSize.width / naturalSize.height;
                                        let baseW = containerW;
                                        let baseH = Math.round(baseW / imgRatio);
                                        if (baseH > containerH) {
                                            baseH = containerH;
                                            baseW = Math.round(baseH * imgRatio);
                                        }

                                        return (
                                            <View onLayout={(ev) => setContainerSize({ width: ev.nativeEvent.layout.width, height: ev.nativeEvent.layout.height })} style={{ width: '100%', alignItems: 'center' }}>
                                                <ImagePanZoom
                                                    ref={imageZoomRef}
                                                    cropWidth={containerW}
                                                    cropHeight={containerH}
                                                    imageWidth={baseW}
                                                    imageHeight={baseH}
                                                    onMove={({ positionX, positionY, scale }: any) => setPanState({ positionX, positionY, scale })}
                                                >
                                                    <Image source={{ uri: tempImageUri }} style={{ width: baseW, height: baseH }} resizeMode="contain" />
                                                </ImagePanZoom>
                                                <View style={{ position: 'absolute', width: Math.min(containerW, containerH) * 0.75, height: Math.min(containerW, containerH) * 0.75, borderWidth: 2, borderColor: '#fff' }} pointerEvents="none" />
                                            </View>
                                        );
                                    }

                                    return <Image source={{ uri: tempImageUri }} style={[styles.cropPreviewImage, { height: Math.round(Math.min(520, screenHeight * 0.6)) }]} resizeMode="contain" />;
                                })()
                            ) : null}

                            <View style={styles.cropActionRow}>
                                <TouchableOpacity style={[styles.cropActionButton, { backgroundColor: theme.grayClaro }]} onPress={handleAcceptWithoutCrop}>
                                    <Text style={[styles.cropActionText, { color: theme.blackProfissional }]}>ACEITAR</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.cropActionButton, { backgroundColor: theme.danger }]} onPress={() => { setTempImageUri(null); setCropModalVisible(false); }}>
                                    <Text style={styles.cropActionText}>CANCELAR</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Upload CNH */}
                <TouchableOpacity 
                    style={[styles.photoButton, { backgroundColor: theme.danger }]} 
                    onPress={pickCnhImage}
                    disabled={loading}
                >
                    <Ionicons name="card" size={26} color={theme.whiteAreia} />
                    <Text style={[styles.photoButtonText, { color: theme.whiteAreia, marginLeft: 10 }]}>
                        {cnhUri ? 'CNH Selecionada' : 'Enviar Foto da CNH (aberta)'}
                    </Text>
                </TouchableOpacity>

                {cnhUri && (
                    <Image source={{ uri: cnhUri }} style={[styles.imagePreview, { height: imagePreviewHeight }]} />
                )}

                {/* Arquivo de Antecedentes (opcional) */}
                <TouchableOpacity
                    style={[styles.photoButton, { backgroundColor: '#ffffff', borderWidth: 1, borderColor: theme.grayClaro }]}
                    onPress={pickAntecedenteFile}
                    disabled={loading}
                >
                    <Ionicons name="document-text" size={22} color={theme.blueBahia} />
                    <Text style={[styles.photoButtonText, { marginLeft: 10 }]}>
                        {antecedenteFileName ? `Arquivo: ${antecedenteFileName}` : 'Enviar arquivo de antecedentes (opcional)'}
                    </Text>
                </TouchableOpacity>

                {/* Botão Finalizar */}
                <TouchableOpacity 
                    style={[styles.finishButton, { opacity: loading || !fotoUri ? 0.6 : 1, backgroundColor: theme.blueBahia }]} 
                    onPress={handleRegisterVehicle}
                    disabled={loading || !fotoUri}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.whiteAreia} />
                    ) : (
                        <Text style={[styles.finishButtonText, { color: theme.whiteAreia }]}>Finalizar Cadastro</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.whiteAreia,
    },
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: COLORS.whiteAreia,
        paddingBottom: 50,
    },
    // ✅ BOTÃO VOLTAR
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginBottom: 20,
        padding: 8,
    },
    backButtonText: {
        color: COLORS.blueBahia,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 5,
    },
    header: {
        fontSize: 26,
        fontWeight: 'bold',
        color: COLORS.blueBahia,
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.grayUrbano,
        marginBottom: 30,
        textAlign: 'center',
        lineHeight: 20,
    },
    inputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.grayClaro,
        marginBottom: 15,
        paddingHorizontal: 10,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontSize: 16,
        paddingVertical: 12,
        color: COLORS.blackProfissional,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    rowInput: {
        flex: 1,
        marginRight: 10,
    },
    photoButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.yellowSol,
        padding: 15,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 15,
        marginBottom: 15,
    },
    photoButtonText: {
        color: COLORS.blackProfissional,
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 10,
    },
    imagePreview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 15,
        resizeMode: 'cover',
    },
    finishButton: {
        width: '100%',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
        backgroundColor: COLORS.success,
    },
    finishButtonText: {
        color: COLORS.whiteAreia,
        fontWeight: 'bold',
        fontSize: 18,
    }
    ,
    cropModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cropModalContainer: {
        width: '92%',
        backgroundColor: COLORS.whiteAreia,
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
        maxHeight: '90%'
    },
    cropPreviewImage: {
        width: '100%',
        borderRadius: 8,
        backgroundColor: '#000',
        marginVertical: 8,
    },
    cropActionRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    cropActionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginHorizontal: 6,
    },
    cropActionText: { color: COLORS.whiteAreia, fontWeight: '700' },
    cropTopRow: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 6 },
    cropTopRightButton: { backgroundColor: COLORS.blueBahia, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
    cropTopRightButtonText: { color: COLORS.whiteAreia, fontWeight: '700' },
    
});

export default DriverRegistrationScreen;