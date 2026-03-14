import React, { useEffect, useState, useCallback } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import wordsData from "./src/data/words.json";
import type { WordEntry, CardProgress } from "./src/types/card";
import { loadProgress, saveProgress } from "./src/lib/storage";
import { loadSettings, type AppSettings } from "./src/lib/settings";
import { HomeScreen } from "./src/screens/HomeScreen";
import { StudyScreen } from "./src/screens/StudyScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";

const words = wordsData as WordEntry[];

export type RootStackParamList = {
  Home: undefined;
  Study: { ids: number[] };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [progress, setProgress] = useState<Map<number, CardProgress>>(new Map());
  const [settings, setSettings] = useState<AppSettings>({
    speechRate: 1,
    speechPitch: 1,
  });
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const [map, s] = await Promise.all([
      loadProgress(words),
      loadSettings(),
    ]);
    setProgress(map);
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const onReload = useCallback(async () => {
    const map = await loadProgress(words);
    setProgress(map);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: "#1a1a24" },
            headerTintColor: "#fff",
            contentStyle: { backgroundColor: "#0f0f14" },
          }}
        >
          <Stack.Screen name="Home" options={{ title: "Главная" }}>
            {(props) => (
              <HomeScreen
                {...props}
                progress={progress}
                loading={loading}
                onReload={onReload}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Study" options={{ title: "Учёба" }}>
            {(props) => (
              <StudyScreen
                {...props}
                progress={progress}
                setProgress={setProgress}
                settings={settings}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Settings" options={{ title: "Настройки" }}>
            {(props) => (
              <SettingsScreen
                {...props}
                settings={settings}
                setSettings={setSettings}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
