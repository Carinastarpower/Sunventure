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

const translations = {
  English: {
    tagline: "A simple idea for a brighter day.",
    welcomeEyebrow: "WELCOME",
    welcomeTitle: "Find something good to do.",
    welcomeBody: "Choose a language, answer five simple AI questions, and Sunventure will suggest one activity.",
    safety: "✓ We will not ask for personal information.",
    getStarted: "Get started",
    languageEyebrow: "LANGUAGE",
    languageQuestion: "What language do you prefer?",
    languageBody: "Choose one language for your questions and activity idea.",
    back: "‹ Back",
    questionEyebrow: (number) => `QUESTION ${number} OF 5 · YOUR IDEAS`,
    thinking: "Thinking of a question…",
    inputPlaceholder: "Type your answer",
    next: "Next",
    oneQuestion: "One simple question at a time.",
    reminderEyebrow: "REMINDER",
    reminderTitle: "When would you like to do it?",
    reminderBody: "Sunventure can remind you at this time.",
    changeTime: "Change time",
    findActivity: "Find A Activity",
    useAnswers: "The AI uses all six answers to choose one activity.",
    resultEyebrow: "YOUR SUNVENTURE IDEA",
    resultTitle: "Try this:",
    reminderSet: (time) => `✓ Your reminder is set for ${time}.`,
    differentIdea: "Want a different idea? Go back and change an answer.",
    tryAnother: "Try another idea",
    questionErrorTitle: "Sunventure could not ask the next question",
    answerErrorTitle: "Sunventure could not answer",
    webError: "Please check the online AI function and try again.",
    nativeQuestionError: "Please check your Wi-Fi and that the Sunventure helper is running on the computer.",
    nativeAnswerError: "Please check your key, Wi-Fi, and that the Sunventure helper is running on the computer.",
    notificationTitle: "Sunventure reminder",
    notificationBody: (title) => `It is time for ${title}.`,
  },
  Chinese: {
    tagline: "让每一天更明亮的简单点子。",
    welcomeEyebrow: "欢迎",
    welcomeTitle: "找点有趣的事做吧。",
    welcomeBody: "选择语言，回答五个简单的 AI 问题，Sunventure 会为你推荐一项活动。",
    safety: "✓ 我们不会询问个人信息。",
    getStarted: "开始",
    languageEyebrow: "语言",
    languageQuestion: "你喜欢使用哪种语言？",
    languageBody: "为你的问题和活动建议选择一种语言。",
    back: "‹ 返回",
    questionEyebrow: (number) => `第 ${number} 个问题，共 5 个 · 你的想法`,
    thinking: "正在想一个问题……",
    inputPlaceholder: "输入你的回答",
    next: "下一步",
    oneQuestion: "一次回答一个简单问题。",
    reminderEyebrow: "提醒",
    reminderTitle: "你想什么时候做这件事？",
    reminderBody: "Sunventure 可以在这个时间提醒你。",
    changeTime: "更改时间",
    findActivity: "寻找一个活动",
    useAnswers: "AI 会使用你的六个回答来选择一项活动。",
    resultEyebrow: "你的 SUNVENTURE 点子",
    resultTitle: "试试这个：",
    reminderSet: (time) => `✓ 已为你设置 ${time} 的提醒。`,
    differentIdea: "想换一个点子？返回并修改答案。",
    tryAnother: "再试一个点子",
    questionErrorTitle: "Sunventure 无法提出下一个问题",
    answerErrorTitle: "Sunventure 无法回答",
    webError: "请检查在线 AI 功能，然后再试一次。",
    nativeQuestionError: "请检查 Wi-Fi，并确认电脑上的 Sunventure helper 正在运行。",
    nativeAnswerError: "请检查密钥、Wi-Fi，并确认电脑上的 Sunventure helper 正在运行。",
    notificationTitle: "Sunventure 提醒",
    notificationBody: (title) => `现在是进行${title}的时间。`,
  },
  Spanish: {
    tagline: "Una idea sencilla para un día más alegre.",
    welcomeEyebrow: "BIENVENIDO",
    welcomeTitle: "Encuentra algo bueno que hacer.",
    welcomeBody: "Elige un idioma, responde cinco preguntas sencillas de IA y Sunventure sugerirá una actividad.",
    safety: "✓ No pediremos información personal.",
    getStarted: "Comenzar",
    languageEyebrow: "IDIOMA",
    languageQuestion: "¿Qué idioma prefieres?",
    languageBody: "Elige un idioma para tus preguntas y tu idea de actividad.",
    back: "‹ Atrás",
    questionEyebrow: (number) => `PREGUNTA ${number} DE 5 · TUS IDEAS`,
    thinking: "Pensando en una pregunta…",
    inputPlaceholder: "Escribe tu respuesta",
    next: "Siguiente",
    oneQuestion: "Una pregunta sencilla a la vez.",
    reminderEyebrow: "RECORDATORIO",
    reminderTitle: "¿Cuándo te gustaría hacerlo?",
    reminderBody: "Sunventure puede recordártelo a esta hora.",
    changeTime: "Cambiar hora",
    findActivity: "Buscar una actividad",
    useAnswers: "La IA usará tus seis respuestas para elegir una actividad.",
    resultEyebrow: "TU IDEA SUNVENTURE",
    resultTitle: "Prueba esto:",
    reminderSet: (time) => `✓ Tu recordatorio está programado para las ${time}.`,
    differentIdea: "¿Quieres otra idea? Regresa y cambia una respuesta.",
    tryAnother: "Probar otra idea",
    questionErrorTitle: "Sunventure no pudo hacer la siguiente pregunta",
    answerErrorTitle: "Sunventure no pudo responder",
    webError: "Revisa la función de IA en línea e inténtalo de nuevo.",
    nativeQuestionError: "Revisa tu Wi-Fi y confirma que Sunventure helper esté funcionando en la computadora.",
    nativeAnswerError: "Revisa tu clave, Wi-Fi y confirma que Sunventure helper esté funcionando en la computadora.",
    notificationTitle: "Recordatorio de Sunventure",
    notificationBody: (title) => `Es hora de ${title}.`,
  },
};

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

