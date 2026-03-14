import type { CardProgress } from "../types/card";

/** Карточки к повторению сейчас: просрочены или новые (nextReview === 0) */
export function dueCards(map: Map<number, CardProgress>, limit = 50): CardProgress[] {
  const now = Date.now();
  const list: CardProgress[] = [];
  for (const c of map.values()) {
    if (c.nextReview <= now) list.push(c);
  }
  list.sort((a, b) => a.nextReview - b.nextReview);
  return list.slice(0, limit);
}

export function stats(map: Map<number, CardProgress>) {
  const now = Date.now();
  let due = 0;
  let know = 0;
  let learned = 0;
  for (const c of map.values()) {
    if (c.nextReview <= now) due++;
    if ((c.repetitions ?? 0) >= 1) know++;
    if (c.interval >= 6) learned++;
  }
  return { due, total: map.size, know, learned };
}
