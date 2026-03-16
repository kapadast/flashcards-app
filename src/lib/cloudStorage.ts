import { supabase } from './supabase'
import type { CardProgress, WordEntry } from '../types/card'
import type { PhraseEntry } from '../types/phrase'
import {
  loadCustomEntries,
  saveCustomEntries,
  loadProgress,
  saveProgress,
} from './storage'
import {
  loadPhraseEntries,
  savePhraseEntries,
  loadPhraseProgressMap,
  savePhraseProgressMap,
  loadPhraseCategories,
} from './phraseStorage'

// ── user_progress ──────────────────────────────────────────────────────────
// columns: user_id, card_id, category_id, interval, ease_factor, next_review, repetitions
// unique constraint: (user_id, card_id, category_id)
// category_id = '' для слов, реальный id категории для фраз

export async function syncProgressToCloud(
  userId: string,
  progress: Map<number, CardProgress>,
  categoryId = ''
): Promise<void> {
  const rows = [...progress.values()].map((c) => ({
    user_id: userId,
    card_id: c.id,
    category_id: categoryId,
    interval: c.interval,
    ease_factor: c.easeFactor,
    next_review: c.nextReview,
    repetitions: c.repetitions ?? 0,
  }))
  if (rows.length === 0) return
  await supabase
    .from('user_progress')
    .upsert(rows, { onConflict: 'user_id,card_id,category_id' })
}

export async function loadProgressFromCloud(
  userId: string,
  categoryId = ''
): Promise<Pick<CardProgress, 'id' | 'interval' | 'easeFactor' | 'nextReview' | 'repetitions'>[]> {
  const { data } = await supabase
    .from('user_progress')
    .select('card_id,interval,ease_factor,next_review,repetitions')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
  if (!data) return []
  return data.map((r) => ({
    id: r.card_id as number,
    interval: r.interval as number,
    easeFactor: r.ease_factor as number,
    nextReview: r.next_review as number,
    repetitions: r.repetitions as number,
  }))
}

// ── custom_words ──────────────────────────────────────────────────────────
// columns: user_id, word_id, word, translation, example
// unique constraint: (user_id, word_id)

export async function syncCustomWordsToCloud(
  userId: string,
  words: WordEntry[]
): Promise<void> {
  if (words.length === 0) return
  const rows = words.map((w) => ({
    user_id: userId,
    word_id: w.id,
    word: w.word,
    translation: w.translation,
    example: w.example ?? '',
  }))
  await supabase
    .from('custom_words')
    .upsert(rows, { onConflict: 'user_id,word_id' })
}

export async function loadCustomWordsFromCloud(userId: string): Promise<WordEntry[]> {
  const { data } = await supabase
    .from('custom_words')
    .select('word_id,word,translation,example')
    .eq('user_id', userId)
  if (!data) return []
  return data.map((r) => ({
    id: r.word_id as number,
    word: r.word as string,
    translation: r.translation as string,
    example: (r.example as string) ?? '',
  }))
}

// ── custom_phrases ────────────────────────────────────────────────────────
// columns: user_id, phrase_id, phrase, translation, category_id, category_name
// unique constraint: (user_id, phrase_id, category_id)

export async function syncCustomPhrasesToCloud(
  userId: string,
  phrases: PhraseEntry[],
  categoryId: string
): Promise<void> {
  if (phrases.length === 0) return
  const rows = phrases.map((p) => ({
    user_id: userId,
    phrase_id: p.id,
    phrase: p.phrase,
    translation: p.translation,
    category_id: categoryId,
    category_name: p.category,
  }))
  await supabase
    .from('custom_phrases')
    .upsert(rows, { onConflict: 'user_id,phrase_id,category_id' })
}

export async function loadCustomPhrasesFromCloud(
  userId: string
): Promise<Array<PhraseEntry & { categoryId: string }>> {
  const { data } = await supabase
    .from('custom_phrases')
    .select('phrase_id,phrase,translation,category_id,category_name')
    .eq('user_id', userId)
  if (!data) return []
  return data.map((r) => ({
    id: r.phrase_id as number,
    phrase: r.phrase as string,
    translation: r.translation as string,
    category: r.category_name as string,
    categoryId: r.category_id as string,
  }))
}

// ── Слияние при входе ─────────────────────────────────────────────────────

/**
 * При входе загружаем данные из Supabase и объединяем с localStorage.
 * Стратегия: выбираем запись с большим числом повторений (repetitions).
 */
