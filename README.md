# Flashcards EN — Vite + React + TypeScript

Веб-версия карточек: **Home**, **Study**, **Settings**. Прогресс в **localStorage**, озвучка — **Web Speech API** (en-US). Сборка: **`dist/`** для статического хостинга.

## Команды

```bash
# удалите старый node_modules от Expo, затем:
npm install
npm run dev
npm run build
```

После `npm run build` загрузите содержимое папки **`dist`** на Netlify / GitHub Pages / любой static host.

## GitHub Pages (подпапка)

Если сайт не в корне домена, в `vite.config.ts` укажите:

```ts
base: "/repo-name/"
```

## Данные

- `src/data/words.json` — без изменений
- `src/lib/sm2.ts` — SM-2, без изменений
- Ключи localStorage: `@flashcards_progress_v1`, `@flashcards_settings_v1`

## Макет

Колонка **max-width: 480px**, мобильный вид.
