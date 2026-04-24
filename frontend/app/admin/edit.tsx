import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { api } from "../../src/api";
import { COLORS } from "../../src/theme";

type ExType = "multiple_choice" | "true_false" | "right_wrong" | "open_answer" | "word_order" | "audio" | "video";
type Ex = {
  id?: string;
  type: ExType;
  question: string;
  options?: string[];
  correct_index?: number | null;
  correct_bool?: boolean | null;
  accepted_answers?: string[];
  correct_order?: string[];
  media_base64?: string | null;
  media_mime?: string | null;
  explanation?: string;
};

const TYPE_OPTIONS: { value: ExType; label: string }[] = [
  { value: "multiple_choice", label: "Scelta multipla" },
  { value: "true_false", label: "Vero / Falso" },
  { value: "right_wrong", label: "Giusto / Sbagliato" },
  { value: "open_answer", label: "Risposta aperta" },
  { value: "word_order", label: "Riordino parole" },
  { value: "audio", label: "Audio" },
  { value: "video", label: "Video" },
];

export default function EditLesson() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = !id || id === "new";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [shuffle, setShuffle] = useState(false);
  const [order, setOrder] = useState(0);
  const [exercises, setExercises] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isNew) {
      (async () => {
        try {
          const { lesson } = await api<{ lesson: any }>(`/lessons/${id}`);
          setTitle(lesson.title);
          setDescription(lesson.description);
          setShuffle(lesson.shuffle);
          setOrder(lesson.order);
          setExercises(lesson.exercises);
        } catch (e: any) {
          Alert.alert("Errore", e.message);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id]);

  const addExercise = () => {
    setExercises((prev) => [...prev, { type: "multiple_choice", question: "", options: ["", ""], correct_index: 0 }]);
  };

  const updateEx = (i: number, patch: Partial<Ex>) => {
    setExercises((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const removeEx = (i: number) => {
    setExercises((prev) => prev.filter((_, idx) => idx !== i));
  };

  const pickMedia = async (i: number, kind: "audio" | "video" | "image") => {
    const res = await DocumentPicker.getDocumentAsync({
      type: kind === "audio" ? "audio/*" : kind === "video" ? "video/*" : "image/*",
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      updateEx(i, { media_base64: b64, media_mime: asset.mimeType || undefined });
    } catch (e: any) {
      Alert.alert("Errore caricamento", e.message);
    }
  };

  const save = async () => {
    if (!title.trim()) {
      Alert.alert("Errore", "Inserisci un titolo");
      return;
    }
    // Validate exercises
    for (const [i, ex] of exercises.entries()) {
      if (!ex.question.trim() && ex.type !== "audio" && ex.type !== "video") {
        Alert.alert("Errore", `Esercizio ${i + 1}: inserisci la domanda`);
        return;
      }
    }
    const payload = {
      title,
      description,
      shuffle,
      order,
      exercises: exercises.map((e) => ({
        type: e.type,
        question: e.question,
        options: e.options,
        correct_index: e.correct_index ?? undefined,
        correct_bool: e.correct_bool ?? undefined,
        accepted_answers: e.accepted_answers,
        correct_order: e.correct_order,
        media_base64: e.media_base64 || undefined,
        media_mime: e.media_mime || undefined,
        explanation: e.explanation,
      })),
    };
    setSaving(true);
    try {
      if (isNew) {
        await api("/lessons", { method: "POST", body: payload });
      } else {
        await api(`/lessons/${id}`, { method: "PUT", body: payload });
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Errore", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 60 }} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{isNew ? "Nuova lezione" : "Modifica lezione"}</Text>
          <TouchableOpacity onPress={save} disabled={saving} testID="save-lesson">
            {saving ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.saveText}>Salva</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Titolo</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} testID="lesson-title-input" />

          <Text style={styles.label}>Descrizione</Text>
          <TextInput
            style={[styles.input, { minHeight: 80 }]}
            value={description}
            onChangeText={setDescription}
            multiline
            testID="lesson-desc-input"
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Ordine casuale esercizi</Text>
            <Switch value={shuffle} onValueChange={setShuffle} />
          </View>

          <Text style={styles.label}>Posizione in lista</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(order)}
            onChangeText={(t) => setOrder(parseInt(t || "0", 10) || 0)}
          />

          <View style={{ marginTop: 20, gap: 12 }}>
            <Text style={styles.sectionTitle}>Esercizi ({exercises.length})</Text>
            {exercises.map((ex, i) => (
              <ExerciseEditor
                key={i}
                ex={ex}
                index={i}
                onChange={(patch) => updateEx(i, patch)}
                onRemove={() => removeEx(i)}
                onPickMedia={(kind) => pickMedia(i, kind)}
              />
            ))}
            <TouchableOpacity style={styles.addBtn} onPress={addExercise} testID="add-exercise">
              <Ionicons name="add" size={20} color={COLORS.primary} />
              <Text style={styles.addBtnText}>Aggiungi esercizio</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ExerciseEditor({
  ex,
  index,
  onChange,
  onRemove,
  onPickMedia,
}: {
  ex: Ex;
  index: number;
  onChange: (p: Partial<Ex>) => void;
  onRemove: () => void;
  onPickMedia: (kind: "audio" | "video" | "image") => void;
}) {
  return (
    <View style={styles.exCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.exTitle}>Esercizio #{index + 1}</Text>
        <TouchableOpacity onPress={onRemove}>
          <Ionicons name="trash" size={20} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <View style={styles.typeRow}>
        {TYPE_OPTIONS.map((t) => (
          <TouchableOpacity
            key={t.value}
            style={[styles.typeChip, ex.type === t.value && styles.typeChipActive]}
            onPress={() =>
              onChange({
                type: t.value,
                options: t.value === "multiple_choice" ? ex.options || ["", ""] : undefined,
                correct_index: t.value === "multiple_choice" ? 0 : undefined,
                correct_bool: t.value === "true_false" || t.value === "right_wrong" ? true : undefined,
                accepted_answers: t.value === "open_answer" ? ex.accepted_answers || [""] : undefined,
                correct_order: t.value === "word_order" ? ex.correct_order || [] : undefined,
              })
            }
          >
            <Text style={[styles.typeChipText, ex.type === t.value && { color: "#fff" }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Domanda / Istruzione</Text>
      <TextInput
        style={styles.input}
        value={ex.question}
        onChangeText={(t) => onChange({ question: t })}
        multiline
      />

      {ex.type === "multiple_choice" && (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>Opzioni (tocca ● per la risposta corretta)</Text>
          {(ex.options || []).map((opt, i) => (
            <View key={i} style={styles.optRow}>
              <TouchableOpacity onPress={() => onChange({ correct_index: i })} style={styles.radio}>
                <Ionicons
                  name={ex.correct_index === i ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={ex.correct_index === i ? COLORS.success : COLORS.textDisabled}
                />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={opt}
                onChangeText={(t) => {
                  const newOpts = [...(ex.options || [])];
                  newOpts[i] = t;
                  onChange({ options: newOpts });
                }}
              />
              <TouchableOpacity
                onPress={() => {
                  const newOpts = (ex.options || []).filter((_, idx) => idx !== i);
                  onChange({
                    options: newOpts,
                    correct_index: ex.correct_index === i ? 0 : ex.correct_index,
                  });
                }}
              >
                <Ionicons name="close-circle" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            onPress={() => onChange({ options: [...(ex.options || []), ""] })}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>+ Opzione</Text>
          </TouchableOpacity>
        </View>
      )}

      {(ex.type === "true_false" || ex.type === "right_wrong") && (
        <View style={styles.typeRow}>
          {[true, false].map((val) => (
            <TouchableOpacity
              key={String(val)}
              style={[styles.typeChip, ex.correct_bool === val && styles.typeChipActive]}
              onPress={() => onChange({ correct_bool: val })}
            >
              <Text style={[styles.typeChipText, ex.correct_bool === val && { color: "#fff" }]}>
                Corretta: {ex.type === "true_false" ? (val ? "Vero" : "Falso") : val ? "Giusto" : "Sbagliato"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {ex.type === "open_answer" && (
        <View>
          <Text style={styles.label}>Risposte accettate (separate da virgola)</Text>
          <TextInput
            style={styles.input}
            value={(ex.accepted_answers || []).join(", ")}
            onChangeText={(t) => onChange({ accepted_answers: t.split(",").map((s) => s.trim()).filter(Boolean) })}
          />
        </View>
      )}

{ex.type === "word_order" && (
  <View>
    <Text style={styles.label}>Parole nell'ordine corretto</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
      {(ex.correct_order || []).map((word, wi) => (
        <TouchableOpacity
          key={wi}
          style={{ flexDirection: "row", alignItems: "center", backgroundColor: COLORS.primary, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}
          onPress={() => {
            const newOrder = (ex.correct_order || []).filter((_, idx) => idx !== wi);
            onChange({ correct_order: newOrder });
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>{word}</Text>
          <Ionicons name="close" size={14} color="#fff" />
        </TouchableOpacity>
      ))}
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <TextInput
        style={[styles.input, { flex: 1, marginBottom: 0 }]}
        placeholder="Scrivi una parola..."
        placeholderTextColor={COLORS.textDisabled}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={(e) => {
          const word = e.nativeEvent.text.trim();
          if (word) onChange({ correct_order: [...(ex.correct_order || []), word] });
        }}
        returnKeyType="done"
      />
      <TouchableOpacity
        style={[styles.smallBtn, { marginTop: 0 }]}
        onPress={() => {
          const input = document.querySelector(`[data-wordorder="${index}"]`) as any;
          const word = input?.value?.trim();
          if (word) { onChange({ correct_order: [...(ex.correct_order || []), word] }); input.value = ""; }
        }}
      >
        <Text style={styles.smallBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
)}

      {(ex.type === "audio" || ex.type === "video") && (
        <View>
          <Text style={styles.label}>{ex.type === "audio" ? "Audio" : "Video"} caricato</Text>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => onPickMedia(ex.type === "audio" ? "audio" : "video")}
          >
            <Text style={styles.smallBtnText}>
              {ex.media_base64 ? "Sostituisci file" : `Carica ${ex.type}`}
            </Text>
          </TouchableOpacity>
          {ex.media_base64 ? (
            <Text style={{ color: COLORS.success, marginTop: 4, fontSize: 12 }}>
              ✓ File caricato ({ex.media_mime || "media"})
            </Text>
          ) : null}
        </View>
      )}

      <Text style={styles.label}>Immagine allegata (opzionale)</Text>
      <TouchableOpacity style={styles.smallBtn} onPress={() => onPickMedia("image")}>
        <Text style={styles.smallBtnText}>
          {ex.media_base64 && (ex.media_mime || "").startsWith("image") ? "Sostituisci immagine" : "Carica immagine"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Spiegazione (mostrata dopo la risposta)</Text>
      <TextInput
        style={[styles.input, { minHeight: 60 }]}
        value={ex.explanation || ""}
        onChangeText={(t) => onChange({ explanation: t })}
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  saveText: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  scroll: { padding: 16, paddingBottom: 80 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: COLORS.text,
    marginBottom: 4,
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: COLORS.text, marginBottom: 6 },
  exCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  exTitle: { fontSize: 15, fontWeight: "900", color: COLORS.primary },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primaryDark },
  typeChipText: { fontSize: 12, color: COLORS.text, fontWeight: "700" },
  optRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  radio: { padding: 4 },
  smallBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: COLORS.primary,
    marginTop: 6,
  },
  smallBtnText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    backgroundColor: "#fff",
    marginTop: 6,
  },
  addBtnText: { color: COLORS.primary, fontWeight: "800" },
});
