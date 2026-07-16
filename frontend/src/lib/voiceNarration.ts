/**
 * Voice narration via the browser's built-in SpeechSynthesis API — no
 * external TTS service, no API key, works offline once voices are loaded.
 *
 * Honesty note: the `lang` option selects which installed system voice/
 * accent reads the text (e.g. 'hi-IN' will use a Hindi voice if the
 * person's OS has one installed, falling back to the browser default
 * otherwise) — it does NOT translate the summary text itself. Machine-
 * translating technical aerospace terminology reliably enough to ship is
 * a real quality bar this pass doesn't clear, so narration text is
 * English-only for now; the language selector affects pronunciation/voice
 * only. That's stated in the UI, not just here.
 */
export interface VoiceLang {
  code: string;
  label: string;
}

export const VOICE_LANGS: VoiceLang[] = [
  { code: 'en-US', label: 'English' },
  { code: 'hi-IN', label: 'Hindi voice (if installed)' },
  { code: 'ta-IN', label: 'Tamil voice (if installed)' },
];

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isNarrationSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: string = 'en-US', onEnd?: () => void) {
  if (!isNarrationSupported()) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 1.0;
  utter.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find((v) => v.lang === lang) || voices.find((v) => v.lang.startsWith(lang.split('-')[0]));
  if (match) utter.voice = match;
  if (onEnd) utter.onend = onEnd;
  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
}

export function stopSpeaking() {
  if (isNarrationSupported()) window.speechSynthesis.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return isNarrationSupported() && window.speechSynthesis.speaking;
}
