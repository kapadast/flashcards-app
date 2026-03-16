import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import type { CardProgress, WordEntry } from "../types/card";
import { dueCards, stats } from "../lib/queue";
import {
  appendCustomWords,
  loadCustomEntries,
} from "../lib/storage";
import {
  buildBaseLookup,
  nextCustomId,
  parseImportLines,
} from "../lib/importWords";
import {
  loadPhraseCategories,
  addPhraseCategory,
  loadPhraseProgressMap,
  loadPhraseEntries,
  appendPhrases,
} from "../lib/phraseStorage";
import { parsePhraseImport } from "../lib/importPhrases";
import {
  syncCustomWordsToCloud,
  syncCustomPhrasesToCloud,
} from "../lib/cloudStorage";
import { signInWithGoogle, signOut } from "../lib/auth";
import type { StudySession } from "../App";
import styles from "./HomePage.module.css";

const SESSION = 35;

type Props = {
  baseWords: WordEntry[];
  progressWords: Map<number, CardProgress>;
  setProgressWords: React.Dispatch<
    React.SetStateAction<Map<number, CardProgress>>
  >;
  onReloadWords: () => void;
  user: User | null;
};

function normWord(w: string): string {
  return w.trim().toLowerCase();
}

export function HomePage(props: Props) {
  const {
    baseWords,
    progressWords,
    setProgressWords,
    onReloadWords,
    user,
  } = props;
  const navigate = useNavigate();
  const [tab, setTab] = useState<"words" | "phrases">("words");
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState(() => loadPhraseCategories());

  const [importWordsOpen, setImportWordsOpen] = useState(false);
  const [importWordsText, setImportWordsText] = useState("");
  const [importWordsMsg, setImportWordsMsg] = useState<string | null>(null);

  const [importPhraseCatId, setImportPhraseCatId] = useState<string | null>(
    null
  );
  const [importPhraseText, setImportPhraseText] = useState("");
  const [importPhraseMsg, setImportPhraseMsg] = useState<string | null>(null);

  const [newThemeOpen, setNewThemeOpen] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");

  const wordsStats = stats(progressWords);
  const wordsQueue = useMemo(
    () => dueCards(progressWords, 500),
    [progressWords]
  );
  const wordsSessionIds = useMemo(
    () => wordsQueue.slice(0, SESSION).map((c) => c.id),
    [wordsQueue]
  );

  const phraseAggregate = useMemo(() => {
    let due = 0;
    let total = 0;
    let know = 0;
    let learned = 0;
    for (const cat of categories) {
      const m = loadPhraseProgressMap(cat.id);
      const s = stats(m);
      due += s.due;
      total += s.total;
      know += s.know;
      learned += s.learned;
    }
    return { due, total, know, learned };
  }, [categories, tab]);

  const refreshCategories = () => setCategories(loadPhraseCategories());

  const startWords = useCallback(() => {
    if (wordsSessionIds.length === 0) return;
    const session: StudySession = {
      mode: "words",
      ids: wordsSessionIds,
    };
    navigate("/study", { state: { session } });
  }, [wordsSessionIds, navigate]);

  const runImportWords = () => {
    setImportWordsMsg(null);
    const baseLookup = buildBaseLookup(baseWords);
    const existingNorm = new Set<string>();
    for (const c of progressWords.values()) existingNorm.add(normWord(c.word));
    const custom = loadCustomEntries();
    let id = nextCustomId(custom.map((e) => e.id));
    const nextId = () => id++;
    const result = parseImportLines(
      importWordsText,
      baseLookup,
      existingNorm,
      nextId
    );
    if (result.added.length === 0) {
      setImportWordsMsg(
        result.skippedNoMatch > 0 && result.skippedDuplicate === 0
          ? "Нет совпадений с базой. Укажите «слово — перевод» или слова из словаря."
          : "Нечего добавить."
      );
      return;
    }
    const map = appendCustomWords(baseWords, result.added);
    setProgressWords(map);
    setImportWordsMsg(
      `Добавлено: ${result.added.length}. Дубликатов: ${result.skippedDuplicate}.` +
        (result.skippedNoMatch > 0
          ? ` Не в базе: ${result.skippedNoMatch}.`
          : "")
    );
    setImportWordsText("");

    // Синхронизируем кастомные слова в облако
    if (user) {
      const allCustom = loadCustomEntries();
      syncCustomWordsToCloud(user.id, allCustom).catch(() => null);
    }
  };

  const startPhraseSession = (categoryId: string) => {
    const m = loadPhraseProgressMap(categoryId);
    const q = dueCards(m, 500).slice(0, SESSION).map((c) => c.id);
    if (q.length === 0) return;
    navigate("/study", {
      state: {
        session: { mode: "phrases" as const, ids: q, categoryId },
      },
    });
  };

  const runImportPhrases = (categoryId: string, categoryName: string) => {
    setImportPhraseMsg(null);
    const rows = parsePhraseImport(importPhraseText);
    if (rows.length === 0) {
      setImportPhraseMsg("Формат: фраза на английском — перевод (строка на фразу).");
      return;
    }
    appendPhrases(categoryId, categoryName, rows);
    setImportPhraseMsg(`Добавлено строк: ${rows.length}`);
    setImportPhraseText("");
    refreshCategories();

    // Синхронизируем фразы в облако
    if (user) {
      const allPhrases = loadPhraseEntries(categoryId);
      syncCustomPhrasesToCloud(user.id, allPhrases, categoryId).catch(() => null);
    }
  };

  const addTheme = () => {
    if (!newThemeName.trim()) return;
    addPhraseCategory(newThemeName.trim());
    setNewThemeName("");
    setNewThemeOpen(false);
    refreshCategories();
  };

  return (
    <div className={styles.page}>
      {/* Блок авторизации */}
      <div className={styles.authBar}>
        {user ? (
          <>
            <span className={styles.authEmail}>{user.email}</span>
            <button
              type="button"
              className={styles.authBtn}
              onClick={() => signOut()}
            >
              Выйти
            </button>
          </>
        ) : (
          <button
            type="button"
            className={styles.authBtnGoogle}
            onClick={() => signInWithGoogle()}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Войти через Google
          </button>
        )}
      </div>

      <h1 className={styles.title}>Flashcards EN</h1>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === "words" ? styles.tabOn : ""}`}
          onClick={() => setTab("words")}
        >
          Слова
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === "phrases" ? styles.tabOn : ""}`}
          onClick={() => setTab("phrases")}
        >
          Фразы
        </button>
      </div>

      {tab === "words" ? (
        <>
          <p className={styles.sub}>Слова: words.json + импорт</p>
          <div className={styles.card}>
            <span className={styles.label}>К повторению</span>
            <span className={styles.big}>{wordsStats.due}</span>
            <span className={styles.label}>Всего</span>
            <span className={styles.mid}>{wordsStats.total}</span>
            <span className={styles.label}>Знаю (нажимали «Знаю»)</span>
            <span className={styles.mid}>{wordsStats.know}</span>
            <span className={styles.label}>Выучено (6+ дн.)</span>
            <span className={styles.mid}>{wordsStats.learned}</span>
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={wordsSessionIds.length === 0}
            onClick={startWords}
          >
            {wordsSessionIds.length === 0 ? "На сегодня всё" : "Начать сессию"}
          </button>
          <button
            type="button"
            className={styles.importBtn}
            onClick={() => {
              setImportWordsOpen(true);
              setImportWordsMsg(null);
            }}
          >
            Импорт слов
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setBusy(true);
              onReloadWords();
              setBusy(false);
            }}
            disabled={busy}
          >
            {busy ? "…" : "Обновить прогресс"}
          </button>
        </>
      ) : (
        <>
          <p className={styles.sub}>Фразы по темам</p>
          <div className={styles.card}>
            <span className={styles.label}>К повторению (все темы)</span>
            <span className={styles.big}>{phraseAggregate.due}</span>
            <span className={styles.label}>Всего фраз</span>
            <span className={styles.mid}>{phraseAggregate.total}</span>
            <span className={styles.label}>Знаю (нажимали «Знаю»)</span>
            <span className={styles.mid}>{phraseAggregate.know}</span>
            <span className={styles.label}>Выучено (6+ дн.)</span>
            <span className={styles.mid}>{phraseAggregate.learned}</span>
          </div>
          <button
            type="button"
            className={styles.addTheme}
            onClick={() => setNewThemeOpen(true)}
          >
            + Новая тема
          </button>
          <ul className={styles.catList}>
            {categories.map((cat) => {
              const m = loadPhraseProgressMap(cat.id);
              const s = stats(m);
              const n = loadPhraseEntries(cat.id).length;
              const q = dueCards(m, 500).slice(0, SESSION).map((c) => c.id);
              return (
                <li key={cat.id} className={styles.catItem}>
                  <div className={styles.catHead}>
                    <strong className={styles.catName}>{cat.name}</strong>
                    <span className={styles.catMeta}>
                      {n} фраз · к повторению: {s.due}
                    </span>
                  </div>
                  <div className={styles.catActions}>
                    <button
                      type="button"
                      className={styles.primarySm}
                      disabled={q.length === 0}
                      onClick={() => startPhraseSession(cat.id)}
                    >
                      Начать сессию
                    </button>
                    <button
                      type="button"
                      className={styles.importBtnSm}
                      onClick={() => {
                        setImportPhraseCatId(cat.id);
                        setImportPhraseMsg(null);
                        setImportPhraseText("");
                      }}
                    >
                      Импорт фраз
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Link className={styles.link} to="/settings">
        Настройки
      </Link>

      {importWordsOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setImportWordsOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Импорт слов</h2>
            <p className={styles.modalHint}>
              Слово в строке (из словаря) или <strong>слово — перевод</strong>
            </p>
            <textarea
              className={styles.textarea}
              value={importWordsText}
              onChange={(e) => setImportWordsText(e.target.value)}
              rows={10}
            />
            {importWordsMsg ? (
              <p className={styles.importMsg}>{importWordsMsg}</p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setImportWordsOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.modalAdd}
                onClick={runImportWords}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {importPhraseCatId ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setImportPhraseCatId(null)}
        >
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>
              Импорт фраз ·{" "}
              {categories.find((c) => c.id === importPhraseCatId)?.name}
            </h2>
            <p className={styles.modalHint}>
              Одна фраза на строку: <strong>English phrase — перевод</strong>
            </p>
            <textarea
              className={styles.textarea}
              value={importPhraseText}
              onChange={(e) => setImportPhraseText(e.target.value)}
              rows={10}
              placeholder={'How are you? — Как дела?'}
            />
            {importPhraseMsg ? (
              <p className={styles.importMsg}>{importPhraseMsg}</p>
            ) : null}
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setImportPhraseCatId(null)}
              >
                Закрыть
              </button>
              <button
                type="button"
                className={styles.modalAdd}
                onClick={() => {
                  const cat = categories.find((c) => c.id === importPhraseCatId);
                  if (cat)
                    runImportPhrases(importPhraseCatId, cat.name);
                }}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {newThemeOpen ? (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setNewThemeOpen(false)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Новая тема</h2>
            <input
              className={styles.input}
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="Название"
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setNewThemeOpen(false)}
              >
                Отмена
              </button>
              <button type="button" className={styles.modalAdd} onClick={addTheme}>
                Создать
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
