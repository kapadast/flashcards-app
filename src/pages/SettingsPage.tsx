import { useState } from "react";
import { Link } from "react-router-dom";
import type { AppSettings } from "../lib/settings";
import styles from "./SettingsPage.module.css";

type Props = {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
};

const RATES = [0.5, 0.75, 1, 1.25, 1.5] as const;
const PITCHES = [
  { v: 0.8, label: "Ниже" },
  { v: 1, label: "Норма" },
  { v: 1.2, label: "Выше" },
] as const;

export function SettingsPage({ settings, onSave }: Props) {
  const [local, setLocal] = useState(settings);

  const persist = (s: AppSettings) => {
    setLocal(s);
    onSave(s);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Настройки</h1>

      <p className={styles.section}>Скорость речи (Web Speech)</p>
      <p className={styles.value}>{local.speechRate.toFixed(2)}</p>
      <div className={styles.row}>
        {RATES.map((r) => (
          <button
            key={r}
            type="button"
            className={`${styles.chip} ${local.speechRate === r ? styles.chipOn : ""}`}
            onClick={() => persist({ ...local, speechRate: r })}
          >
            {r}
          </button>
        ))}
      </div>

      <p className={styles.section}>Высота тона</p>
      <p className={styles.value}>{local.speechPitch.toFixed(2)}</p>
      <div className={styles.row}>
        {PITCHES.map(({ v, label }) => (
          <button
            key={v}
            type="button"
            className={`${styles.chip} ${local.speechPitch === v ? styles.chipOn : ""}`}
            onClick={() => persist({ ...local, speechPitch: v })}
          >
            {label}
          </button>
        ))}
      </div>

      <p className={styles.note}>
        Язык: en-US. Работает встроенный голос браузера (Speech Synthesis).
      </p>

      <Link className={styles.back} to="/">
        ← На главную
      </Link>
    </div>
  );
}
