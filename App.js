import React, { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";

const AI_HELPER_URL = "http://192.168.1.163:8787";
const STORAGE_KEY = "sunventure-v1-answers";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const choiceSets = {
  interest: ["Arts and crafts", "Music", "Movement", "Nature", "Learning"],
  company: ["By myself", "With one person", "With a group"],
  setting: ["Indoor", "Outdoor", "Either"],
  language: ["English", "Spanish", "Chinese"],
};

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
  const [answers, setAnswers] = useState({
    interest: "",
    company: "",
    setting: "",
    language: "English",
    time: new Date(),
  });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activity, setActivity] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        setAnswers((current) => ({ ...current, ...parsed, time: new Date(parsed.time) }));
      } catch {
        // A damaged local save should not stop the app.
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  function updateAnswer(key, value) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function scheduleReminder(title) {
    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return false;
    const reminderTime = new Date(answers.time);
    if (reminderTime <= new Date()) reminderTime.setDate(reminderTime.getDate() + 1);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Sunventure reminder",
        body: `It is time for ${title}.`,
      },
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
      const response = await fetch(`${AI_HELPER_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await response.json();
      if (!response.ok || !data.activity) throw new Error("helper unavailable");
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
        "Please check your key, Wi-Fi, and that the Sunventure helper is running on the computer.",
      );
    } finally {
      setIsThinking(false);
    }
  }

  const timeText = answers.time.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>☀ Sunventure</Text>
        <Text style={styles.tagline}>A simple idea for a brighter day.</Text>

        {screen === "welcome" && (
          <View style={styles.card}>
            <Text style={styles.eyebrow}>WELCOME</Text>
            <Text style={styles.title}>Find something good to do.</Text>
            <Text style={styles.body}>
              Answer a few simple questions. Sunventure will suggest one activity made for your interests.
            </Text>
            <Text style={styles.safety}>✓ We will not ask for personal information.</Text>
            <Pressable style={styles.primaryButton} onPress={() => setScreen("questions")}>
              <Text style={styles.primaryText}>Get started</Text>
            </Pressable>
          </View>
        )}

        {screen === "questions" && (
          <View style={styles.card}>
            <BackButton onPress={() => setScreen("welcome")} />
            <Text style={styles.eyebrow}>1 OF 4 · YOUR IDEAS</Text>
            <Text style={styles.title}>What sounds good?</Text>
            <Text style={styles.body}>Choose one interest.</Text>
            <View style={styles.choices}>
              {choiceSets.interest.map((item) => (
                <Choice key={item} label={item} selected={answers.interest === item} onPress={() => updateAnswer("interest", item)} />
              ))}
            </View>
            <Text style={styles.questionLabel}>Would you like company?</Text>
            <View style={styles.choices}>
              {choiceSets.company.map((item) => (
                <Choice key={item} label={item} selected={answers.company === item} onPress={() => updateAnswer("company", item)} />
              ))}
            </View>
            <Pressable disabled={!answers.interest || !answers.company} style={[styles.primaryButton, (!answers.interest || !answers.company) && styles.disabled]} onPress={() => setScreen("language")}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          </View>
        )}

        {screen === "language" && (
          <View style={styles.card}>
            <BackButton onPress={() => setScreen("questions")} />
            <Text style={styles.eyebrow}>2 OF 4 · LANGUAGE</Text>
            <Text style={styles.title}>Which language do you prefer?</Text>
            <Text style={styles.body}>Your activity idea will use this language.</Text>
            <View style={styles.choices}>
              {choiceSets.language.map((item) => (
                <Choice key={item} label={item} selected={answers.language === item} onPress={() => updateAnswer("language", item)} />
              ))}
            </View>
            <Pressable style={styles.primaryButton} onPress={() => setScreen("filter")}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          </View>
        )}

        {screen === "filter" && (
          <View style={styles.card}>
            <BackButton onPress={() => setScreen("language")} />
            <Text style={styles.eyebrow}>3 OF 4 · PLACE</Text>
            <Text style={styles.title}>Where would you like to do it?</Text>
            <Text style={styles.body}>This is your activity filter.</Text>
            <View style={styles.choices}>
              {choiceSets.setting.map((item) => (
                <Choice key={item} label={item} selected={answers.setting === item} onPress={() => updateAnswer("setting", item)} />
              ))}
            </View>
            <Pressable disabled={!answers.setting} style={[styles.primaryButton, !answers.setting && styles.disabled]} onPress={() => setScreen("time")}>
              <Text style={styles.primaryText}>Next</Text>
            </Pressable>
          </View>
        )}

        {screen === "time" && (
          <View style={styles.card}>
            <BackButton onPress={() => setScreen("filter")} />
            <Text style={styles.eyebrow}>4 OF 4 · REMINDER</Text>
            <Text style={styles.title}>When would you like to do it?</Text>
            <Text style={styles.body}>Sunventure can remind you at this time.</Text>
            <Pressable style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
              <Text style={styles.timeText}>⏰ {timeText}</Text>
              <Text style={styles.changeText}>Change time</Text>
            </Pressable>
            {showTimePicker && (
              <DateTimePicker value={answers.time} mode="time" onChange={(_, value) => { setShowTimePicker(false); if (value) updateAnswer("time", value); }} />
            )}
            <Pressable disabled={isThinking} style={[styles.primaryButton, isThinking && styles.disabled]} onPress={findActivity}>
              <Text style={styles.primaryText}>{isThinking ? "Thinking…" : "Find A Activity"}</Text>
            </Pressable>
            <Text style={styles.smallNote}>The AI only answers after you tap the button.</Text>
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
            <Pressable style={styles.primaryButton} onPress={() => setScreen("questions")}>
              <Text style={styles.primaryText}>Try another idea</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FFF8E8" },
  container: { flexGrow: 1, padding: 24, paddingTop: 36, justifyContent: "center" },
  logo: { color: "#F28C28", fontSize: 27, fontWeight: "800", letterSpacing: 0.3 },
  tagline: { color: "#675F53", fontSize: 16, marginTop: 4, marginBottom: 22 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, shadowColor: "#8C6A2D", shadowOpacity: 0.12, shadowRadius: 16, elevation: 3 },
  eyebrow: { color: "#B5661B", fontSize: 13, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10 },
  title: { color: "#27231E", fontSize: 31, fontWeight: "800", lineHeight: 38, marginBottom: 12 },
  body: { color: "#675F53", fontSize: 18, lineHeight: 27, marginBottom: 20 },
  safety: { color: "#31735A", fontSize: 16, lineHeight: 23, marginBottom: 20 },
  questionLabel: { color: "#27231E", fontSize: 18, fontWeight: "700", marginTop: 20, marginBottom: 10 },
  choices: { gap: 10 },
  choice: { borderWidth: 2, borderColor: "#E8DFD1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: "#FFFCF6" },
  choiceSelected: { borderColor: "#F28C28", backgroundColor: "#FFF0D4" },
  choiceText: { color: "#3B352D", fontSize: 18, fontWeight: "600" },
  choiceTextSelected: { color: "#8D4C0B" },
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
