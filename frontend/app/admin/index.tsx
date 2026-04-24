import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";
import { useAuth } from "../../src/auth";

type Lesson = { id: string; title: string; description: string; exercise_count: number; order: number };

export default function AdminHome() {
  const { user } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { lessons } = await api<{ lessons: Lesson[] }>("/lessons");
      setLessons(lessons);
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      (async () => {
        setLoading(true);
        await load();
        setLoading(false);
      })();
    }, [])
  );

  if (!user || user.role !== "admin") {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20 }}>Accesso riservato ai docenti.</Text>
      </SafeAreaView>
    );
  }

  const remove = (id: string) => {
    Alert.alert("Eliminare lezione?", "L'operazione è irreversibile.", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Elimina",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/lessons/${id}`, { method: "DELETE" });
            await load();
          } catch (e: any) {
            Alert.alert("Errore", e.message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="admin-back">
          <Ionicons name="arrow-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Pannello docente</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/admin/edit?id=new")}
          testID="create-lesson"
        >
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.createBtnText}>Nuova lezione</Text>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} style={{ marginTop: 30 }} />
        ) : lessons.length === 0 ? (
          <Text style={styles.empty}>Nessuna lezione. Creane una per iniziare!</Text>
        ) : (
          lessons.map((l) => (
            <View key={l.id} style={styles.row} testID={`admin-lesson-${l.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{l.title}</Text>
                <Text style={styles.rowMeta}>{l.exercise_count} esercizi</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/admin/edit?id=${l.id}`)}
                style={styles.iconBtn}
              >
                <Ionicons name="pencil" size={20} color={COLORS.info} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(l.id)} style={styles.iconBtn}>
                <Ionicons name="trash" size={20} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  scroll: { padding: 16, gap: 12, paddingBottom: 60 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 14,
    borderBottomWidth: 4,
    borderBottomColor: COLORS.primaryDark,
  },
  createBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 30 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  rowMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  iconBtn: { padding: 6 },
});
