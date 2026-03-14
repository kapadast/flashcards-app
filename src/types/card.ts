/** Базовая карточка из JSON (без прогресса) */
export interface WordEntry {
  id: number;
  word: string;
  translation: string;
  example: string;
}

/** Карточка с полями SM-2 для хранения */
export interface CardProgress {
  id: number;
  word: string;
  translation: string;
  example: string;
  interval: number; // дни
  easeFactor: number;
  nextReview: number; // timestamp ms
  repetitions?: number;
}

export type Quality = "again" | "hard" | "good";
