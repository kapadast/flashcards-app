import type { CardProgress, Quality } from "../types/card";

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

/** SM-2: again=0 (сброс), good=4 (интервал растёт). hard оставлен для старых данных. */
export function applySm2(card: CardProgress, quality: Quality): CardProgress {
  let { interval, easeFactor, repetitions = 0 } = card;

  let q: number;
  if (quality === "again") q = 0;
  else if (quality === "hard") q = 3;
  else q = 4; // Знаю

  if (q < 3) {
    repetitions = 0;
    interval = 0;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < MIN_EASE) easeFactor = MIN_EASE;

  const days =
    q < 3
      ? 0
      : repetitions === 1
        ? 1
        : repetitions === 2
          ? 6
          : Math.max(1, interval);

  const nextReview =
    q < 3
      ? Date.now()
      : Date.now() + days * 24 * 60 * 60 * 1000;

  return {
    ...card,
    interval: days,
    easeFactor,
    nextReview,
    repetitions,
  };
}

export function defaultProgress(entry: {
  id: number;
  word: string;
  translation: string;
  example: string;
}): CardProgress {
  return {
    ...entry,
    interval: 0,
    easeFactor: DEFAULT_EASE,
    nextReview: 0,
    repetitions: 0,
  };
}
