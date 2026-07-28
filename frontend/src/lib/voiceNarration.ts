/**
 * Voice narration via the browser's built-in SpeechSynthesis API — no
 * external TTS service, no API key, works offline once voices are loaded.
 *
 * Localized English, Hindi, or Tamil narration text is read with the
 * matching installed system voice. A browser can fall back to its default
 * voice when that language's OS voice pack is not installed.
 */
export interface VoiceLang {
  code: string;
  label: string;
}

export const VOICE_LANGS: VoiceLang[] = [
  { code: 'en-US', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी आवाज़' },
  { code: 'ta-IN', label: 'தமிழ் குரல்' },
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
