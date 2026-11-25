import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
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
const AI_QUESTION_COUNT = 7;
const MULTI_SELECT_QUESTION_NUMBERS = [1, 5, 7];

function createDefaultTime() {
  const time = new Date();
  time.setHours(0, 0, 0, 0);
  return time;
}

function formatTimeInput(time) {
  return `${String(time.getHours()).padStart(2, "0")}:${String(time.getMinutes()).padStart(2, "0")}`;
}

function parseTimeInput(value) {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

function normalizeActivity(item) {
  if (typeof item === "string") {
    const title = item.split(/[.!?]/)[0].trim() || item.trim();
    return { title, description: item.trim(), example: "", resourceQuery: title };
  }
  const title = typeof item?.title === "string" ? item.title.trim() : "Sunventure activity";
  return {
    title,
    description: typeof item?.description === "string" ? item.description.trim() : "",
    example: typeof item?.example === "string" ? item.example.trim() : "",
    resourceQuery: typeof item?.resourceQuery === "string" ? item.resourceQuery.trim() : title,
  };
}

function activityResourceUrl(activity) {
  return `https://www.google.com/search?q=${encodeURIComponent(`${activity.resourceQuery || activity.title} simple guide`)}`;
}

function escapeCalendarText(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function downloadCalendarReminder(title, reminderTime, eventId) {
  const endTime = new Date(reminderTime.getTime() + 30 * 60 * 1000);
  const toCalendarDate = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "METHOD:REQUEST",
    "PRODID:-//Sunventure//Reminder//EN",
    "BEGIN:VEVENT",
    `UID:${eventId}`,
    "SEQUENCE:0",
    `DTSTAMP:${toCalendarDate(new Date())}`,
    `DTSTART:${toCalendarDate(reminderTime)}`,
    `DTEND:${toCalendarDate(endTime)}`,
    `SUMMARY:${escapeCalendarText(`Sunventure: ${title}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sunventure-reminder.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadCalendarCancellation(title, reminderTime, eventId) {
  const toCalendarDate = (value) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "METHOD:CANCEL",
    "PRODID:-//Sunventure//Reminder//EN",
    "BEGIN:VEVENT",
    `UID:${eventId}`,
    "SEQUENCE:1",
    `DTSTAMP:${toCalendarDate(new Date())}`,
    `DTSTART:${toCalendarDate(reminderTime)}`,
    `SUMMARY:${escapeCalendarText(`Sunventure: ${title}`)}`,
    "STATUS:CANCELLED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sunventure-reminder-cancel.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const questionSets = {
  English: [
    { category: "personality", question: "Personality:", options: ["Introverted", "Extroverted", "Curious", "Creative", "Calm", "Energetic"] },
    { category: "social preferences", question: "Social Preferences:", options: ["Alone", "With family", "With friends", "In small groups", "In large groups", "No preference"] },
    { category: "activity preferences", question: "Activity Preferences:", options: ["Indoor", "Outdoor", "At home", "In the community", "Online", "No preference"] },
    { category: "energy levels", question: "Energy Levels:", options: ["Low energy", "Moderate energy", "High energy", "Depends on the day"] },
    { category: "learning preferences", question: "Learning Preferences:", options: ["Reading", "Watching", "Listening", "Hands-on activities", "Learning with others", "No preference"] },
    { category: "time preferences", question: "Time Preferences:", options: ["Morning", "Afternoon", "Evening", "Anytime"] },
    { category: "activity goals", question: "Activity Goals:", options: ["Have fun", "Learn something", "Meet people", "Stay active", "Relax", "Feel productive"] },
  ],
  Chinese: [
    { category: "性格", question: "性格：", options: ["内向", "外向", "好奇", "有创造力", "平静", "精力充沛"] },
    { category: "社交偏好", question: "社交偏好：", options: ["独自一人", "和家人一起", "和朋友一起", "小组活动", "大组活动", "没有偏好"] },
    { category: "活动偏好", question: "活动偏好：", options: ["室内", "户外", "在家", "在社区里", "在线", "没有偏好"] },
    { category: "精力水平", question: "精力水平：", options: ["低强度", "中等强度", "高强度", "取决于当天"] },
    { category: "学习偏好", question: "学习偏好：", options: ["阅读", "观看", "听讲", "动手实践", "和别人一起学习", "没有偏好"] },
    { category: "时间偏好", question: "时间偏好：", options: ["早上", "下午", "晚上", "任何时间"] },
    { category: "活动目标", question: "活动目标：", options: ["享受乐趣", "学习新东西", "认识朋友", "保持活跃", "放松", "感到有成就"] },
  ],
  Spanish: [
    { category: "personalidad", question: "Personalidad:", options: ["Introvertido", "Extrovertido", "Curioso", "Creativo", "Tranquilo", "Enérgico"] },
    { category: "preferencias sociales", question: "Preferencias Sociales:", options: ["Solo", "Con familia", "Con amigos", "En grupos pequeños", "En grupos grandes", "Sin preferencia"] },
    { category: "preferencias de actividad", question: "Preferencias de Actividad:", options: ["En interiores", "Al aire libre", "En casa", "En la comunidad", "En línea", "Sin preferencia"] },
    { category: "niveles de energía", question: "Niveles de Energía:", options: ["Poca energía", "Energía moderada", "Mucha energía", "Depende del día"] },
    { category: "preferencias de aprendizaje", question: "Preferencias de Aprendizaje:", options: ["Leyendo", "Mirando", "Escuchando", "Con actividades prácticas", "Aprendiendo con otros", "Sin preferencia"] },
    { category: "preferencias de horario", question: "Preferencias de Horario:", options: ["Por la mañana", "Por la tarde", "Por la noche", "Cualquier hora"] },
    { category: "metas de actividad", question: "Metas de Actividad:", options: ["Divertirte", "Aprender algo", "Conocer gente", "Mantenerte activo", "Relajarte", "Sentirte productivo"] },
  ],
};

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
    welcomeBody: "Choose a language, answer simple questions about what you like, and Sunventure will suggest three activities.",
    safety: "✓ We will not ask for personal information.",
    continue: "Continue",
    languageEyebrow: "LANGUAGE",
    languageQuestion: "What language do you prefer?",
    languageBody: "Choose one language for your questions and activity idea.",
    back: "‹ Back",
    questionEyebrow: (number) => `QUESTION ${number} OF 7 · YOUR IDEAS`,
    thinking: "Thinking of a question…",
    inputPlaceholder: "Type your answer",
    next: "Next",
    oneQuestion: "One simple question at a time.",
    selectAll: "You can choose more than one.",
    reminderEyebrow: "REMINDER",
    reminderTitle: "When would you like to do it?",
    reminderBody: "Sunventure can remind you at this time.",
    changeTime: "Change time",
    findActivity: "Find A Activity",
    findingActivity: "Finding a activity..",
    useAnswers: "The AI uses your answers to find three activities.",
    resultEyebrow: "YOUR SUNVENTURE IDEAS",
    resultTitle: "Choose one activity:",
    reminderSet: (time) => `✓ Your reminder is set for ${time}.`,
    calendarSaved: (time) => `✓ A calendar reminder for ${time} was downloaded. Open it to add it to your calendar.`,
    cancelReminder: "Cancel reminder",
    reminderCancelled: "✓ Your reminder was cancelled.",
    calendarCancelled: "✓ A calendar cancellation file was downloaded. Open it to remove the reminder from your calendar.",
    chooseActivity: "Choose an activity before setting a reminder.",
    setReminder: "Set reminder",
    selectedActivity: (activity) => `You chose: ${activity}`,
    differentIdea: "Want different ideas? Go back and change an answer.",
    tryAnother: "Try another idea",
    resourceLink: "Find a simple guide online ↗",
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
    welcomeBody: "选择语言，回答关于你喜好的简单问题，Sunventure 会为你推荐三项活动。",
    safety: "✓ 我们不会询问个人信息。",
    continue: "继续",
    languageEyebrow: "语言",
    languageQuestion: "你喜欢使用哪种语言？",
    languageBody: "为你的问题和活动建议选择一种语言。",
    back: "‹ 返回",
    questionEyebrow: (number) => `第 ${number} 个问题，共 7 个 · 你的想法`,
    thinking: "正在想一个问题……",
    inputPlaceholder: "输入你的回答",
    next: "下一步",
    oneQuestion: "一次回答一个简单问题。",
    selectAll: "你可以选择多个答案。",
    reminderEyebrow: "提醒",
    reminderTitle: "你想什么时候做这件事？",
    reminderBody: "Sunventure 可以在这个时间提醒你。",
    changeTime: "更改时间",
    findActivity: "寻找一个活动",
    findingActivity: "正在寻找活动……",
    useAnswers: "AI 会使用你的回答来找到三项活动。",
    resultEyebrow: "你的 SUNVENTURE 点子",
    resultTitle: "选择一项活动：",
    reminderSet: (time) => `✓ 已为你设置 ${time} 的提醒。`,
    calendarSaved: (time) => `✓ 已下载 ${time} 的日历提醒。打开文件即可添加到日历。`,
    cancelReminder: "取消提醒",
    reminderCancelled: "✓ 已取消提醒。",
    calendarCancelled: "✓ 已下载日历取消文件。打开它即可从日历中删除提醒。",
    chooseActivity: "请选择一项活动，然后设置提醒。",
    setReminder: "设置提醒",
    selectedActivity: (activity) => `你选择了：${activity}`,
    differentIdea: "想换一些点子？返回并修改答案。",
    tryAnother: "再试一个点子",
    resourceLink: "在线查找简单指南 ↗",
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
    welcomeBody: "Elige un idioma, responde preguntas sencillas sobre tus gustos y Sunventure sugerirá tres actividades.",
    safety: "✓ No pediremos información personal.",
    continue: "Continuar",
    languageEyebrow: "IDIOMA",
    languageQuestion: "¿Qué idioma prefieres?",
    languageBody: "Elige un idioma para tus preguntas y tu idea de actividad.",
    back: "‹ Atrás",
    questionEyebrow: (number) => `PREGUNTA ${number} DE 7 · TUS IDEAS`,
    thinking: "Pensando en una pregunta…",
    inputPlaceholder: "Escribe tu respuesta",
    next: "Siguiente",
    oneQuestion: "Una pregunta sencilla a la vez.",
    selectAll: "Puedes elegir más de una opción.",
    reminderEyebrow: "RECORDATORIO",
    reminderTitle: "¿Cuándo te gustaría hacerlo?",
    reminderBody: "Sunventure puede recordártelo a esta hora.",
    changeTime: "Cambiar hora",
    findActivity: "Buscar una actividad",
    findingActivity: "Buscando una actividad…",
    useAnswers: "La IA usará tus respuestas para encontrar tres actividades.",
    resultEyebrow: "TUS IDEAS SUNVENTURE",
    resultTitle: "Elige una actividad:",
    reminderSet: (time) => `✓ Tu recordatorio está programado para las ${time}.`,
    calendarSaved: (time) => `✓ Se descargó un recordatorio para las ${time}. Ábrelo para añadirlo a tu calendario.`,
    cancelReminder: "Cancelar recordatorio",
    reminderCancelled: "✓ Tu recordatorio fue cancelado.",
    calendarCancelled: "✓ Se descargó un archivo para cancelar el recordatorio. Ábrelo para quitarlo de tu calendario.",
    chooseActivity: "Elige una actividad antes de programar un recordatorio.",
    setReminder: "Programar recordatorio",
    selectedActivity: (activity) => `Elegiste: ${activity}`,
    differentIdea: "¿Quieres otras ideas? Regresa y cambia una respuesta.",
    tryAnother: "Probar otra idea",
    resourceLink: "Buscar una guía sencilla en línea ↗",
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
  const endpoint = Platform.OS === "web" && process.env.NODE_ENV !== "development" ? "/api/ask" : `${AI_HELPER_URL}/ask`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    const serverError = data.error && typeof data.error === "object" ? data.error : { message: data.error };
    const error = new Error(serverError.message || "AI helper unavailable");
    error.fix = serverError.fix;
    if (error.fix) console.warn("Sunventure AI fix:", error.fix);
    throw error;
  }
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
  const [answers, setAnswers] = useState({ language: "", time: createDefaultTime() });
  const [questionAnswers, setQuestionAnswers] = useState([]);
  const [question, setQuestion] = useState("");
  const [questionOptions, setQuestionOptions] = useState([]);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [askedQuestions, setAskedQuestions] = useState([]);
  const [answer, setAnswer] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [reminderSet, setReminderSet] = useState(false);
  const [reminderCancelled, setReminderCancelled] = useState(false);
  const [reminderId, setReminderId] = useState("");
  const [scheduledReminderTime, setScheduledReminderTime] = useState(null);
  const [isThinking, setIsThinking] = useState(false);
  const [webTimeText, setWebTimeText] = useState(formatTimeInput(createDefaultTime()));

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        const restoredTime = parsed.time ? new Date(parsed.time) : null;
        setAnswers((current) => ({
          ...current,
          time: restoredTime || current.time,
          language: "",
        }));
        if (restoredTime) setWebTimeText(formatTimeInput(restoredTime));
        if (Array.isArray(parsed.questionAnswers)) setQuestionAnswers(parsed.questionAnswers);
      } catch {
        // A damaged local save should not stop the app.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...answers, questionAnswers }));
  }, [answers, questionAnswers]);

  async function loadNextQuestion({ language, nextNumber, previousAnswers = questionAnswers, previousQuestions = askedQuestions }) {
    const questionTemplate = questionSets[language][nextNumber - 1];
    setScreen("aiQuestion");
    setQuestion("");
    setQuestionOptions([]);
    setAnswer("");
    setQuestionNumber(nextNumber);
    setIsThinking(true);
    try {
      const data = await requestAI({
        mode: "question",
        language,
        category: nextNumber === 1 ? questionTemplate.category : "the next best preference to narrow down the activity",
        options: nextNumber === 1 ? questionTemplate.options : [],
        previousAnswers,
        askedQuestions: previousQuestions,
      });
      if (data.done === true) {
        setQuestion("");
        setQuestionOptions([]);
        setScreen("time");
        return;
      }
      const nextQuestion = typeof data.question === "string" && data.question.trim() ? data.question : questionTemplate.question;
      const nextOptions = Array.isArray(data.options) && data.options.length > 0 ? data.options : questionTemplate.options;
      setQuestion(nextQuestion);
      setQuestionOptions(nextOptions);
      setAskedQuestions([...previousQuestions, nextQuestion]);
    } catch (error) {
      Alert.alert(t.questionErrorTitle, error.message || (Platform.OS === "web" ? t.webError : t.nativeQuestionError));
      setScreen("welcome");
    } finally {
      setIsThinking(false);
    }
  }

  function chooseLanguage(language) {
    setAnswers((current) => ({ ...current, language }));
    setQuestionAnswers([]);
    setQuestion("");
    setQuestionOptions([]);
    setQuestionNumber(0);
    setAskedQuestions([]);
    setAnswer("");
    setScreen("welcome");
  }

  function startQuestions() {
    loadNextQuestion({ language: answers.language, nextNumber: 1, previousAnswers: [], previousQuestions: [] });
  }

  function chooseQuestionOption(option) {
    if (MULTI_SELECT_QUESTION_NUMBERS.includes(questionNumber)) {
      setAnswer((current) => {
        const selected = Array.isArray(current) ? current : [];
        return selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option];
      });
      return;
    }
    setAnswer(option);
  }

  async function submitAnswer() {
    const cleanAnswer = Array.isArray(answer) ? answer.join(", ") : answer.trim();
    if (!cleanAnswer || isThinking) return;

    const nextAnswers = [...questionAnswers, { question, answer: cleanAnswer }];
    setQuestionAnswers(nextAnswers);
    if (questionNumber >= AI_QUESTION_COUNT) {
      setScreen("time");
      return;
    }

    loadNextQuestion({ language: answers.language, nextNumber: questionNumber + 1, previousAnswers: nextAnswers, previousQuestions: askedQuestions });
  }

  async function scheduleReminder(title) {
    const reminderTime = new Date(answers.time);
    if (reminderTime <= new Date()) reminderTime.setDate(reminderTime.getDate() + 1);
    if (Platform.OS === "web") {
      const safeTitle = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      const eventId = `sunventure-${formatTimeInput(reminderTime)}-${safeTitle}@sunventure.app`;
      downloadCalendarReminder(title, reminderTime, eventId);
      return { id: eventId, time: reminderTime };
    }
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return false;
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: { title: t.notificationTitle, body: t.notificationBody(title) },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminderTime,
      },
    });
    return { id: notificationId, time: reminderTime };
  }

  async function findActivity({ previousActivities = activities } = {}) {
    setIsThinking(true);
    setActivities([]);
    setSelectedActivity("");
    setReminderSet(false);
    setReminderCancelled(false);
    setReminderId("");
    setScheduledReminderTime(null);
    try {
      const data = await requestAI({ mode: "activity", language: answers.language, answers: questionAnswers, previousActivities });
      if (!Array.isArray(data.activities) || data.activities.length < 3) throw new Error("Not enough activities returned");
      setActivities(data.activities.slice(0, 3).map(normalizeActivity));
      setScreen("result");
    } catch (error) {
      const message = error.message || (Platform.OS === "web" ? t.webError : t.nativeAnswerError);
      Alert.alert(
        t.answerErrorTitle,
        message,
      );
    } finally {
      setIsThinking(false);
    }
  }

  async function confirmActivity() {
    if (!selectedActivity || reminderSet) return;
    try {
      const scheduled = await scheduleReminder(selectedActivity.title);
      if (scheduled) {
        setReminderId(scheduled.id);
        setScheduledReminderTime(scheduled.time);
        setReminderCancelled(false);
        setReminderSet(true);
      }
    } catch {
      // The activity still works if phone notifications are turned off.
    }
  }

  async function cancelReminder() {
    if (!reminderSet || !reminderId || !scheduledReminderTime) return;
    try {
      if (Platform.OS === "web") {
        downloadCalendarCancellation(selectedActivity.title, scheduledReminderTime, reminderId);
      } else {
        await Notifications.cancelScheduledNotificationAsync(reminderId);
      }
      setReminderSet(false);
      setReminderCancelled(true);
      setReminderId("");
      setScheduledReminderTime(null);
    } catch {
      Alert.alert(t.answerErrorTitle, Platform.OS === "web" ? t.webError : t.nativeAnswerError);
    }
  }

  const t = translations[answers.language] || translations.English;
  const isMultiSelectQuestion = MULTI_SELECT_QUESTION_NUMBERS.includes(questionNumber);
  const hasAnswer = Array.isArray(answer) ? answer.length > 0 : Boolean(answer.trim());
  const timeText = formatTimeInput(answers.time);
  const reminderMessage = Platform.OS === "web" ? t.calendarSaved(timeText) : t.reminderSet(timeText);
  const cancelledMessage = Platform.OS === "web" ? t.calendarCancelled : t.reminderCancelled;

  function updateWebTime(value) {
    setWebTimeText(value);
    const parsed = parseTimeInput(value);
    if (parsed) {
      const time = new Date(answers.time);
      time.setHours(parsed.hours, parsed.minutes, 0, 0);
      setAnswers((current) => ({ ...current, time }));
    }
  }

  return (
    <View style={styles.webShell}>
      <View pointerEvents="none" style={styles.sunGlowLarge} />
      <View pointerEvents="none" style={styles.sunGlowSmall} />
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>☀</Text></View>
            <View>
              <Text style={styles.logo}>Sunventure</Text>
              <Text style={styles.tagline}>{t.tagline}</Text>
            </View>
            <View style={styles.brandPill}><Text style={styles.brandPillText}>AI + YOU</Text></View>
          </View>

          {screen === "welcome" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("language")} label={t.back} />
              <Text style={styles.eyebrow}>{t.welcomeEyebrow}</Text>
              <Text style={styles.title}>{t.welcomeTitle}</Text>
              <Text style={styles.body}>{t.welcomeBody}</Text>
              <Text style={styles.safety}>{t.safety}</Text>
              <Pressable style={styles.primaryButton} onPress={startQuestions}>
                <Text style={styles.primaryText}>{t.continue}</Text>
              </Pressable>
            </View>
          )}

          {screen === "language" && (
            <View style={styles.card}>
              <Text style={styles.eyebrow}>{t.languageEyebrow}</Text>
              <Text style={styles.title}>
                {answers.language ? t.languageQuestion : <>What language do you prefer?{"\n"}你喜欢使用哪种语言？{"\n"}¿Qué idioma prefieres?</>}
              </Text>
              <Text style={styles.body}>
                {answers.language ? t.languageBody : <>Choose one language{"\n"}请选择一种语言{"\n"}Elige un idioma</>}
              </Text>
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
                  {questionOptions.length > 0 ? (
                    <View style={styles.choices}>
                      {questionOptions.map((option) => (
                        <Choice key={option} label={option} selected={Array.isArray(answer) ? answer.includes(option) : answer === option} onPress={() => chooseQuestionOption(option)} />
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabel="Your answer"
                      value={Array.isArray(answer) ? answer.join(", ") : answer}
                      onChangeText={setAnswer}
                      placeholder={t.inputPlaceholder}
                      placeholderTextColor="#998F80"
                      multiline
                      style={styles.answerInput}
                    />
                  )}
                  <Pressable disabled={!hasAnswer} style={[styles.primaryButton, !hasAnswer && styles.disabled]} onPress={submitAnswer}>
                    <Text style={styles.primaryText}>{t.next}</Text>
                  </Pressable>
                </>
              )}
              {isMultiSelectQuestion && <Text style={styles.smallNote}>{t.selectAll}</Text>}
              <Text style={styles.smallNote}>{t.oneQuestion}</Text>
            </View>
          )}

          {screen === "time" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("aiQuestion")} label={t.back} />
              <Text style={styles.eyebrow}>{t.reminderEyebrow}</Text>
              <Text style={styles.title}>{t.reminderTitle}</Text>
              <Text style={styles.body}>{t.reminderBody}</Text>
              <Pressable style={styles.timeButton} onPress={() => { setShowTimePicker(true); setWebTimeText(formatTimeInput(answers.time)); }}>
                <Text style={styles.timeText}>⏰ {timeText}</Text>
                <Text style={styles.changeText}>{t.changeTime}</Text>
              </Pressable>
              {showTimePicker && Platform.OS === "web" && (
                <TextInput
                  accessibilityLabel={t.changeTime}
                  value={webTimeText}
                  onChangeText={updateWebTime}
                  placeholder="00:00"
                  maxLength={5}
                  keyboardType="numbers-and-punctuation"
                  style={styles.timeInput}
                />
              )}
              {showTimePicker && Platform.OS !== "web" && (
                <DateTimePicker value={answers.time} mode="time" onChange={(_, value) => { setShowTimePicker(false); if (value) setAnswers((current) => ({ ...current, time: value })); }} />
              )}
              <Pressable disabled={isThinking} style={[styles.primaryButton, isThinking && styles.disabled]} onPress={findActivity}>
                <Text style={styles.primaryText}>{isThinking ? t.findingActivity : t.findActivity}</Text>
              </Pressable>
              <Text style={styles.smallNote}>{t.useAnswers}</Text>
            </View>
          )}

          {screen === "result" && (
            <View style={styles.card}>
              <BackButton onPress={() => setScreen("time")} label={t.back} />
              <Text style={styles.eyebrow}>{t.resultEyebrow}</Text>
              <Text style={styles.title}>{t.resultTitle}</Text>
              <View style={styles.activityChoices}>
                {activities.map((item, index) => (
                  <View key={`${index}-${item.title}`} style={styles.activityCard}>
                    <Choice label={`${index + 1}. ${item.title}`} selected={selectedActivity?.title === item.title} onPress={() => setSelectedActivity(item)} />
                    {item.description ? <Text style={styles.activityDetails}>{item.description}</Text> : null}
                    {item.example ? <Text style={styles.activityExample}>{item.example}</Text> : null}
                    <Pressable accessibilityRole="link" style={styles.resourceButton} onPress={() => Linking.openURL(activityResourceUrl(item))}>
                      <Text style={styles.resourceText}>{t.resourceLink}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              {selectedActivity && <Text style={styles.safety}>{t.selectedActivity(selectedActivity.title)}</Text>}
              <Pressable disabled={!selectedActivity || reminderSet} style={[styles.primaryButton, (!selectedActivity || reminderSet) && styles.disabled]} onPress={confirmActivity}>
                <Text style={styles.primaryText}>{t.setReminder}</Text>
              </Pressable>
              <Text style={styles.smallNote}>{reminderSet ? reminderMessage : reminderCancelled ? cancelledMessage : t.chooseActivity}</Text>
              {reminderSet && (
                <Pressable style={styles.secondaryButton} onPress={cancelReminder}>
                  <Text style={styles.secondaryText}>{t.cancelReminder}</Text>
                </Pressable>
              )}
              <Text style={styles.smallNote}>{t.differentIdea}</Text>
              <Pressable disabled={isThinking} style={[styles.primaryButton, isThinking && styles.disabled]} onPress={() => findActivity({ previousActivities: activities.map((item) => item.title) })}>
                <Text style={styles.primaryText}>{isThinking ? t.findingActivity : t.tryAnother}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  webShell: Platform.select({ web: { flex: 1, alignItems: "center", backgroundColor: "#F4EDE3", overflow: "hidden" }, default: { flex: 1 } }),
  safe: Platform.select({ web: { flex: 1, width: "100%", backgroundColor: "transparent" }, default: { flex: 1, backgroundColor: "#FFF8E8" } }),
  sunGlowLarge: Platform.select({ web: { position: "absolute", width: 520, height: 520, borderRadius: 260, backgroundColor: "#FFE7AA", opacity: 0.38, top: -260, right: -110 }, default: { display: "none" } }),
  sunGlowSmall: Platform.select({ web: { position: "absolute", width: 240, height: 240, borderRadius: 120, backgroundColor: "#CDEFE3", opacity: 0.5, bottom: -100, left: -70 }, default: { display: "none" } }),
  container: { flexGrow: 1, padding: 24, paddingTop: 32, paddingBottom: 42, justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  brandMark: { width: 50, height: 50, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#FFB35C", marginRight: 12, shadowColor: "#D77B27", shadowOpacity: 0.25, shadowRadius: 12, elevation: 4 },
  brandMarkText: { color: "#FFFFFF", fontSize: 29, fontWeight: "800" },
  logo: { color: "#213B59", fontSize: 29, fontWeight: "900", letterSpacing: 0.3 },
  tagline: { color: "#6F756F", fontSize: 15, marginTop: 3 },
  brandPill: { marginLeft: "auto", backgroundColor: "#DDF4EA", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  brandPillText: { color: "#2F8064", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 26, borderWidth: 1, borderColor: "rgba(255,255,255,0.85)", shadowColor: "#45606C", shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  eyebrow: { color: "#E0783F", fontSize: 12, fontWeight: "900", letterSpacing: 1.5, marginBottom: 11 },
  title: { color: "#213B59", fontSize: 32, fontWeight: "900", lineHeight: 39, marginBottom: 13 },
  body: { color: "#66716F", fontSize: 18, lineHeight: 27, marginBottom: 20 },
  safety: { color: "#2F8064", fontSize: 16, lineHeight: 23, marginBottom: 20 },
  activityCard: { backgroundColor: "#FFF8E8", borderRadius: 18, padding: 10, marginBottom: 12 },
  activityDetails: { color: "#596B6C", fontSize: 16, lineHeight: 23, paddingHorizontal: 14, marginTop: 2 },
  activityExample: { color: "#31735A", fontSize: 15, lineHeight: 22, paddingHorizontal: 14, marginTop: 6 },
  resourceButton: { alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10 },
  resourceText: { color: "#B5661B", fontSize: 15, fontWeight: "700", textDecorationLine: "underline" },
  choices: { gap: 10 },
  choice: { borderWidth: 2, borderColor: "#E1E8E2", borderRadius: 17, paddingVertical: 15, paddingHorizontal: 17, backgroundColor: "#FBFDFC" },
  choiceSelected: { borderColor: "#F39A4A", backgroundColor: "#FFF0D4", shadowColor: "#E49A4A", shadowOpacity: 0.14, shadowRadius: 8, elevation: 2 },
  choiceText: { color: "#304B58", fontSize: 18, fontWeight: "700" },
  choiceTextSelected: { color: "#9A551F" },
  answerInput: { minHeight: 120, borderWidth: 2, borderColor: "#E1E8E2", borderRadius: 17, padding: 16, color: "#213B59", fontSize: 18, lineHeight: 26, backgroundColor: "#FBFDFC", textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#E97D43", borderRadius: 17, paddingVertical: 17, alignItems: "center", marginTop: 24, shadowColor: "#C95F2F", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  primaryText: { color: "#FFFFFF", fontSize: 19, fontWeight: "800" },
  secondaryButton: { borderWidth: 2, borderColor: "#D9E8E0", borderRadius: 17, paddingVertical: 14, alignItems: "center", marginTop: 12, backgroundColor: "#F4FBF7" },
  secondaryText: { color: "#34705F", fontSize: 17, fontWeight: "800" },
  disabled: { opacity: 0.45 },
  backButton: { alignSelf: "flex-start", marginBottom: 18 },
  backText: { color: "#34705F", fontSize: 17, fontWeight: "800" },
  timeButton: { borderWidth: 2, borderColor: "#D9E8E0", borderRadius: 20, padding: 19, backgroundColor: "#F4FBF7" },
  timeText: { color: "#213B59", fontSize: 29, fontWeight: "900" },
  changeText: { color: "#34705F", fontSize: 15, marginTop: 5, fontWeight: "700" },
  timeInput: { borderWidth: 2, borderColor: "#D9E8E0", borderRadius: 17, padding: 14, marginTop: 12, color: "#213B59", fontSize: 22, backgroundColor: "#FBFDFC" },
  smallNote: { color: "#77817D", fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: "center" },
  resultBox: { backgroundColor: "#FFF0D4", borderRadius: 18, padding: 20, marginBottom: 18 },
  resultText: { color: "#304B58", fontSize: 22, lineHeight: 32, fontWeight: "600" },
});
