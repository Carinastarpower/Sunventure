import React, { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";

const AI_HELPER_URL = "http://192.168.1.163:8787";
const STORAGE_KEY = "sunventure-v1-answers";
const AI_QUESTION_COUNT = 5;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const languageOptions = [
  { value: "English", label: "English 🇺🇸 / 🇬🇧" },
  { value: "Chinese", label: "中文 🇨🇳" },
  { value: "Spanish", label: "español 🇪🇸" },
];

async function requestAI(body) {
  const endpoint = Platform.OS === "web" ? "/api/ask" : `${AI_HELPER_URL}/ask`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "AI helper unavailable");
  return data;
}

function Choice({ label, selected, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function BackButton({ onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backText}>‹ Back</Text>
    </Pressable>
  );
}

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [answers, setAnswers] = useState({ language: "", time: new Date() });
  const [questionAnswers, setQuestionAnswers] = useState([]);
  const [question, setQuestion] = useState("");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activity, setActivity] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        setAnswers((current) => ({
          ...current,
          ...parsed,
          time: parsed.time ? new Date(parsed.time) : current.time,
        }));
        if (Array.isArray(parsed.questionAnswers)) setQuestionAnswers(parsed.questionAnswers);
      } catch {
        // A damaged local save should not stop the app.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...answers, questionAnswers }));
  }, [answers, questionAnswers]);

  async function loadNextQuestion({ language, previousAnswers, askedQuestions, nextNumber }) {
    setIsThinking(true);
    setScreen("aiQuestion");
    setQuestion("");
    setAnswer("");
    try {
      const data = await requestAI({ mode: "question", language, previousAnswers, askedQuestions });
      if (!data.question) throw new Error("No question returned");
      setQuestion(data.question);
      setQuestionNumber(nextNumber);
    } catch {
      Alert.alert(
        "Sunventure could not ask the next question",
        Platform.OS === "web"
          ? "Please check the online AI function and try again."
          : "Please check your Wi-Fi and that the Sunventure helper is running on the computer.",
      );
      setScreen("language");
    } finally {
      setIsThinking(false);
    }
  }

  function chooseLanguage(language) {
    setAnswers((current) => ({ ...current, language }));
    setQuestionAnswers([]);
    loadNextQuestion({ language, previousAnswers: [], askedQuestions: [], nextNumber: 1 });
  }

  async function submitAnswer() {
    const cleanAnswer = answer.trim();
    if (!cleanAnswer || isThinking) return;

    const nextAnswers = [...questionAnswers, { question, answer: cleanAnswer }];
    setQuestionAnswers(nextAnswers);
    if (questionNumber >= AI_QUESTION_COUNT) {
      setScreen("time");
      return;
    }

    await loadNextQuestion({
      language: answers.language,
      previousAnswers: nextAnswers,
      askedQuestions: [...questionAnswers.map((item) => item.question), question],
      nextNumber: questionNumber + 1,
    });
  }

  async function scheduleReminder(title) {
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return false;
    const reminderTime = new Date(answers.time);
    if (reminderTime <= new Date()) reminderTime.setDate(reminderTime.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      content: { title: "Sunventure reminder", body: `It is time for ${title}.` },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return true;
  }

  async function findActivity() {
    setIsThinking(true);
    setActivity("");
    try {
      const data = await requestAI({ mode: "activity", language: answers.language, answers: questionAnswers });
      if (!data.activity) throw new Error("No activity returned");
      setActivity(data.activity);
      try {
        await scheduleReminder(data.activity.split(".")[0]);
      } catch {
        // The activity still works if phone notifications are turned off.
      }
      setScreen("result");
    } catch {
      Alert.alert(
        "Sunventure could not answer",
        Platform.OS === "web"
          ? "Please check the online AI function and try again."
          : "Please check your key, Wi-Fi, and that the Sunventure helper is running on the computer.",
      );
    } finally {
      setIsThinking(false);
    }
  }

  const timeText = answers.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <View style={styles.webShell}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>☀ Sunventure</Text>
          <Text style={styles.tagline}>A simple idea for a brighter day.</Text>

          {screen === "welcome" && (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>WELCOME</Text>
              <Text style={styles.title}>Find something good to do.</Text>
              <Text style={styles.body}>Choose a language, answer five simple AI questions, and Sunventure will suggest one activity.</Text>
              <Text style={styles.safety}>✓ We will not ask for personal information.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setScreen("language")}>
                <Text style={styles.primaryText}>Get started</Text>
              </Pressable>
            </View>
          )}

          {screen === "language" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("welcome")} />
              <Text style={styles.eyebrow}>QUESTION 1 OF 6 · LANGUAGE</Text>
              <Text style={styles.title}>What language do you prefer?</Text>
              <Text style={styles.body}>Choose one language for your questions and activity idea.</Text>
              <View style={styles.choices}>
                {languageOptions.map((item) => (
                  <Choice key={item.value} label={item.label} selected={answers.language === item.value} onPress={() => chooseLanguage(item.value)} />
                ))}
              </View>
            </View>
          )}

          {screen === "aiQuestion" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("language")} />
              <Text style={styles.eyebrow}>QUESTION {questionNumber + 1} OF 6 · YOUR IDEAS</Text>
              {isThinking ? (
                <Text style={styles.title}>Thinking of a question…</Text>
              ) : (
                <>
                  <Text style={styles.title}>{question}</Text>
                  <TextInput
                    accessibilityLabel="Your answer"
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder="Type your answer"
                    placeholderTextColor="#998F80"
                    multiline
                    style={styles.answerInput}
                  />
                  <Pressable disabled={!answer.trim()} style={[styles.primaryButton, !answer.trim() && styles.disabled]} onPress={submitAnswer}>
                    <Text style={styles.primaryText}>Next</Text>
                  </Pressable>
                </>
              )}
              <Text style={styles.smallNote}>One simple question at a time.</Text>
            </View>
          )}

          {screen === "time" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("aiQuestion")} />
              <Text style={styles.eyebrow}>REMINDER</Text>
              <Text style={styles.title}>When would you like to do it?</Text>
              <Text style={styles.body}>Sunventure can remind you at this time.</Text>
              <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeText}>⏰ {timeText}</Text>
                <Text style={styles.changeText}>Change time</Text>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker value={answers.time} mode="time" onChange={(_, value) => { setShowTimePicker(false); if (value) setAnswers((current) => ({ ...current, time: value })); }} />
              )}
              <Pressable disabled={isThinking} style={[styles.primaryButton, isThinking && styles.disabled]} onPress={findActivity}>
                <Text style={styles.primaryText}>{isThinking ? "Thinking…" : "Find A Activity"}</Text>
              </Pressable>
              <Text style={styles.smallNote}>The AI uses all six answers to choose one activity.</Text>
            </View>
          )}

          {screen === "result" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("time")} />
              <Text style={styles.eyebrow}>YOUR SUNVENTURE IDEA</Text>
              <Text style={styles.title}>Try this:</Text>
              <View style={styles.resultBox}><Text style={styles.resultText}>{activity}</Text></View>
              <Text style={styles.safety}>✓ Your reminder is set for {timeText}.</Text>
              <Text style={styles.smallNote}>Want a different idea? Go back and change an answer.</Text>
              <Pressable style={styles.primaryButton} onPress={() => setScreen("language")}>
                <Text style={styles.primaryText}>Try another idea</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  webShell: Platform.select({ web: { flex: 1, alignItems: "center", backgroundColor: "#E8E3D9" }, default: { flex: 1 } }),
  safe: Platform.select({ web: { flex: 1, width: "100%", maxWidth: 400, backgroundColor: "#FFF8E8" }, default: { flex: 1, backgroundColor: "#FFF8E8" } }),
  container: { flexGrow: 1, padding: 24, paddingTop: 36, justifyContent: "center" },
  logo: { color: "#F28C28", fontSize: 27, fontWeight: "800", letterSpacing: 0.3 },
  tagline: { color: "#675F53", fontSize: 16, marginTop: 4, marginBottom: 22 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, shadowColor: "#8C6A2D", shadowOpacity: 0.12, shadowRadius: 16, elevation: 3 },
  eyebrow: { color: "#B5661B", fontSize: 13, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 },
  title: { color: "#27231E", fontSize: 31, fontWeight: "800", lineHeight: 38, marginBottom: 12 },
  body: { color: "#675F53", fontSize: 18, lineHeight: 27, marginBottom: 20 },
  safety: { color: "#31735A", fontSize: 16, lineHeight: 23, marginBottom: 20 },
  choices: { gap: 10 },
  choice: { borderWidth: 2, borderColor: "#E8DFD1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#FFFCF6" },
  choiceSelected: { borderColor: "#F28C28", backgroundColor: "#FFF0D4" },
  choiceText: { color: "#3B352D", fontSize: 18, fontWeight: "600" },
  choiceTextSelected: { color: "#8D4C0B" },
  answerInput: { minHeight: 120, borderWidth: 2, borderColor: "#E8DFD1", borderRadius: 14, padding: 16, color: "#27231E", fontSize: 18, lineHeight: 26, backgroundColor: "#FFFCF6", textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#F28C28", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24 },
  primaryText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  backButton: { alignSelf: "flex-start", marginBottom: 18 },
  backText: { color: "#8D4C0B", fontSize: 17, fontWeight: "700" },
  timeButton: { borderWidth: 2, borderColor: "#E8DFD1", borderRadius: 16, padding: 18, backgroundColor: "#FFFCF6" },
  timeText: { color: "#27231E", fontSize: 27, fontWeight: "800" },
  changeText: { color: "#8D4C0B", fontSize: 15, marginTop: 5 },
  smallNote: { color: "#766D60", fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: "center" },
  resultBox: { backgroundColor: "#FFF0D4", borderRadius: 18, padding: 20, marginBottom: 18 },
  resultText: { color: "#3B352D", fontSize: 22, lineHeight: 32, fontWeight: "600" },
});
