import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";

type Saved = {
  lesson_id: string;
  lesson_title: string;
  exercise: { id: string; type: string; question: string };
};

export default function SavedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Saved[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await api<{ saved: Saved[] }>("/saved");
      setItems(data.saved);
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

  const remove = async (lesson_id: string, exercise_id: string) => {
    try {
      await api(
        `/saved?lesson_id=${encodeURIComponent(lesson_id)}&exercise_id=${encodeURIComponent(exercise_id)}`,
        { method: "DELETE" }
      );
      setItems((prev) => prev.filter((i) => !(i.lesson_id === lesson_id && i.exercise.id === exercise_id)));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title} testID="saved-title">Domande salvate</Text>
        <Text style={styles.subtitle}>Ripassa le domande che hai segnato</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={64} color={COLORS.textDisabled} />
          <Text style={styles.emptyTitle}>Nessuna domanda salvata</Text>
          <Text style={styles.emptyText}>
            Durante una lezione, tocca l'icona segnalibro per salvarla qui.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {items.map((s) => (
            <View key={`${s.lesson_id}:${s.exercise.id}`} style={styles.card} testID={`saved-card-${s.exercise.id}`}>
              <View style={styles.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle}>{s.lesson_title}</Text>
                  <Text style={styles.question}>{s.exercise.question}</Text>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{typeLabel(s.exercise.type)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => remove(s.lesson_id, s.exercise.id)}
                  testID={`saved-remove-${s.exercise.id}`}
                >
                  <Ionicons name="bookmark" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.openBtn}
                onPress={() => router.push(`/lesson/${s.lesson_id}`)}
              >
                <Text style={styles.openBtnText}>Apri lezione</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    multiple_choice: "Scelta multipla",
    true_false: "Vero / Falso",
    right_wrong: "Giusto / Sbagliato",
    open_answer: "Risposta aperta",
    word_order: "Riordino parole",
    audio: "Audio",
    video: "Video",
  };
  return map[t] || t;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, marginTop: 16 },
  emptyText: { textAlign: "center", color: COLORS.textMuted, marginTop: 8, lineHeight: 20 },
  scroll: { padding: 16, paddingBottom: 100, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 16,
  },
  cardRow: { flexDirection: "row", gap: 8 },
  lessonTitle: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  question: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginTop: 6, lineHeight: 21 },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 10,
  },
  typeText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700" },
  removeBtn: { padding: 4 },
  openBtn: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
  },
  openBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
});