export async function mergeAndLoadFromCloud(
  userId: string,
  baseWords: WordEntry[]
): Promise<void> {
  await Promise.all([
    mergeWordProgress(userId, baseWords),
    mergeCustomWords(userId, baseWords),
    mergePhraseData(userId),
  ])
}

async function mergeWordProgress(userId: string, baseWords: WordEntry[]): Promise<void> {
  const cloudRows = await loadProgressFromCloud(userId, '')
  if (cloudRows.length === 0) return

  const localRaw = localStorage.getItem('@flashcards_progress_v1')
  const localArr: CardProgress[] = localRaw ? (JSON.parse(localRaw) as CardProgress[]) : []
  const localById = new Map(localArr.map((c) => [c.id, c]))

  for (const cr of cloudRows) {
    const local = localById.get(cr.id)
    if (!local || (cr.repetitions ?? 0) > (local.repetitions ?? 0)) {
      localById.set(cr.id, {
        id: cr.id,
        word: local?.word ?? '',
        translation: local?.translation ?? '',
        example: local?.example ?? '',
        interval: cr.interval,
        easeFactor: cr.easeFactor,
        nextReview: cr.nextReview,
        repetitions: cr.repetitions,
      })
    }
  }

  localStorage.setItem('@flashcards_progress_v1', JSON.stringify([...localById.values()]))

  // Также загружаем свежий прогресс из localStorage и пушим обратно в облако
  const freshMap = loadProgress(baseWords)
  saveProgress(freshMap)
}

async function mergeCustomWords(userId: string, baseWords: WordEntry[]): Promise<void> {
  const cloudWords = await loadCustomWordsFromCloud(userId)
  if (cloudWords.length === 0) return

  const local = loadCustomEntries()
  const localIds = new Set(local.map((w) => w.id))
  const toAdd = cloudWords.filter((w) => !localIds.has(w.id))
  if (toAdd.length > 0) {
    saveCustomEntries([...local, ...toAdd])
    const map = loadProgress(baseWords)
    saveProgress(map)
  }
}

async function mergePhraseData(userId: string): Promise<void> {
  const cloudPhrases = await loadCustomPhrasesFromCloud(userId)
  if (cloudPhrases.length === 0) return

  // Группируем фразы по категории
  const byCat = new Map<string, Array<PhraseEntry & { categoryId: string }>>()
  for (const p of cloudPhrases) {
    const arr = byCat.get(p.categoryId) ?? []
    arr.push(p)
    byCat.set(p.categoryId, arr)
  }

  for (const [catId, phrases] of byCat) {
    const localPhrases = loadPhraseEntries(catId)
    const localIds = new Set(localPhrases.map((p) => p.id))
    const toAdd = phrases.filter((p) => !localIds.has(p.id))
    if (toAdd.length > 0) {
      savePhraseEntries(catId, [
        ...localPhrases,
        ...toAdd.map((p) => ({ id: p.id, phrase: p.phrase, translation: p.translation, category: p.category })),
      ])
    }
  }

  // Мёржим прогресс по фразам
  const categories = loadPhraseCategories()
  for (const cat of categories) {
    const cloudRows = await loadProgressFromCloud(userId, cat.id)
    if (cloudRows.length === 0) continue

    const localRaw = localStorage.getItem(`@flashcards_phrases_progress_${cat.id}`)
    const localArr: CardProgress[] = localRaw ? (JSON.parse(localRaw) as CardProgress[]) : []
    const localById = new Map(localArr.map((c) => [c.id, c]))

    for (const cr of cloudRows) {
      const local = localById.get(cr.id)
      if (!local || (cr.repetitions ?? 0) > (local.repetitions ?? 0)) {
        localById.set(cr.id, {
          id: cr.id,
          word: local?.word ?? '',
          translation: local?.translation ?? '',
          example: local?.example ?? '',
          interval: cr.interval,
          easeFactor: cr.easeFactor,
          nextReview: cr.nextReview,
          repetitions: cr.repetitions,
        })
      }
    }
    localStorage.setItem(
      `@flashcards_phrases_progress_${cat.id}`,
      JSON.stringify([...localById.values()])
    )

    // Сохраняем итоговую карту
    const freshMap = loadPhraseProgressMap(cat.id)
    savePhraseProgressMap(cat.id, freshMap)
  }
}
