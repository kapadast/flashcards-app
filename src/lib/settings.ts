const KEY = "@flashcards_settings_v1";

export interface AppSettings {
  speechRate: number;
  speechPitch: number;
}

const defaultSettings: AppSettings = {
  speechRate: 1,
  speechPitch: 1,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
