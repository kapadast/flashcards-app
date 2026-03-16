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

const KEY_CATEGORIES = '@flashcards_phrase_categories_v1'

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
  console.log('[cloudStorage] syncProgressToCloud', { userId, categoryId, count: rows.length })
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
  console.log('[cloudStorage] loadProgressFromCloud', { userId, categoryId, count: data?.length ?? 0 })
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
  console.log('[cloudStorage] syncCustomWordsToCloud', { userId, count: rows.length })
  await supabase
    .from('custom_words')
    .upsert(rows, { onConflict: 'user_id,word_id' })
}

export async function loadCustomWordsFromCloud(userId: string): Promise<WordEntry[]> {
  const { data } = await supabase
    .from('custom_words')
    .select('word_id,word,translation,example')
    .eq('user_id', userId)
  console.log('[cloudStorage] loadCustomWordsFromCloud', { userId, count: data?.length ?? 0 })
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
  console.log('[cloudStorage] syncCustomPhrasesToCloud', { userId, categoryId, count: rows.length })
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
  console.log('[cloudStorage] loadCustomPhrasesFromCloud', { userId, count: data?.length ?? 0 })
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
 * Порядок: 1) custom_words → localStorage, 2) custom_phrases (+ категории) → localStorage, 3) прогресс.
 */
export async function mergeAndLoadFromCloud(
  userId: string,
  baseWords: WordEntry[]
): Promise<void> {
  console.log('[cloudStorage] mergeAndLoadFromCloud start', { userId })
  // 1. Кастомные слова из Supabase → @flashcards_custom_words_v1
  await mergeCustomWords(userId, baseWords)
  // 2. Кастомные фразы по категориям → localStorage (+ создаём недостающие категории)
  await mergePhraseData(userId)
  // 3. Прогресс слов и фраз
  await mergeWordProgress(userId, baseWords)
  console.log('[cloudStorage] mergeAndLoadFromCloud done', { userId })
}

async function mergeWordProgress(userId: string, baseWords: WordEntry[]): Promise<void> {
  const cloudRows = await loadProgressFromCloud(userId, '')
  if (cloudRows.length === 0) {
    console.log('[cloudStorage] mergeWordProgress: no cloud progress')
    return
  }
  console.log('[cloudStorage] mergeWordProgress: merging', { count: cloudRows.length })
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
  if (cloudWords.length === 0) {
    console.log('[cloudStorage] mergeCustomWords: no cloud words')
    return
  }
  const local = loadCustomEntries()
  const localIds = new Set(local.map((w) => w.id))
  const toAdd = cloudWords.filter((w) => !localIds.has(w.id))
  const merged = [...local, ...toAdd]
  saveCustomEntries(merged)
  if (toAdd.length > 0) {
    const map = loadProgress(baseWords)
    saveProgress(map)
  }
  console.log('[cloudStorage] mergeCustomWords: saved to @flashcards_custom_words_v1', { added: toAdd.length, total: merged.length })
}

async function mergePhraseData(userId: string): Promise<void> {
  const cloudPhrases = await loadCustomPhrasesFromCloud(userId)
  if (cloudPhrases.length === 0) {
    console.log('[cloudStorage] mergePhraseData: no cloud phrases')
    return
  }

  // Уникальные категории из облака (id, name)
  const cloudCats = new Map<string, string>()
  for (const p of cloudPhrases) {
    if (!cloudCats.has(p.categoryId)) cloudCats.set(p.categoryId, p.category)
  }
  // Добавляем недостающие категории в localStorage (@flashcards_phrase_categories_v1)
  let userCats: Array<{ id: string; name: string }> = []
  try {
    const raw = localStorage.getItem(KEY_CATEGORIES)
    if (raw) {
      const arr = JSON.parse(raw) as Array<{ id: string; name: string }>
      if (Array.isArray(arr)) userCats = arr.filter((c) => c?.id && c?.name)
    }
  } catch {
    /* ignore */
  }
  const existingIds = new Set(userCats.map((c) => c.id))
  for (const [catId, name] of cloudCats) {
    if (!existingIds.has(catId)) {
      userCats.push({ id: catId, name })
      existingIds.add(catId)
    }
  }
  if (userCats.length > 0) {
    localStorage.setItem(KEY_CATEGORIES, JSON.stringify(userCats))
    console.log('[cloudStorage] mergePhraseData: categories saved', { count: userCats.length })
  }

  // Группируем фразы по категории и сохраняем в @flashcards_phrases_${categoryId}
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
    const merged = [
      ...localPhrases,
      ...toAdd.map((p) => ({ id: p.id, phrase: p.phrase, translation: p.translation, category: p.category })),
    ]
    savePhraseEntries(catId, merged)
    console.log('[cloudStorage] mergePhraseData: phrases saved', { categoryId: catId, added: toAdd.length, total: merged.length })
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
    const freshMap = loadPhraseProgressMap(cat.id)
    savePhraseProgressMap(cat.id, freshMap)
  }
}
