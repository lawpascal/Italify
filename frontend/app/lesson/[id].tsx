import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";
import Mascot from "../../src/Mascot";
import Confetti from "../../src/Confetti";
import { useAuth } from "../../src/auth";

type Exercise = {
  id: string;
  type:
    | "multiple_choice"
    | "true_false"
    | "right_wrong"
    | "open_answer"
    | "word_order"
    | "audio"
    | "video";
  question: string;
  options?: string[];
  correct_index?: number | null;
  correct_bool?: boolean | null;
  accepted_answers?: string[];
  correct_order?: string[];
  scrambled?: string[];
  media_base64?: string;
  media_url?: string;
  media_mime?: string;
  explanation?: string;
};

type Lesson = {
  id: string;
  title: string;
  description: string;
  shuffle: boolean;
  exercises: Exercise[];
};

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { refresh } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Exercise[]>([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<any>(null);
  const [result, setResult] = useState<null | {
    correct: boolean;
    xp: number;
    explanation?: string;
  }>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [descExpanded, setDescExpanded] = useState(false);

  // FIX 6: traccia se siamo in modalità ripasso (senza mostrare risposta)
  const [isReviewMode, setIsReviewMode] = useState(false);

  // performance tracking
  const [startTs] = useState(Date.now());
  const [correctCount, setCorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [wrongExercises, setWrongExercises] = useState<Exercise[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { lesson } = await api<{ lesson: Lesson }>(`/lessons/${id}`);
        setLesson(lesson);
        const ex = lesson.shuffle ? shuffleArr(lesson.exercises) : lesson.exercises;
        setOrder(ex);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  const current = order[idx];

  const scrambled = useMemo(() => {
    if (current?.type !== "word_order") return [];
    if (current.scrambled && current.scrambled.length) return current.scrambled;
    return shuffleArr(current.correct_order || []);
  }, [current?.id]);

  const [pickedWords, setPickedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<{ word: string; key: number }[]>([]);

  useEffect(() => {
    setAnswer(null);
    setResult(null);
    setPickedWords([]);
    if (current?.type === "word_order") {
      setAvailableWords(scrambled.map((w, i) => ({ word: w, key: i })));
    } else {
      setAvailableWords([]);
    }
  }, [current?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }
  if (!lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20 }}>Lezione non trovata</Text>
      </SafeAreaView>
    );
  }

  if (finished) {
    return <CompletionScreen
      lesson={lesson}
      xp={xpEarned}
      timeMs={Date.now() - startTs}
      correct={correctCount}
      total={order.length}
      bestCombo={bestCombo}
      wrong={wrongExercises}
      onReview={() => {
        // FIX 6: modalità ripasso — non mostrare la risposta giusta, far ritentare
        setOrder(wrongExercises);
        setIdx(0);
        setWrongExercises([]);
        setCorrectCount(0);
        setCombo(0);
        setBestCombo(0);
        setXpEarned(0);
        setFinished(false);
        setIsReviewMode(true);
      }}
      onFinish={async () => {
        await refresh();
        router.replace("/(tabs)");
      }}
    />;
  }

  const progressPct = ((idx + (result ? 1 : 0)) / order.length) * 100;

  const submit = async () => {
    if (!current) return;
    if (answer === null || answer === undefined || (Array.isArray(answer) && answer.length === 0)) return;
    try {
      const res = await api<{
        correct: boolean;
        xp_awarded: number;
        already_solved: boolean;
        explanation?: string;
      }>("/progress/answer", {
        method: "POST",
        body: { lesson_id: lesson.id, exercise_id: current.id, answer },
      });

      // FIX 6: in modalità ripasso, se sbagliato non mostrare la risposta — far riprovare
      if (isReviewMode && !res.correct) {
        // Mostra solo feedback "riprova" senza svelare la risposta
        setResult({ correct: false, xp: 0, explanation: "Riprova! Puoi farcela 💪" });
        return;
      }

      setResult({ correct: res.correct, xp: res.xp_awarded, explanation: res.explanation });
      if (res.correct) {
        setCorrectCount((c) => c + 1);
        setXpEarned((x) => x + res.xp_awarded);
        setCombo((c) => {
          const nc = c + 1;
          setBestCombo((b) => Math.max(b, nc));
          return nc;
        });
      } else {
        setCombo(0);
        setWrongExercises((w) => (w.find((e) => e.id === current.id) ? w : [...w, current]));
      }
    } catch (e: any) {
      // noop
    }
  };

  // FIX 6: in ripasso se sbagliato, "Riprova" resetta la risposta senza andare avanti
  const handleReviewRetry = () => {
    setAnswer(null);
    setResult(null);
    setPickedWords([]);
    if (current?.type === "word_order") {
      setAvailableWords(scrambled.map((w, i) => ({ word: w, key: i })));
    }
  };

  const next = async () => {
    if (idx + 1 >= order.length) {
      try {
        await api("/progress/complete-lesson", {
          method: "POST",
          body: {
            lesson_id: lesson.id,
            total_time_ms: Date.now() - startTs,
            correct_count: correctCount,
            total_count: order.length,
            best_combo: bestCombo,
            xp_earned: xpEarned,
          },
        });
      } catch {}
      setFinished(true);
      return;
    }
    setIdx(idx + 1);
  };

  const toggleSave = async () => {
    if (!current) return;
    const key = current.id;
    if (saved.has(key)) {
      try {
        await api(
          `/saved?lesson_id=${encodeURIComponent(lesson.id)}&exercise_id=${encodeURIComponent(key)}`,
          { method: "DELETE" }
        );
      } catch {}
      const s = new Set(saved);
      s.delete(key);
      setSaved(s);
    } else {
      try {
        await api("/saved", {
          method: "POST",
          body: { lesson_id: lesson.id, exercise_id: key },
        });
      } catch {}
      const s = new Set(saved);
      s.add(key);
      setSaved(s);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} testID="lesson-close">
            <Ionicons name="close" size={28} color={COLORS.textMuted} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <TouchableOpacity onPress={toggleSave} testID="lesson-save">
            <Ionicons
              name={saved.has(current?.id || "") ? "bookmark" : "bookmark-outline"}
              size={26}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        </View>

        {idx === 0 && !result && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setDescExpanded((v) => !v)}
            style={styles.descBox}
          >
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text numberOfLines={descExpanded ? undefined : 2} style={styles.descText}>
              {lesson.description}
            </Text>
            {lesson.description.length > 80 && (
              <Text style={styles.expandBtn}>{descExpanded ? "Riduci ▲" : "Leggi tutto ▼"}</Text>
            )}
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.question} testID="exercise-question">{current?.question}</Text>

          {/* Media immagine */}
          {current?.media_base64 && !["audio", "video"].includes(current.type) && (
            <Image
              source={{ uri: `data:${current.media_mime || "image/png"};base64,${current.media_base64}` }}
              style={styles.mediaImage}
              resizeMode="contain"
            />
          )}

          {/* FIX 3: mostra immagine ANCHE per esercizi audio/video se c'è media_base64 di tipo immagine */}
          {current?.media_base64 && ["audio", "video"].includes(current.type) && current.media_mime?.startsWith("image/") && (
            <Image
              source={{ uri: `data:${current.media_mime};base64,${current.media_base64}` }}
              style={styles.mediaImage}
              resizeMode="contain"
            />
          )}

          {current?.type === "multiple_choice" && (
            <View style={styles.opts}>
              {current.options?.map((opt, i) => {
                const selected = answer === i;
                const isCorrectOpt = result && current.correct_index === i;
                const isWrongPick = result && selected && !result.correct;
                return (
                  <TouchableOpacity
                    key={i}
                    testID={`opt-${i}`}
                    disabled={!!result}
                    style={[
                      styles.optCard,
                      selected && styles.optSelected,
                      isCorrectOpt && styles.optCorrect,
                      isWrongPick && styles.optWrong,
                    ]}
                    onPress={() => setAnswer(i)}
                  >
                    <Text style={[styles.optText, (selected || isCorrectOpt || isWrongPick) && { color: "#fff" }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {(current?.type === "true_false" || current?.type === "right_wrong") && (
            <View style={styles.tfRow}>
              {[true, false].map((val) => {
                const selected = answer === val;
                const isCorrectOpt = result && current.correct_bool === val;
                const isWrongPick = result && selected && !result.correct;
                const label =
                  current.type === "true_false"
                    ? val ? "Vero" : "Falso"
                    : val ? "Giusto" : "Sbagliato";
                return (
                  <TouchableOpacity
                    key={String(val)}
                    testID={`tf-${val}`}
                    disabled={!!result}
                    style={[
                      styles.tfCard,
                      selected && styles.optSelected,
                      isCorrectOpt && styles.optCorrect,
                      isWrongPick && styles.optWrong,
                    ]}
                    onPress={() => setAnswer(val)}
                  >
                    <Text style={[styles.tfText, (selected || isCorrectOpt || isWrongPick) && { color: "#fff" }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {current?.type === "open_answer" && (
            <TextInput
              testID="open-answer-input"
              style={[
                styles.openInput,
                result && (result.correct ? styles.inputCorrect : styles.inputWrong),
              ]}
              placeholder="Scrivi la tua risposta…"
              placeholderTextColor={COLORS.textDisabled}
              value={answer || ""}
              onChangeText={setAnswer}
              editable={!result}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {/* FIX 2: word_order — parola per parola con spazi separati */}
          {current?.type === "word_order" && (
            <View>
              {/* Area risposta */}
              <View style={styles.wordBank}>
                {pickedWords.length === 0 ? (
                  <Text style={styles.bankHint}>Tocca le parole nell'ordine giusto</Text>
                ) : (
                  pickedWords.map((w, i) => (
                    <TouchableOpacity
                      key={`picked-${i}`}
                      disabled={!!result}
                      style={[
                        styles.wordChip,
                        styles.wordChipPicked,
                        result && result.correct && styles.wordChipCorrect,
                        result && !result.correct && styles.wordChipWrong,
                      ]}
                      onPress={() => {
                        if (result) return;
                        const np = [...pickedWords];
                        np.splice(i, 1);
                        setPickedWords(np);
                        setAvailableWords((a) => [...a, { word: w, key: Date.now() + i }]);
                        setAnswer(np.length > 0 ? np : null);
                      }}
                    >
                      <Text style={[styles.wordText, styles.wordTextPicked]}>{w}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              {/* Parole disponibili */}
              <View style={styles.wordPool}>
                {availableWords.map((w) => (
                  <TouchableOpacity
                    key={w.key}
                    disabled={!!result}
                    style={styles.wordChip}
                    onPress={() => {
                      const np = [...pickedWords, w.word];
                      setPickedWords(np);
                      setAvailableWords((a) => a.filter((x) => x.key !== w.key));
                      setAnswer(np);
                    }}
                  >
                    <Text style={styles.wordText}>{w.word}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* FIX 3: audio/video — gestione migliorata */}
          {(current?.type === "audio" || current?.type === "video") && (
            <AudioVideoBox
              mime={current.media_mime}
              base64={current.media_base64}
              url={current.media_url}
              type={current.type}
            />
          )}

          {result && (
            <View style={[styles.feedback, result.correct ? styles.feedbackOk : styles.feedbackKo]}>
              <Text style={styles.feedbackTitle}>
                {result.correct ? "✅ Corretto!" : "❌ Sbagliato"}
                {result.correct && result.xp > 0 ? ` (+${result.xp} XP)` : ""}
              </Text>
              {result.explanation ? <Text style={styles.feedbackExp}>{result.explanation}</Text> : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {!result ? (
            <TouchableOpacity
              testID="submit-answer"
              style={[styles.primaryBtn, (answer === null || answer === undefined || (Array.isArray(answer) && answer.length === 0)) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={answer === null || answer === undefined || (Array.isArray(answer) && answer.length === 0)}
            >
              <Text style={styles.primaryBtnText}>Controlla</Text>
            </TouchableOpacity>
          ) : (
            // FIX 6: in modalità ripasso e risposta sbagliata → bottone "Riprova"
            isReviewMode && !result.correct ? (
              <TouchableOpacity
                testID="retry-btn"
                style={[styles.primaryBtn, styles.errBtn]}
                onPress={handleReviewRetry}
              >
                <Text style={styles.primaryBtnText}>Riprova 💪</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                testID="next-btn"
                style={[styles.primaryBtn, result.correct ? styles.okBtn : styles.errBtn]}
                onPress={next}
              >
                <Text style={styles.primaryBtnText}>
                  {idx + 1 >= order.length ? "Termina" : "Continua"}
                </Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {result?.correct && <Confetti count={35} />}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// FIX 3: AudioVideoBox migliorato con gestione errori e URL esterno
function AudioVideoBox({ mime, base64, url, type }: { mime?: string; base64?: string; url?: string; type: string }) {
  const [sound, setSound] = useState<any>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determina la sorgente: prima URL esterno, poi base64
  const source = url || (base64 ? `data:${mime || (type === "audio" ? "audio/mp3" : "video/mp4")};base64,${base64}` : null);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  if (!source) {
    return (
      <View style={styles.audioBox}>
        <Ionicons name="alert-circle-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.audioHint}>Nessun media disponibile</Text>
      </View>
    );
  }

  if (type === "audio") {
    const play = async () => {
      try {
        setError(null);
        const { Audio } = require("expo-av");
        if (sound) {
          if (playing) {
            await sound.pauseAsync();
            setPlaying(false);
          } else {
            await sound.playAsync();
            setPlaying(true);
          }
          return;
        }
        const { sound: s } = await Audio.Sound.createAsync({ uri: source });
        setSound(s);
        await s.playAsync();
        setPlaying(true);
        s.setOnPlaybackStatusUpdate((st: any) => {
          if (st.didJustFinish) setPlaying(false);
        });
      } catch (e) {
        setError("Impossibile riprodurre l'audio. Verifica il file.");
      }
    };
    return (
      <TouchableOpacity style={styles.audioBox} onPress={play} testID="audio-play">
        <Ionicons name={playing ? "pause-circle" : "play-circle"} size={72} color={COLORS.primary} />
        <Text style={styles.audioHint}>Tocca per {playing ? "mettere in pausa" : "ascoltare"}</Text>
        {error && <Text style={{ color: COLORS.error, marginTop: 8, textAlign: "center" }}>{error}</Text>}
      </TouchableOpacity>
    );
  }

  // Video
  try {
    const { Video } = require("expo-av");
    return (
      <Video
        source={{ uri: source }}
        style={styles.videoBox}
        useNativeControls
        resizeMode="contain"
        shouldPlay={false}
      />
    );
  } catch {
    return (
      <View style={styles.audioBox}>
        <Ionicons name="videocam-off-outline" size={48} color={COLORS.textMuted} />
        <Text style={styles.audioHint}>Video non disponibile su questa piattaforma</Text>
      </View>
    );
  }
}

function CompletionScreen({
  lesson, xp, timeMs, correct, total, bestCombo, wrong, onReview, onFinish,
}: {
  lesson: Lesson; xp: number; timeMs: number; correct: number; total: number;
  bestCombo: number; wrong: Exercise[]; onReview: () => void; onFinish: () => void;
}) {
  const mins = timeMs / 60000;
  let speed = "Buono";
  if (mins < 2) speed = "Fulmineo ⚡";
  else if (mins < 5) speed = "Veloce 🚀";
  else if (mins < 10) speed = "Buono 👍";
  else speed = "Con calma 🌿";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Confetti count={80} />
      <View style={styles.celebWrap}>
        <Mascot size={160} />
        <Text style={styles.celebTitle}>Lezione completata!</Text>
        <Text style={styles.celebSub}>{lesson.title}</Text>
        <View style={styles.recapCard}>
          <RecapRow icon="flash" label="XP guadagnati" value={`+${xp}`} />
          <RecapRow icon="time" label="Tempo" value={speed} />
          <RecapRow icon="flame" label="Miglior combo" value={`x${bestCombo}`} />
          <RecapRow icon="checkmark-circle" label="Risposte corrette" value={`${correct}/${total}`} />
        </View>
        <TouchableOpacity style={styles.primaryBtnFull} onPress={onFinish} testID="claim-xp">
          <Text style={styles.primaryBtnText}>Ricevi XP e torna alla homepage</Text>
        </TouchableOpacity>
        {wrong.length > 0 && (
          <TouchableOpacity style={styles.outlineBtnFull} onPress={onReview} testID="review-btn">
            <Text style={styles.outlineBtnText}>Ripassa ({wrong.length} errori)</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

function RecapRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.recapRow}>
      <Ionicons name={icon} size={22} color={COLORS.primary} />
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  progressTrack: { flex: 1, height: 14, backgroundColor: COLORS.border, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.success, borderRadius: 999 },
  descBox: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    marginHorizontal: 14, borderWidth: 2, borderColor: COLORS.border,
  },
  lessonTitle: { fontSize: 20, fontWeight: "900", color: COLORS.primary, marginBottom: 6 },
  descText: { color: COLORS.text, fontSize: 15, lineHeight: 22 },
  expandBtn: { color: COLORS.primary, fontWeight: "800", marginTop: 6 },
  scroll: { padding: 20, gap: 16, paddingBottom: 40 },
  question: { fontSize: 22, fontWeight: "800", color: COLORS.text, lineHeight: 30 },
  mediaImage: { width: "100%", height: 200, borderRadius: 12, backgroundColor: COLORS.borderLight },
  opts: { gap: 10 },
  optCard: {
    padding: 16, borderRadius: 16, backgroundColor: COLORS.surface,
    borderWidth: 2, borderBottomWidth: 4, borderColor: COLORS.border,
  },
  optSelected: { backgroundColor: COLORS.info, borderColor: "#0a7494" },
  optCorrect: { backgroundColor: COLORS.success, borderColor: COLORS.successDark },
  optWrong: { backgroundColor: COLORS.error, borderColor: "#c13057" },
  optText: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  tfRow: { flexDirection: "row", gap: 12 },
  tfCard: {
    flex: 1, paddingVertical: 24, borderRadius: 16, backgroundColor: COLORS.surface,
    borderWidth: 2, borderBottomWidth: 4, borderColor: COLORS.border, alignItems: "center",
  },
  tfText: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  openInput: {
    backgroundColor: COLORS.surface, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: 14, padding: 16, fontSize: 17, color: COLORS.text,
  },
  inputCorrect: { borderColor: COLORS.success, backgroundColor: "#e8faf4" },
  inputWrong: { borderColor: COLORS.error, backgroundColor: "#fdecf0" },

  // FIX 2: word order styles migliorati
  wordBank: {
    minHeight: 90,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "flex-start",
  },
  bankHint: { color: COLORS.textDisabled, fontStyle: "italic", alignSelf: "center", marginTop: 16 },
  wordPool: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  wordChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  wordChipPicked: { backgroundColor: COLORS.info, borderColor: "#0a7494" },
  wordChipCorrect: { backgroundColor: COLORS.success, borderColor: COLORS.successDark },
  wordChipWrong: { backgroundColor: COLORS.error, borderColor: "#c13057" },
  wordText: { fontWeight: "700", color: COLORS.text, fontSize: 16 },
  wordTextPicked: { color: "#fff" },

  audioBox: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 32,
    alignItems: "center", borderWidth: 2, borderColor: COLORS.border, gap: 8,
  },
  audioHint: { marginTop: 4, color: COLORS.textMuted, fontWeight: "600", textAlign: "center" },
  videoBox: { width: "100%", height: 240, borderRadius: 14, backgroundColor: "#000" },
  feedback: { padding: 16, borderRadius: 14, gap: 6 },
  feedbackOk: { backgroundColor: "#e8faf4", borderWidth: 2, borderColor: COLORS.success },
  feedbackKo: { backgroundColor: "#fdecf0", borderWidth: 2, borderColor: COLORS.error },
  feedbackTitle: { fontWeight: "900", fontSize: 16, color: COLORS.text },
  feedbackExp: { color: COLORS.text, lineHeight: 20 },
  footer: { padding: 16, borderTopWidth: 2, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  primaryBtn: {
    backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 16,
    alignItems: "center", borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark,
  },
  okBtn: { backgroundColor: COLORS.success, borderBottomColor: COLORS.successDark },
  errBtn: { backgroundColor: COLORS.error, borderBottomColor: "#c13057" },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  celebWrap: { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 30, gap: 14 },
  celebTitle: { fontSize: 30, fontWeight: "900", color: COLORS.primary, marginTop: 10 },
  celebSub: { fontSize: 16, color: COLORS.textMuted },
  recapCard: {
    width: "100%", backgroundColor: COLORS.surface, borderWidth: 2,
    borderColor: COLORS.border, borderRadius: 18, padding: 16, gap: 10, marginTop: 10,
  },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  recapLabel: { flex: 1, color: COLORS.text, fontWeight: "700" },
  recapValue: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  primaryBtnFull: {
    marginTop: 16, width: "100%", backgroundColor: COLORS.primary, paddingVertical: 18,
    borderRadius: 16, alignItems: "center", borderBottomWidth: 4, borderBottomColor: COLORS.primaryDark,
  },
  outlineBtnFull: {
    width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center",
    borderWidth: 2, borderColor: COLORS.primary, backgroundColor: "#fff",
  },
  outlineBtnText: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
});