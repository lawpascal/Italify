import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";
import Mascot from "../../src/Mascot";

type Lesson = {
  id: string;
  title: string;
  description: string;
  exercise_count: number;
  completed: boolean;
  order: number;
};

const DAYS = ["L", "M", "M", "G", "V", "S", "D"];

function isoForMondayOffset(offset: number): string {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const d = new Date(now);
  d.setDate(now.getDate() - day + offset);
  return d.toISOString().slice(0, 10);
}

export default function Home() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await api<{ lessons: Lesson[] }>("/lessons");
      setLessons(data.lessons);
      await refresh();
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!user) return null;

  const pct = user.xp_needed > 0 ? (user.xp_in_level / user.xp_needed) * 100 : 100;
  const currentIndex = lessons.findIndex((l) => !l.completed);
  const activeIdx = currentIndex === -1 ? lessons.length - 1 : currentIndex;
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: COLORS.bg }]} edges={["top"]}>
      {/* Sfondo decorativo — 4 bolle */}
      <View style={styles.bgBlob1} />
      <View style={styles.bgBlob2} />
      <View style={styles.bgBlob3} />
      <View style={styles.bgBlob4} />

      <View style={styles.topBar}>
        <TouchableOpacity
          testID="level-badge"
          style={[styles.levelBadge, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}
          onPress={() => router.push("/(tabs)/profile")}
          activeOpacity={0.8}
        >
          <Ionicons name="star" size={18} color={COLORS.secondary} />
          <Text style={[styles.levelText, { color: COLORS.text }]}>Lv {user.level}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="xp-bar"
          style={styles.xpWrap}
          activeOpacity={0.8}
          onPress={() => router.push("/(tabs)/profile")}
        >
          <View style={[styles.xpTrack, { backgroundColor: COLORS.border }]}>
            <View style={[styles.xpFill, { width: `${pct}%` }]} />
          </View>
          <Text style={[styles.xpText, { color: COLORS.textMuted }]}>
            {user.xp_in_level}/{user.xp_needed} XP
          </Text>
        </TouchableOpacity>

        <View style={[styles.streakBadge, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
          <Text style={styles.flame}>🔥</Text>
          <Text style={[styles.streakNum, { color: COLORS.primary }]} testID="streak-count">{user.streak}</Text>
        </View>
      </View>

      <View style={[styles.weekStrip, { backgroundColor: COLORS.surface, borderColor: COLORS.border }]}>
        {DAYS.map((d, i) => {
          const iso = isoForMondayOffset(i);
          const done = user.streak_days?.includes(iso);
          const isToday = iso === todayIso;
          return (
            <View key={i} style={styles.dayCol}>
              <Text style={[styles.dayLabel, { color: COLORS.textMuted }, isToday && { color: COLORS.primary, fontWeight: "800" }]}>
                {d}
              </Text>
              <View style={[styles.dayDot, { backgroundColor: COLORS.border }, done && styles.dayDotDone]}>
                {done ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
            </View>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
        ) : lessons.length === 0 ? (
          <View style={styles.empty}>
            <Mascot size={120} />
            <Text style={[styles.emptyTitle, { color: COLORS.text }]}>Nessuna lezione ancora!</Text>
            <Text style={[styles.emptyText, { color: COLORS.textMuted }]}>
              {user.role === "admin"
                ? "Vai al profilo per creare la tua prima lezione."
                : "Il tuo docente deve ancora pubblicare lezioni. Torna presto!"}
            </Text>
            {user.role === "admin" && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push("/admin")}
                testID="admin-shortcut"
              >
                <Text style={styles.primaryBtnText}>Pannello docente</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.path}>
            {lessons.map((l, i) => {
              const align = i % 2 === 0 ? "flex-start" : "flex-end";
              const isActive = i === activeIdx;
              const isLocked = i > activeIdx;
              return (
                <View key={l.id} style={[styles.nodeRow, { alignItems: align }, isActive && { paddingTop: 54 }]}>
                  <TouchableOpacity
                    testID={`lesson-node-${i}`}
                    disabled={isLocked}
                    onPress={() => router.push(`/lesson/${l.id}`)}
                    activeOpacity={0.8}
                    style={[
                      styles.node,
                      l.completed && styles.nodeCompleted,
                      isActive && styles.nodeActive,
                      isLocked && { backgroundColor: COLORS.border, borderBottomColor: COLORS.textDisabled },
                    ]}
                  >
                    {l.completed ? (
                      <Ionicons name="checkmark" size={30} color="#fff" />
                    ) : isLocked ? (
                      <Ionicons name="lock-closed" size={24} color={COLORS.textDisabled} />
                    ) : (
                      <Text style={styles.nodeNum}>{i + 1}</Text>
                    )}
                    {isActive && (
                      <View style={styles.mascotOnNode}>
                        <Mascot size={58} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text style={[styles.nodeTitle, { color: COLORS.text, textAlign: align === "flex-start" ? "left" : "right" }]}>
                    {l.title}
                  </Text>
                  <Text style={[styles.nodeMeta, { color: COLORS.textMuted }]}>{l.exercise_count} esercizi</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: "hidden" },

  bgBlob1: {
    position: "absolute", width: 300, height: 300, borderRadius: 150,
    backgroundColor: "#E63946", opacity: 0.06, top: -80, right: -80,
  },
  bgBlob2: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "#FFD166", opacity: 0.10, top: 200, left: -60,
  },
  bgBlob3: {
    position: "absolute", width: 250, height: 250, borderRadius: 125,
    backgroundColor: "#06D6A0", opacity: 0.06, bottom: 100, right: -40,
  },
  bgBlob4: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "#FFD166", opacity: 0.08, bottom: 200, left: -30,
  },

  topBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
  },
  levelBadge: {
    flexDirection: "row", alignItems: "center", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 2, gap: 6,
  },
  levelText: { fontWeight: "800" },
  xpWrap: { flex: 1 },
  xpTrack: { height: 14, borderRadius: 999, overflow: "hidden" },
  xpFill: { height: "100%", backgroundColor: "#FFD166", borderRadius: 999 },
  xpText: { fontSize: 11, marginTop: 3, textAlign: "center", fontWeight: "700" },
  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 2,
  },
  flame: { fontSize: 18 },
  streakNum: { fontWeight: "800" },
  weekStrip: {
    flexDirection: "row", justifyContent: "space-around",
    paddingHorizontal: 20, paddingVertical: 10,
    marginHorizontal: 16, borderRadius: 16, borderWidth: 2,
  },
  dayCol: { alignItems: "center", gap: 4 },
  dayLabel: { fontSize: 12, fontWeight: "700" },
  dayDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  dayDotDone: { backgroundColor: "#06D6A0" },
  scroll: { padding: 20, paddingBottom: 100, paddingTop: 24 },
  empty: { alignItems: "center", paddingTop: 40, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "900" },
  emptyText: { textAlign: "center", fontSize: 15, lineHeight: 22, paddingHorizontal: 20 },
  primaryBtn: {
    backgroundColor: "#E63946", paddingHorizontal: 20, paddingVertical: 14,
    borderRadius: 14, borderBottomWidth: 4, borderBottomColor: "#B91C1C", marginTop: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  path: { gap: 20 },
  nodeRow: { gap: 4 },
  node: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "#FFD166", borderBottomWidth: 6, borderBottomColor: "#FFB703",
    alignItems: "center", justifyContent: "center", position: "relative",
  },
  nodeCompleted: { backgroundColor: "#06D6A0", borderBottomColor: "#04A77D" },
  nodeActive: { backgroundColor: "#E63946", borderBottomColor: "#B91C1C" },
  nodeNum: { fontSize: 28, fontWeight: "900", color: "#fff" },
  mascotOnNode: { position: "absolute", top: -52 },
  nodeTitle: { fontSize: 16, fontWeight: "800", marginTop: 6, maxWidth: 200 },
  nodeMeta: { fontSize: 12 },
});