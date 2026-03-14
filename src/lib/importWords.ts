import type { WordEntry } from "../types/card";

const CUSTOM_ID_START = 10_000_000;

/** word — translation (дефис, минус, тире) */
const LINE_DASH = /^(.+?)\s*[-–—]\s*(.+)$/u;

function norm(w: string): string {
  return w.trim().toLowerCase();
}

function exampleFor(word: string): string {
  return `Example: This is the word "${word}".`;
}

/** Слово → запись из words.json (без учёта регистра) */
export function buildBaseLookup(base: WordEntry[]): Map<string, WordEntry> {
  const m = new Map<string, WordEntry>();
  for (const e of base) m.set(norm(e.word), e);
  return m;
}

export type ImportResult = {
  added: WordEntry[];
  skippedDuplicate: number;
  skippedNoMatch: number;
};

/**
 * Парсинг textarea:
 * 1) одно слово на строку — только если есть в baseLookup
 * 2) слово — перевод — всегда (кастомный перевод)
 */
export function parseImportLines(
  text: string,
  baseLookup: Map<string, WordEntry>,
  existingNormWords: Set<string>,
  nextId: () => number
): ImportResult {
  const added: WordEntry[] = [];
  let skippedDuplicate = 0;
  let skippedNoMatch = 0;
  const seenThisBatch = new Set<string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const dash = line.match(LINE_DASH);
    if (dash) {
      const word = dash[1].trim();
      const translation = dash[2].trim();
      if (!word) continue;
      const key = norm(word);
      if (existingNormWords.has(key) || seenThisBatch.has(key)) {
        skippedDuplicate++;
        continue;
      }
      seenThisBatch.add(key);
      existingNormWords.add(key);
      added.push({
        id: nextId(),
        word,
        translation,
        example: exampleFor(word),
      });
      continue;
    }

    const key = norm(line);
    if (existingNormWords.has(key) || seenThisBatch.has(key)) {
      skippedDuplicate++;
      continue;
    }
    const fromBase = baseLookup.get(key);
    if (!fromBase) {
      skippedNoMatch++;
      continue;
    }
    seenThisBatch.add(key);
    existingNormWords.add(key);
    added.push({
      id: nextId(),
      word: fromBase.word,
      translation: fromBase.translation,
      example: fromBase.example,
    });
  }

  return { added, skippedDuplicate, skippedNoMatch };
}

export function nextCustomId(existingIds: Iterable<number>): number {
  let max = CUSTOM_ID_START - 1;
  for (const id of existingIds) {
    if (id >= CUSTOM_ID_START && id > max) max = id;
  }
  return max + 1;
}
