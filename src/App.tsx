import { useCallback, useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import wordsData from "./data/words.json";
import type { WordEntry, CardProgress } from "./types/card";
import { loadProgress, saveProgress } from "./lib/storage";
import { loadSettings, saveSettings, type AppSettings } from "./lib/settings";
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

  useEffect(() => {
    setProgressWords(loadProgress(words));
    setSettings(loadSettings());
    setLoading(false);
  }, []);

  const persistSettings = useCallback((s: AppSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

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
                onReloadWords={() => setProgressWords(loadProgress(words))}
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
