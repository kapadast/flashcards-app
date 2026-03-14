const LINE_DASH = /^(.+?)\s*[-–—]\s*(.+)$/su;

export function parsePhraseImport(text: string): { phrase: string; translation: string }[] {
  const out: { phrase: string; translation: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE_DASH);
    if (m) {
      out.push({ phrase: m[1].trim(), translation: m[2].trim() });
    }
  }
  return out;
}
