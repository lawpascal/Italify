import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";
import Mascot from "../../src/Mascot";

export default function Profile() {
  const { user, logout, isDark, toggleTheme } = useAuth();
  const router = useRouter();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (!user) return null;

  const pct = user.xp_needed > 0 ? (user.xp_in_level / user.xp_needed) * 100 : 100;

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user.email) {
      setMessage({ text: "Email non corretta. Riprova.", ok: false });
      return;
    }
    setLoading(true);
    try {
      await api("/auth/delete-account", { method: "DELETE" });
      await logout();
      router.replace("/(auth)/login");
    } catch (e: any) {
      setMessage({ text: e.message || "Errore durante l'eliminazione.", ok: false });
    }
    setLoading(false);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !newPassword2) {
      setMessage({ text: "Compila tutti i campi.", ok: false });
      return;
    }
    if (newPassword !== newPassword2) {
      setMessage({ text: "Le nuove password non coincidono.", ok: false });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ text: "La nuova password deve avere almeno 6 caratteri.", ok: false });
      return;
    }
    setLoading(true);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: { old_password: oldPassword, new_password: newPassword },
      });
      setMessage({ text: "Password cambiata con successo! ✅", ok: true });
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setMessage(null);
      }, 1500);
    } catch (e: any) {
      setMessage({ text: e.message || "Errore. Verifica la password attuale.", ok: false });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Mascot size={110} />
          <Text style={[styles.name, { color: COLORS.text }]}>{user.name}</Text>
          <Text style={[styles.email, { color: COLORS.textMuted }]}>{user.email}</Text>
          {user.role === "admin" && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminText}>DOCENTE</Text>
            </View>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={22} color={COLORS.secondary} />
              <Text style={[styles.statVal, { color: COLORS.text }]}>Lv {user.level}</Text>
              <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>Livello</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
              <Text style={[styles.statVal, { color: COLORS.text }]}>{user.streak}</Text>
              <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>Streak</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="flash" size={22} color={COLORS.primary} />
              <Text style={[styles.statVal, { color: COLORS.text }]}>{user.xp}</Text>
              <Text style={[styles.statLabel, { color: COLORS.textMuted }]}>XP Totali</Text>
            </View>
          </View>
          <View style={{ marginTop: 18 }}>
            <View style={[styles.xpTrack, { backgroundColor: COLORS.border }]}>
              <View style={[styles.xpFill, { width: `${pct}%` }]} />
            </View>
            <Text style={[styles.xpText, { color: COLORS.textMuted }]}>
              {user.xp_in_level}/{user.xp_needed} XP al livello {user.level + 1}
            </Text>
          </View>
        </View>

        {user.role === "admin" && (
          <TouchableOpacity
            testID="open-admin"
            style={[styles.menuBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.primary }]}
            onPress={() => router.push("/admin")}
          >
            <Ionicons name="construct" size={22} color={COLORS.primary} />
            <Text style={[styles.menuBtnText, { color: COLORS.primary }]}>Pannello docente</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Aspetto</Text>
        <View style={[styles.menuBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
          <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={COLORS.text} />
          <Text style={[styles.menuBtnText, { color: COLORS.text }]}>
            {isDark ? "Tema scuro" : "Tema chiaro"}
          </Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.sectionTitle, { color: COLORS.textMuted }]}>Gestione account</Text>

        <TouchableOpacity
          style={[styles.menuBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
          onPress={() => { setMessage(null); setShowChangePasswordModal(true); }}
        >
          <Ionicons name="key-outline" size={22} color={COLORS.text} />
          <Text style={[styles.menuBtnText, { color: COLORS.text }]}>Cambia password</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.error }]}
          onPress={() => { setMessage(null); setDeleteConfirm(""); setShowDeleteModal(true); }}
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.error} />
          <Text style={[styles.menuBtnText, { color: COLORS.error }]}>Elimina account</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.error} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="logout-btn"
          style={[styles.menuBtn, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
          onPress={async () => { await logout(); router.replace("/(auth)/login"); }}
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.text} />
          <Text style={[styles.menuBtnText, { color: COLORS.text }]}>Esci</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showChangePasswordModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: COLORS.bg }]}>
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>Cambia password</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]} placeholder="Password attuale" placeholderTextColor={COLORS.textDisabled} secureTextEntry value={oldPassword} onChangeText={setOldPassword} autoCapitalize="none" />
            <TextInput style={[styles.modalInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]} placeholder="Nuova password" placeholderTextColor={COLORS.textDisabled} secureTextEntry value={newPassword} onChangeText={setNewPassword} autoCapitalize="none" />
            <TextInput style={[styles.modalInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]} placeholder="Ripeti nuova password" placeholderTextColor={COLORS.textDisabled} secureTextEntry value={newPassword2} onChangeText={setNewPassword2} autoCapitalize="none" />
            {message && <Text style={[styles.modalMsg, { color: message.ok ? COLORS.success : COLORS.error }]}>{message.text}</Text>}
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.primary }]} onPress={handleChangePassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Conferma</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtnOutline, { borderColor: COLORS.border }]} onPress={() => { setShowChangePasswordModal(false); setMessage(null); }}>
              <Text style={[styles.modalBtnOutlineText, { color: COLORS.textMuted }]}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: COLORS.bg }]}>
            <Ionicons name="warning" size={48} color={COLORS.error} style={{ alignSelf: "center" }} />
            <Text style={[styles.modalTitle, { color: COLORS.text }]}>Elimina account</Text>
            <Text style={[styles.modalDesc, { color: COLORS.textMuted }]}>Questa azione è irreversibile. Tutti i tuoi dati verranno eliminati.</Text>
            <Text style={[styles.modalDesc, { color: COLORS.textMuted }]}>Scrivi la tua email: <Text style={{ fontWeight: "800", color: COLORS.text }}>{user.email}</Text></Text>
            <TextInput style={[styles.modalInput, { backgroundColor: COLORS.surface, borderColor: COLORS.border, color: COLORS.text }]} placeholder="Scrivi la tua email" placeholderTextColor={COLORS.textDisabled} value={deleteConfirm} onChangeText={setDeleteConfirm} autoCapitalize="none" autoCorrect={false} />
            {message && <Text style={[styles.modalMsg, { color: COLORS.error }]}>{message.text}</Text>}
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: COLORS.error }]} onPress={handleDeleteAccount} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnText}>Elimina definitivamente</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtnOutline, { borderColor: COLORS.border }]} onPress={() => { setShowDeleteModal(false); setMessage(null); }}>
              <Text style={[styles.modalBtnOutlineText, { color: COLORS.textMuted }]}>Annulla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { alignItems: "center", marginTop: 12, marginBottom: 24 },
  name: { fontSize: 24, fontWeight: "900", marginTop: 14 },
  email: { fontSize: 14, marginTop: 2 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  adminText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  card: { borderRadius: 20, padding: 20, borderWidth: 2 },
  row: { flexDirection: "row", justifyContent: "space-around" },
  statBox: { alignItems: "center", gap: 4 },
  statVal: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 12, fontWeight: "600" },
  xpTrack: { height: 14, borderRadius: 999, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: COLORS.secondary },
  xpText: { fontSize: 12, marginTop: 6, textAlign: "center", fontWeight: "700" },
  sectionTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 4, marginLeft: 4 },
  menuBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, borderWidth: 2, marginTop: 10 },
  menuBtnText: { flex: 1, fontSize: 16, fontWeight: "800" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12, paddingBottom: 40 },
  modalTitle: { fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 4 },
  modalDesc: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  modalInput: { borderWidth: 2, borderRadius: 14, padding: 14, fontSize: 16 },
  modalMsg: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  modalBtn: { paddingVertical: 16, borderRadius: 14, alignItems: "center", borderBottomWidth: 4, borderBottomColor: "rgba(0,0,0,0.2)" },
  modalBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  modalBtnOutline: { paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 2 },
  modalBtnOutlineText: { fontWeight: "800", fontSize: 15 },
});