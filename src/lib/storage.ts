import type { CardProgress } from "../types/card";
import { defaultProgress } from "./sm2";
import type { WordEntry } from "../types/card";

const KEY = "@flashcards_progress_v1";
const KEY_CUSTOM = "@flashcards_custom_words_v1";

/** Текст карточки из words.json / кастома; из progress — только SM-2. */
function mergeFromWords(saved: CardProgress | undefined, w: WordEntry): CardProgress {
  if (!saved) return defaultProgress(w);
  return {
    id: w.id,
    word: w.word,
    translation: w.translation,
    example: w.example,
    interval: saved.interval,
    easeFactor: saved.easeFactor,
    nextReview: saved.nextReview,
    repetitions: saved.repetitions ?? 0,
  };
}

export function loadCustomEntries(): WordEntry[] {
  try {
    const raw = localStorage.getItem(KEY_CUSTOM);
    if (!raw) return [];
    const arr = JSON.parse(raw) as WordEntry[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCustomEntries(entries: WordEntry[]): void {
  localStorage.setItem(KEY_CUSTOM, JSON.stringify(entries));
}

function loadSavedProgressById(): Map<number, CardProgress> {
  const savedById = new Map<number, CardProgress>();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr: CardProgress[] = JSON.parse(raw);
      for (const c of arr) savedById.set(c.id, c);
    }
  } catch {
    /* ignore */
  }
  return savedById;
}

/** Полная колода: words.json + импортированные слова */
export function loadProgress(baseWords: WordEntry[]): Map<number, CardProgress> {
  const savedById = loadSavedProgressById();
  const map = new Map<number, CardProgress>();
  for (const w of baseWords) {
    map.set(w.id, mergeFromWords(savedById.get(w.id), w));
  }
  for (const w of loadCustomEntries()) {
    map.set(w.id, mergeFromWords(savedById.get(w.id), w));
  }
  return map;
}

export function saveProgress(map: Map<number, CardProgress>): void {
  localStorage.setItem(KEY, JSON.stringify([...map.values()]));
}

export function clearProgress(): void {
  localStorage.removeItem(KEY);
}

/** Добавить импорт: дописать кастомные записи, обновить progress в storage для новых id */
export function appendCustomWords(
  baseWords: WordEntry[],
  newEntries: WordEntry[]
): Map<number, CardProgress> {
  const custom = loadCustomEntries();
  const merged = [...custom, ...newEntries];
  saveCustomEntries(merged);
  const map = loadProgress(baseWords);
  saveProgress(map);
  return map;
}
