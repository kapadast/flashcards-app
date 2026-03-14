import type { CardProgress, WordEntry } from "../types/card";
import type { PhraseEntry, PhraseCategory } from "../types/phrase";
import { defaultProgress } from "./sm2";

const KEY_CATEGORIES = "@flashcards_phrase_categories_v1";

function phrasesDataKey(categoryId: string): string {
  return `@flashcards_phrases_${categoryId}`;
}

function phrasesProgressKey(categoryId: string): string {
  return `@flashcards_phrases_progress_${categoryId}`;
}

export const BUILTIN_PHRASE_CATEGORIES: PhraseCategory[] = [
  { id: "colloquial", name: "Разговорные" },
  { id: "marketing", name: "Маркетинг" },
  { id: "consulting", name: "Консалтинг" },
];

export function loadPhraseCategories(): PhraseCategory[] {
  let user: PhraseCategory[] = [];
  try {
    const raw = localStorage.getItem(KEY_CATEGORIES);
    if (raw) {
      const arr = JSON.parse(raw) as PhraseCategory[];
      if (Array.isArray(arr)) user = arr.filter((c) => c?.id && c?.name);
    }
  } catch {
    /* ignore */
  }
  const seen = new Set(BUILTIN_PHRASE_CATEGORIES.map((b) => b.id));
  const out = [...BUILTIN_PHRASE_CATEGORIES];
  for (const c of user) {
    if (!seen.has(c.id)) {
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

export function addPhraseCategory(name: string): PhraseCategory {
  const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cat: PhraseCategory = { id, name: name.trim() || "Тема" };
  const user: PhraseCategory[] = [];
  try {
    const raw = localStorage.getItem(KEY_CATEGORIES);
    if (raw) {
      const arr = JSON.parse(raw) as PhraseCategory[];
      if (Array.isArray(arr)) user.push(...arr.filter((c) => c?.id && c?.name));
    }
  } catch {
    /* ignore */
  }
  user.push(cat);
  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(user));
  return cat;
}

export function loadPhraseEntries(categoryId: string): PhraseEntry[] {
  try {
    const raw = localStorage.getItem(phrasesDataKey(categoryId));
    if (!raw) return [];
    return JSON.parse(raw) as PhraseEntry[];
  } catch {
    return [];
  }
}

export function savePhraseEntries(categoryId: string, entries: PhraseEntry[]): void {
  localStorage.setItem(phrasesDataKey(categoryId), JSON.stringify(entries));
}

function entryToWordEntry(p: PhraseEntry): WordEntry {
  return {
    id: p.id,
    word: p.phrase,
    translation: p.translation,
    example: "",
  };
}

function mergeFromSaved(saved: CardProgress | undefined, w: WordEntry): CardProgress {
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

function loadSavedPhraseProgress(categoryId: string): Map<number, CardProgress> {
  const m = new Map<number, CardProgress>();
  try {
    const raw = localStorage.getItem(phrasesProgressKey(categoryId));
    if (raw) {
      const arr: CardProgress[] = JSON.parse(raw);
      for (const c of arr) m.set(c.id, c);
    }
  } catch {
    /* ignore */
  }
  return m;
}

export function loadPhraseProgressMap(categoryId: string): Map<number, CardProgress> {
  const saved = loadSavedPhraseProgress(categoryId);
  const map = new Map<number, CardProgress>();
  for (const p of loadPhraseEntries(categoryId)) {
    map.set(p.id, mergeFromSaved(saved.get(p.id), entryToWordEntry(p)));
  }
  return map;
}

export function savePhraseProgressMap(
  categoryId: string,
  map: Map<number, CardProgress>
): void {
  localStorage.setItem(
    phrasesProgressKey(categoryId),
    JSON.stringify([...map.values()])
  );
}

export function nextPhraseId(categoryId: string): number {
  let max = 0;
  for (const p of loadPhraseEntries(categoryId)) {
    if (p.id > max) max = p.id;
  }
  return max + 1;
}

export function appendPhrases(
  categoryId: string,
  categoryName: string,
  newPhrases: { phrase: string; translation: string }[]
): Map<number, CardProgress> {
  const existing = loadPhraseEntries(categoryId);
  const seen = new Set(existing.map((e) => e.phrase.trim().toLowerCase()));
  let id = nextPhraseId(categoryId);
  const added: PhraseEntry[] = [];
  for (const row of newPhrases) {
    const ph = row.phrase.trim();
    const key = ph.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    added.push({
      id: id++,
      phrase: ph,
      translation: row.translation.trim(),
      category: categoryName,
    });
  }
  savePhraseEntries(categoryId, [...existing, ...added]);
  const map = loadPhraseProgressMap(categoryId);
  savePhraseProgressMap(categoryId, map);
  return map;
}
