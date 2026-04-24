import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { COLORS } from "../../src/theme";
import Mascot from "../../src/Mascot";

export default function Profile() {
  const { user, logout } = useAuth();
  const router = useRouter();
  if (!user) return null;

  const pct = user.xp_needed > 0 ? (user.xp_in_level / user.xp_needed) * 100 : 100;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Mascot size={110} />
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.role === "admin" && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.adminText}>DOCENTE</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.statBox}>
              <Ionicons name="star" size={22} color={COLORS.secondary} />
              <Text style={styles.statVal}>Lv {user.level}</Text>
              <Text style={styles.statLabel}>Livello</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
              <Text style={styles.statVal}>{user.streak}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="flash" size={22} color={COLORS.primary} />
              <Text style={styles.statVal}>{user.xp}</Text>
              <Text style={styles.statLabel}>XP Totali</Text>
            </View>
          </View>
          <View style={{ marginTop: 18 }}>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.xpText}>
              {user.xp_in_level}/{user.xp_needed} XP al livello {user.level + 1}
            </Text>
          </View>
        </View>

        {user.role === "admin" && (
          <TouchableOpacity
            testID="open-admin"
            style={[styles.menuBtn, { borderColor: COLORS.primary }]}
            onPress={() => router.push("/admin")}
          >
            <Ionicons name="construct" size={22} color={COLORS.primary} />
            <Text style={[styles.menuBtnText, { color: COLORS.primary }]}>Pannello docente</Text>
            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="logout-btn"
          style={styles.menuBtn}
          onPress={async () => {
            await logout();
            router.replace("/(auth)/login");
          }}
        >
          <Ionicons name="log-out-outline" size={22} color={COLORS.text} />
          <Text style={styles.menuBtnText}>Esci</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { alignItems: "center", marginTop: 12, marginBottom: 24 },
  name: { fontSize: 24, fontWeight: "900", color: COLORS.text, marginTop: 14 },
  email: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  adminBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 10,
  },
  adminText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  row: { flexDirection: "row", justifyContent: "space-around" },
  statBox: { alignItems: "center", gap: 4 },
  statVal: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  statLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  xpTrack: { height: 14, backgroundColor: COLORS.border, borderRadius: 999, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: COLORS.secondary },
  xpText: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: "center", fontWeight: "700" },
  menuBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginTop: 14,
  },
  menuBtnText: { flex: 1, fontSize: 16, fontWeight: "800", color: COLORS.text },
});
