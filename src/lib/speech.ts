/** Web Speech API — en-US, rate/pitch как в настройках (грубое соответствие expo-speech) */
export function speakWord(
  word: string,
  opts: { rate?: number; pitch?: number } = {}
): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = Math.min(2, Math.max(0.5, opts.rate ?? 1));
  u.pitch = Math.min(2, Math.max(0.5, opts.pitch ?? 1));
  window.speechSynthesis.speak(u);
}

export function stopSpeech(): void {
  window.speechSynthesis?.cancel();
}
