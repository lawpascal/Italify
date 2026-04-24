import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { COLORS } from "../../src/theme";
import Mascot from "../../src/Mascot";

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (password.length < 6) {
      setErr("La password deve avere almeno 6 caratteri");
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim());
      router.replace("/(tabs)");
    } catch (e: any) {
      setErr(e.message || "Errore di registrazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Mascot size={90} />
            <Text style={styles.title}>Crea il tuo account</Text>
            <Text style={styles.subtitle}>Inizia a imparare l'italiano oggi!</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Nome</Text>
            <TextInput
              testID="register-name"
              style={styles.input}
              placeholder="Come ti chiami?"
              placeholderTextColor={COLORS.textDisabled}
              value={name}
              onChangeText={setName}
            />
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email"
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor={COLORS.textDisabled}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="register-password"
              style={styles.input}
              placeholder="Minimo 6 caratteri"
              placeholderTextColor={COLORS.textDisabled}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {err ? <Text style={styles.error} testID="register-error">{err}</Text> : null}

            <TouchableOpacity
              testID="register-submit"
              style={[styles.btn, loading && { opacity: 0.7 }]}
              onPress={submit}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Registrati</Text>}
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.muted}>Hai già un account?</Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity testID="go-login">
                  <Text style={styles.link}> Accedi</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 24 },
  title: { fontSize: 26, fontWeight: "900", color: COLORS.primary, marginTop: 14, textAlign: "center" },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginTop: 6, textAlign: "center" },
  form: { gap: 8 },
  label: { fontSize: 14, fontWeight: "700", color: COLORS.text, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.text,
  },
  btn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: 4,
    borderBottomColor: COLORS.primaryDark,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 17 },
  error: { color: COLORS.error, marginTop: 8, fontWeight: "600" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  muted: { color: COLORS.textMuted },
  link: { color: COLORS.primary, fontWeight: "800" },
});
