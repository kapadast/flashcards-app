import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { CardProgress, Quality } from "../types/card";
import { applySm2 } from "../lib/sm2";
import { saveProgress } from "../lib/storage";
import {
  loadPhraseProgressMap,
  savePhraseProgressMap,
} from "../lib/phraseStorage";
import { speakWord } from "../lib/speech";
import type { AppSettings } from "../lib/settings";
import { syncProgressToCloud } from "../lib/cloudStorage";
import styles from "./StudyPage.module.css";

type Props =
  | {
      mode: "words";
      ids: number[];
      progress: Map<number, CardProgress>;
      setProgress: React.Dispatch<
        React.SetStateAction<Map<number, CardProgress>>
      >;
      settings: AppSettings;
      userId: string | null;
      onDone: () => void;
    }
  | {
      mode: "phrases";
      categoryId: string;
      ids: number[];
      settings: AppSettings;
      userId: string | null;
      onDone: () => void;
    };

export function StudyPage(props: Props) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const isPhrases = props.mode === "phrases";

  const [phraseMap, setPhraseMap] = useState<Map<number, CardProgress>>(
    () => new Map()
  );

  useEffect(() => {
    if (isPhrases) {
      setPhraseMap(loadPhraseProgressMap(props.categoryId));
    }
  }, [isPhrases, isPhrases ? props.categoryId : ""]);

  const progress = isPhrases ? phraseMap : props.progress;
  const currentId = props.ids[index];
  const card = currentId != null ? progress.get(currentId) : undefined;

  const speak = useCallback(() => {
    if (!card) return;
    speakWord(card.word, {
      rate: props.settings.speechRate,
      pitch: props.settings.speechPitch,
    });
  }, [card, props.settings]);

  const onGrade = useCallback(
    (q: Quality) => {
      if (!card) return;
      const updated = applySm2(card, q);
      const m = new Map(progress);
      m.set(card.id, updated);

      if (props.mode === "words") {
        saveProgress(m);
        props.setProgress(m);
        if (props.userId) {
          syncProgressToCloud(props.userId, m).catch(() => null);
        }
      } else {
        savePhraseProgressMap(props.categoryId, m);
        setPhraseMap(m);
        if (props.userId) {
          syncProgressToCloud(props.userId, m, props.categoryId).catch(() => null);
        }
      }

      if (index + 1 >= props.ids.length) {
        props.onDone();
        navigate("/");
        return;
      }
      setIndex((i) => i + 1);
      setFlipped(false);
    },
    [card, progress, props, index, navigate]
  );

  if (!card) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>Нет карточек</p>
        <Link to="/">На главную</Link>
      </div>
    );
  }

  const toggleFlip = () => setFlipped((f) => !f);
  const showExample = !isPhrases && Boolean(card.example?.trim());

  const endSession = () => {
    if (props.mode === "words") {
      saveProgress(progress);
      if (props.userId) {
        syncProgressToCloud(props.userId, progress).catch(() => null);
      }
    } else {
      savePhraseProgressMap(props.categoryId, progress);
      if (props.userId) {
        syncProgressToCloud(props.userId, progress, props.categoryId).catch(() => null);
      }
    }
    props.onDone();
    navigate("/");
  };

  return (
    <div className={styles.page}>
      <p className={styles.counter}>
        {index + 1} / {props.ids.length}
      </p>

      <div
        className={styles.cardWrap}
        onClick={toggleFlip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleFlip();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <div className={styles.card}>
          {!flipped ? (
            <div className={styles.front}>
              <span className={styles.word}>{card.word}</span>
              <span
                role="button"
                tabIndex={0}
                className={styles.speak}
                onClick={(e) => {
                  e.stopPropagation();
                  speak();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    e.preventDefault();
                    speak();
                  }
                }}
              >
                🔊 Произношение
              </span>
              <span className={styles.hint}>
                {isPhrases
                  ? "Нажми — перевод"
                  : "Нажми, чтобы перевернуть"}
              </span>
            </div>
          ) : (
            <div className={styles.back}>
              <span className={styles.translation}>{card.translation}</span>
              {showExample ? (
                <span className={styles.example}>{card.example}</span>
              ) : null}
              <span className={styles.hint}>Нажми снова — обратно</span>
            </div>
          )}
        </div>
      </div>

      {flipped ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.grade} ${styles.again}`}
            onClick={() => onGrade("again")}
          >
            Не знаю
          </button>
          <button
            type="button"
            className={`${styles.grade} ${styles.good}`}
            onClick={() => onGrade("good")}
          >
            Знаю
          </button>
        </div>
      ) : null}

      <button type="button" className={styles.end} onClick={endSession}>
        Закончить сессию
      </button>
    </div>
  );
}