function BackButton({ onPress, label }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.backButton}>
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [screen, setScreen] = useState("language");
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
        translations[language].questionErrorTitle,
        Platform.OS === "web"
          ? translations[language].webError
          : translations[language].nativeQuestionError,
      );
      setScreen("welcome");
    } finally {
      setIsThinking(false);
    }
  }

  function chooseLanguage(language) {
    setAnswers((current) => ({ ...current, language }));
    setQuestionAnswers([]);
    setQuestion("");
    setQuestionNumber(0);
    setAnswer("");
    setScreen("welcome");
  }

  function startQuestions() {
    loadNextQuestion({ language: answers.language, previousAnswers: [], askedQuestions: [], nextNumber: 1 });
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
      content: { title: t.notificationTitle, body: t.notificationBody(title) },
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
        t.answerErrorTitle,
        Platform.OS === "web"
          ? t.webError
          : t.nativeAnswerError,
      );
    } finally {
      setIsThinking(false);
    }
  }

  const t = translations[answers.language] || translations.English;
  const timeText = answers.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <View style={styles.webShell}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.logo}>☀ Sunventure</Text>
          <Text style={styles.tagline}>{t.tagline}</Text>

          {screen === "welcome" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("language")} label={t.back} />
              <Text style={styles.eyebrow}>{t.welcomeEyebrow}</Text>
              <Text style={styles.title}>{t.welcomeTitle}</Text>
              <Text style={styles.body}>{t.welcomeBody}</Text>
              <Text style={styles.safety}>{t.safety}</Text>
              <Pressable style={styles.primaryButton} onPress={startQuestions}>
                <Text style={styles.primaryText}>{t.getStarted}</Text>
              </Pressable>
            </View>
          )}

          {screen === "language" && (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>{t.languageEyebrow}</Text>
              <Text style={styles.title}>{t.languageQuestion}</Text>
              <Text style={styles.body}>{t.languageBody}</Text>
              <View style={styles.choices}>
                {languageOptions.map((item) => (
                  <Choice key={item.value} label={item.label} selected={answers.language === item.value} onPress={() => chooseLanguage(item.value)} />
                ))}
              </View>
            </View>
          )}

          {screen === "aiQuestion" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("welcome")} label={t.back} />
              <Text style={styles.eyebrow}>{t.questionEyebrow(questionNumber)}</Text>
              {isThinking ? (
                <Text style={styles.title}>{t.thinking}</Text>
              ) : (
                <>
                  <Text style={styles.title}>{question}</Text>
                  <TextInput
                    accessibilityLabel="Your answer"
                    value={answer}
                    onChangeText={setAnswer}
                    placeholder={t.inputPlaceholder}
                    placeholderTextColor="#998F80"
                    multiline
                    style={styles.answerInput}
                  />
                  <Pressable disabled={!answer.trim()} style={[styles.primaryButton, !answer.trim() && styles.disabled]} onPress={submitAnswer}>
                    <Text style={styles.primaryText}>{t.next}</Text>
                  </Pressable>
                </>
              )}
              <Text style={styles.smallNote}>{t.oneQuestion}</Text>
            </View>
          )}

          {screen === "time" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("aiQuestion")} />
              <BackButton onPress={() => setScreen("aiQuestion")} label={t.back} />
              <Text style={styles.eyebrow}>{t.reminderEyebrow}</Text>
              <Text style={styles.title}>{t.reminderTitle}</Text>
              <Text style={styles.body}>{t.reminderBody}</Text>
              <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.timeText}>⏰ {timeText}</Text>
                <Text style={styles.changeText}>{t.changeTime}</Text>
              </Pressable>
              {showTimePicker && (
                <DateTimePicker value={answers.time} mode="time" onChange={(_, value) => { setShowTimePicker(false); if (value) setAnswers((current) => ({ ...current, time: value })); }} />
              )}
              <Pressable disabled={isThinking} style={[styles.primaryButton, isThinking && styles.disabled]} onPress={findActivity}>
                <Text style={styles.primaryText}>{isThinking ? t.thinking : t.findActivity}</Text>
              </Pressable>
              <Text style={styles.smallNote}>{t.useAnswers}</Text>
            </View>
          )}

          {screen === "result" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("time")} label={t.back} />
              <Text style={styles.eyebrow}>{t.resultEyebrow}</Text>
              <Text style={styles.title}>{t.resultTitle}</Text>
              <View style={styles.resultBox}><Text style={styles.resultText}>{activity}</Text></View>
              <Text style={styles.safety}>{t.reminderSet(timeText)}</Text>
              <Text style={styles.smallNote}>{t.differentIdea}</Text>
              <Pressable style={styles.primaryButton} onPress={() => setScreen("welcome")}>
                <Text style={styles.primaryText}>{t.tryAnother}</Text>
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
