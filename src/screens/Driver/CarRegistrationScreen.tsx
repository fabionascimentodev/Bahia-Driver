import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS } from "../../theme/colors";
import { CarRegistrationScreenProps } from "../../types/NavigationTypes";
import { useUserStore } from "../../store/userStore";
import useResponsiveLayout from "../../hooks/useResponsiveLayout";
import {
  createUserWithEmailAndPassword,
  uploadUserAvatar,
  uploadVehiclePhoto,
  uploadVehicleDocument,
  uploadCnhPhoto,
  uploadAntecedenteFile,
  saveDriverVehicleData,
  updateUserProfileType,
  saveMotoristaRecord,
} from "../../services/userServices";
import {
  navigateToRoute,
  resetRootWhenAvailable,
  navigateRootWhenAvailable,
} from "../../services/navigationService";
import { logger } from "../../services/loggerService";

const CarRegistrationScreen: React.FC<CarRegistrationScreenProps> = ({
  navigation,
  route,
}) => {
  const theme = COLORS;
  const { footerBottom } = useResponsiveLayout();
  const currentUser = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);

  const prefill = route?.params?.prefillPersonal;
  const existingUser = !!route?.params?.existingUser;

  const [modelo, setModelo] = useState("");
  const [placa, setPlaca] = useState("");
  const [cor, setCor] = useState("");
  const [ano, setAno] = useState("");
  const [fotoUri, setFotoUri] = useState<string | null>(null);
  const [cnhUri, setCnhUri] = useState<string | null>(null);
  const [antecedenteFileUri, setAntecedenteFileUri] = useState<string | null>(
    null
  );
  const [antecedenteFileName, setAntecedenteFileName] = useState<string | null>(
    null
  );
  const [documentoVeiculoUri, setDocumentoVeiculoUri] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const pickImage = async (setter: (u: string) => void) => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Permissão para acessar fotos é necessária para enviar imagens."
        );
        return;
      }

      const res: any = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });
      if (
        !res.canceled &&
        res.assets &&
        res.assets.length > 0 &&
        res.assets[0].uri
      ) {
        setter(res.assets[0].uri);
      }
    } catch (e) {
      console.warn("Erro ao selecionar imagem:", e);
    }
  };

  const pickAntecedente = async () => {
    try {
      // @ts-ignore
      const DocumentPicker: any = require("expo-document-picker");
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (result.type === "success") {
        setAntecedenteFileUri(result.uri);
        setAntecedenteFileName(result.name || null);
      }
    } catch (e) {
      console.warn("Erro ao selecionar arquivo de antecedentes:", e);
      Alert.alert("Erro", "Não foi possível selecionar o arquivo.");
    }
  };

  const handleSubmit = async () => {
    // Validations
    const anoNum = parseInt(ano, 10) || undefined;

    // Trim and validate required fields with a helpful message
    const modeloTrim = modelo ? modelo.trim() : "";
    const placaTrim = placa ? placa.trim() : "";
    const corTrim = cor ? cor.trim() : "";

    const missing: string[] = [];
    if (!modeloTrim) missing.push("Modelo");
    if (!placaTrim) missing.push("Placa");
    if (!corTrim) missing.push("Cor");

    if (missing.length > 0) {
      // Log values to help debug cases where UI appears filled but state is empty
      logger.warn("CAR_REG", "Validação falhou — campos faltando", {
        modelo,
        placa,
        cor,
      });
      Alert.alert("Atenção", `Preencha os campos: ${missing.join(", ")}`);
      return;
    }

    setLoading(true);
    try {
      let uid = currentUser?.uid || null;

      // If we are coming from prefill (new user), create account now
      if (prefill && !existingUser) {
        if (
          !prefill.email ||
          !prefill.password ||
          !prefill.nome ||
          !prefill.telefone
        ) {
          Alert.alert("Erro", "Dados pessoais incompletos.");
          setLoading(false);
          return;
        }

        logger.info("CAR_REG", "Criando usuário (motorista) após prefill");
        uid = await createUserWithEmailAndPassword(
          prefill.email,
          prefill.password,
          prefill.nome,
          prefill.telefone,
          "motorista"
        );

        // upload avatar if present
        if (prefill.avatarUri) {
          try {
            await uploadUserAvatar(uid, prefill.avatarUri);
          } catch (e) {
            logger.warn(
              "CAR_REG",
              "Falha ao enviar avatar após criação de usuário",
              e
            );
          }
        }

        // ensure perfil updated
        try {
          await updateUserProfileType(
            uid,
            "motorista",
            prefill.nome,
            prefill.telefone
          );
        } catch (e) {
          logger.warn("CAR_REG", "Falha ao atualizar perfil motorista", e);
        }
      }

      if (!uid) {
        Alert.alert(
          "Erro",
          "Usuário não autenticado. Faça login e tente novamente."
        );
        setLoading(false);
        return;
      }

      // Upload vehicle photo
      let fotoUrl = "";
      if (fotoUri) {
        try {
          fotoUrl = await uploadVehiclePhoto(uid, fotoUri, placa);
        } catch (e) {
          logger.warn("CAR_REG", "Falha ao enviar foto do veículo", e);
          // Mostrar alerta amigável quando for erro de permissão no Storage
          if (
            (e as any)?.code === "storage-unauthorized" ||
            (e as any)?.message?.toLowerCase()?.includes("sem permissão")
          ) {
            Alert.alert(
              "Permissão negada",
              "Não foi possível enviar a foto do veículo. Verifique as regras do Firebase Storage."
            );
          }
        }
      }

      // Upload documento do veículo (foto)
      let documentoUrl = "";
      if (documentoVeiculoUri) {
        try {
          documentoUrl = await uploadVehicleDocument(
            uid,
            documentoVeiculoUri,
            placa
          );
        } catch (e) {
          logger.warn("CAR_REG", "Falha ao enviar documento do veículo", e);
          if (
            (e as any)?.code === "storage-unauthorized" ||
            (e as any)?.message?.toLowerCase()?.includes("sem permissão")
          ) {
            Alert.alert(
              "Permissão negada",
              "Não foi possível enviar o documento do veículo. Verifique as regras do Firebase Storage."
            );
          }
        }
      }

      // Upload CNH
      let cnhUrl = "";
      if (cnhUri) {
        try {
          cnhUrl = await uploadCnhPhoto(uid, cnhUri);
        } catch (e) {
          logger.warn("CAR_REG", "Falha ao enviar CNH", e);
          if (
            (e as any)?.code === "storage-unauthorized" ||
            (e as any)?.message?.toLowerCase()?.includes("sem permissão")
          ) {
            Alert.alert(
              "Permissão negada",
              "Não foi possível enviar a CNH. Verifique as regras do Firebase Storage."
            );
          }
        }
      }

      // Upload antecedente
      let antecedenteUrl = "";
      if (antecedenteFileUri) {
        try {
          antecedenteUrl = await uploadAntecedenteFile(
            uid,
            antecedenteFileUri,
            antecedenteFileName || undefined
          );
        } catch (e) {
          logger.warn("CAR_REG", "Falha ao enviar antecedente", e);
          if (
            (e as any)?.code === "storage-unauthorized" ||
            (e as any)?.message?.toLowerCase()?.includes("sem permissão")
          ) {
            Alert.alert(
              "Permissão negada",
              "Não foi possível enviar o arquivo de antecedentes. Verifique as regras do Firebase Storage."
            );
          }
        }
      }

      const vehicleData = {
  modelo: modeloTrim,
  placa: placaTrim.toUpperCase(),
  cor: corTrim,
  ano: anoNum,
  fotoUrl: fotoUrl || undefined,
  documentoUrl: documentoUrl || undefined,
  cnhUrl: cnhUrl || undefined,
  antecedenteFileUrl: antecedenteUrl || undefined,
};

await saveDriverVehicleData(uid, vehicleData as any);
try {
  await saveMotoristaRecord(uid, vehicleData as any);
} catch (e) {
  logger.warn(
    "CAR_REG",
    "Falha ao salvar registro em /motoristas (continuando)",
    e
  );
}

// 1. Atualiza o estado local do usuário
try {
  const updatedUser = currentUser
    ? {
        ...currentUser,
        motoristaData: {
          ...(currentUser.motoristaData || {}),
          veiculo: vehicleData,
          isRegistered: true,
          status: "indisponivel",
        },
      }
    : undefined;
  if (updatedUser) {
    setUser(updatedUser as any);
    logger.info("CAR_REG", "Estado local atualizado com dados do veículo");
  }
} catch (e) {
  logger.warn(
    "CAR_REG",
    "Falha ao atualizar estado local do usuário após salvar veículo",
    e
  );
}

// 2. Mostra alerta de sucesso com ação
Alert.alert(
  "✅ Cadastro Concluído!",
  "Seu veículo foi cadastrado com sucesso. Você será redirecionado para a área do motorista.",
  [
    {
      text: "Continuar",
      onPress: () => {
        try {
          logger.info("CAR_REG", "Iniciando redirecionamento para Login");
          
          // SOLUÇÃO: Navega para Login
          // O App.tsx vai detectar que o usuário já tem veículo
          // e redirecionar automaticamente para HomeMotorista
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
          
        } catch (error) {
          logger.error("CAR_REG", "Erro ao redirecionar", error);
          // Fallback: tenta voltar
          if (navigation.canGoBack()) {
            navigation.goBack();
          }
        }
      }
    }
  ]
);

    } catch (e) {
      console.error("Erro no cadastro do carro:", e);
      Alert.alert(
        "Erro",
        "Não foi possível concluir o cadastro do veículo. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.whiteAreia }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: footerBottom + 20 },
        ]}
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() => {
            try {
              // CORREÇÃO SIMPLIFICADA DO BOTÃO VOLTAR
              if (navigation?.canGoBack?.()) {
                navigation.goBack();
              } else {
                // Se não puder voltar, navega baseado no contexto
                if (prefill && !existingUser) {
                  // Fluxo de cadastro novo
                  navigation.navigate("UserRegistration");
                } else {
                  // Fluxo de usuário existente
                  navigation.navigate("Login");
                }
              }
            } catch (e) {
              console.warn("Erro ao voltar:", e);
              navigation.navigate("Login");
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.blueBahia} />
          <Text style={{ color: theme.blueBahia, marginLeft: 8 }}>Voltar</Text>
        </TouchableOpacity>

        <Text style={[styles.header, { color: theme.blueBahia }]}>
          Cadastro do Veículo
        </Text>
        <Text style={styles.subtitle}>
          Preencha as informações do seu veículo para ativar o modo motorista.
        </Text>

        <View style={styles.inputGroup}>
          <Ionicons
            name="car-sport-outline"
            size={20}
            color={theme.blueBahia}
            style={styles.icon}
          />
          <TextInput
            placeholder="Modelo"
            value={modelo}
            onChangeText={setModelo}
            style={styles.input}
            placeholderTextColor={theme.grayUrbano}
          />
          {modelo.trim() ? (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={COLORS.success}
              style={styles.inputCheck}
            />
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Ionicons
            name="pricetag-outline"
            size={20}
            color={theme.blueBahia}
            style={styles.icon}
          />
          <TextInput
            placeholder="Placa"
            value={placa}
            onChangeText={(t) =>
              setPlaca(t.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
            }
            style={styles.input}
            placeholderTextColor={theme.grayUrbano}
          />
          {placa.trim() ? (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={COLORS.success}
              style={styles.inputCheck}
            />
          ) : null}
        </View>

        <View style={styles.inputGroup}>
          <Ionicons
            name="calendar-outline"
            size={20}
            color={theme.blueBahia}
            style={styles.icon}
          />
          <TextInput
            placeholder="Ano"
            value={ano}
            onChangeText={setAno}
            keyboardType="numeric"
            style={styles.input}
            placeholderTextColor={theme.grayUrbano}
          />
          {ano.trim() ? (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={COLORS.success}
              style={styles.inputCheck}
            />
          ) : null}
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text
            style={{
              marginBottom: 8,
              fontWeight: "600",
              color: theme.blackProfissional,
            }}
          >
            Cor do veículo
          </Text>
          <View style={styles.colorRow}>
            {
              // predefined colors
            }
            {[
              { name: "Preto", hex: "#000000" },
              { name: "Cinza", hex: "#95A5A6" },
              { name: "Branco", hex: "#FFFFFF" },
              { name: "Azul", hex: "#007BFF" },
              { name: "Prata", hex: "#C0C0C0" },
              { name: "Vermelho", hex: "#FF4136" },
            ].map((c) => {
              const selected = cor === c.name;
              const isLight = (() => {
                // simple luminance check
                const hex = c.hex.replace("#", "");
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;
                const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                return lum > 0.7; // very light
              })();

              return (
                <TouchableOpacity
                  key={c.name}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: c.hex,
                      borderColor: selected
                        ? isLight
                          ? "#000"
                          : "#fff"
                        : "transparent",
                      borderWidth: selected ? 3 : 1,
                    },
                  ]}
                  onPress={() => setCor(c.name)}
                  accessibilityLabel={`Selecionar cor ${c.name}`}
                />
              );
            })}
          </View>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
          >
            <Text style={{ color: theme.grayUrbano }}>
              Cor selecionada: {cor || "Nenhuma"}
            </Text>
            {cor ? (
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={COLORS.success}
                style={{ marginLeft: 8 }}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.uploadRow}>
          <TouchableOpacity
            style={[
              styles.photoButton,
              { backgroundColor: theme.yellowSol, flex: 1 },
            ]}
            onPress={() => pickImage(setFotoUri)}
          >
            <View style={styles.photoButtonLeft}>
              <Ionicons
                name="camera-outline"
                size={22}
                color={theme.whiteAreia}
              />
              <Text
                style={[
                  styles.photoButtonText,
                  { color: theme.blackProfissional },
                ]}
              >
                {fotoUri ? "Foto Selecionada" : "Adicionar Foto do Veículo"}
              </Text>
            </View>
            {fotoUri ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.success}
                style={styles.checkIcon}
              />
            ) : null}
          </TouchableOpacity>

          <View style={{ width: 12 }} />

          <TouchableOpacity
            style={[
              styles.photoButton,
              {
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: COLORS.grayClaro,
                flex: 1,
              },
            ]}
            onPress={() => pickImage(setDocumentoVeiculoUri)}
          >
            <View style={styles.photoButtonLeft}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={theme.blueBahia}
              />
              <Text style={[styles.photoButtonText]}>
                {documentoVeiculoUri
                  ? "Documento selecionado"
                  : "Enviar Documento do Veículo (foto)"}
              </Text>
            </View>
            {documentoVeiculoUri ? (
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.success}
                style={styles.checkIcon}
              />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={{ height: 8 }} />

        <TouchableOpacity
          style={[styles.photoButton, { backgroundColor: theme.danger }]}
          onPress={() => pickImage(setCnhUri)}
        >
          <View style={styles.photoButtonLeft}>
            <Ionicons name="card" size={20} color={theme.whiteAreia} />
            <Text style={[styles.photoButtonText]}>
              {cnhUri ? "CNH Selecionada" : "Enviar Foto da CNH"}
            </Text>
          </View>
          {cnhUri ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={COLORS.success}
              style={styles.checkIcon}
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.photoButton,
            {
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: theme.grayClaro,
            },
          ]}
          onPress={pickAntecedente}
        >
          <View style={styles.photoButtonLeft}>
            <Ionicons name="document-text" size={20} color={theme.blueBahia} />
            <Text style={[styles.photoButtonText]}>
              {antecedenteFileName
                ? `Arquivo: ${antecedenteFileName}`
                : "Enviar arquivo de antecedentes (opcional)"}
            </Text>
          </View>
          {antecedenteFileName ? (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={COLORS.success}
              style={styles.checkIcon}
            />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, { backgroundColor: theme.blueBahia }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={theme.whiteAreia} />
          ) : (
            <Text
              style={[styles.finishButtonText, { color: theme.whiteAreia }]}
            >
              Finalizar Cadastro
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20 },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  header: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: { textAlign: "center", color: COLORS.grayUrbano, marginBottom: 12 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.grayClaro,
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  icon: { marginRight: 8 },
  input: { flex: 1, fontSize: 16, color: COLORS.blackProfissional },
  photoButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    justifyContent: "space-between",
    marginTop: 10,
  },
  photoButtonText: { fontWeight: "700", marginLeft: 8, flexShrink: 1 },
  photoButtonLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  imagePreview: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    marginTop: 10,
    resizeMode: "cover",
  },
  inputCheck: { marginLeft: 8 },
  finishButton: {
    marginTop: 18,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  finishButtonText: { fontWeight: "700" },
  colorRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  colorCircle: { width: 44, height: 44, borderRadius: 22, marginRight: 10 },
  uploadRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  checkIcon: { marginLeft: 8 },
});

export default CarRegistrationScreen;