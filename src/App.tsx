import { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import wordsData from "./data/words.json";
import type { WordEntry, CardProgress } from "./types/card";
import { loadProgress, saveProgress } from "./lib/storage";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
import { getSession, onAuthStateChange } from "./lib/auth";
import { mergeAndLoadFromCloud, syncProgressToCloud } from "./lib/cloudStorage";
import { HomePage } from "./pages/HomePage";
import { StudyPage } from "./pages/StudyPage";
import { SettingsPage } from "./pages/SettingsPage";
import layout from "./App.module.css";

const words = wordsData as WordEntry[];

export type StudySession = {
  mode: "words" | "phrases";
  ids: number[];
  categoryId?: string;
};

function StudyRoute(props: {
  progressWords: Map<number, CardProgress>;
  setProgressWords: React.Dispatch<React.SetStateAction<Map<number, CardProgress>>>;
  settings: AppSettings;
  userId: string | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const sess = (location.state as { session?: StudySession } | null)?.session;

  if (!sess?.ids?.length) {
    return <Navigate to="/" replace />;
  }

  if (sess.mode === "phrases" && sess.categoryId) {
    return (
      <StudyPage
        mode="phrases"
        categoryId={sess.categoryId}
        ids={sess.ids}
        settings={props.settings}
        userId={props.userId}
        onDone={() => navigate("/", { replace: true })}
      />
    );
  }

  return (
    <StudyPage
      mode="words"
      ids={sess.ids}
      progress={props.progressWords}
      setProgress={props.setProgressWords}
      settings={props.settings}
      userId={props.userId}
      onDone={() => navigate("/", { replace: true })}
    />
  );
}

export default function App() {
  const [progressWords, setProgressWords] = useState<Map<number, CardProgress>>(
    () => new Map()
  );
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setProgressWords(loadProgress(words));
    setSettings(loadSettings());

    // Шаг 1: читаем сессию из localStorage + обрабатываем hash после OAuth-редиректа
    getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setLoading(false);

      if (sessionUser) {
        mergeAndLoadFromCloud(sessionUser.id, words)
          .then(() => {
            const freshMap = loadProgress(words);
            setProgressWords(freshMap);
            syncProgressToCloud(sessionUser.id, freshMap).catch(() => null);
          })
          .catch(() => null);
      }
    });

    // Шаг 2: слушаем последующие изменения (выход, рефреш токена и т.д.)
    const { data: sub } = onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);

      if (newUser && event === "SIGNED_IN") {
        await mergeAndLoadFromCloud(newUser.id, words);
        const freshMap = loadProgress(words);
        setProgressWords(freshMap);
        syncProgressToCloud(newUser.id, freshMap).catch(() => null);
      }

      if (event === "SIGNED_OUT") {
        setProgressWords(loadProgress(words));
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const persistSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const handleReloadWords = useCallback(() => {
    const map = loadProgress(words);
    setProgressWords(map);
    if (user) {
      syncProgressToCloud(user.id, map).catch(() => null);
    }
  }, [user]);

  if (loading) {
    return (
      <div className={layout.shell}>
        <div className={layout.frame}>
          <p className={layout.muted}>Загрузка…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={layout.shell}>
      <div className={layout.frame}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                baseWords={words}
                progressWords={progressWords}
                setProgressWords={setProgressWords}
                onReloadWords={handleReloadWords}
                user={user}
              />
            }
          />
          <Route
            path="/study"
            element={
              <StudyRoute
                progressWords={progressWords}
                setProgressWords={setProgressWords}
                settings={settings}
                userId={user?.id ?? null}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <SettingsPage settings={settings} onSave={persistSettings} />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
