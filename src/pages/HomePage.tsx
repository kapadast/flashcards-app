import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
