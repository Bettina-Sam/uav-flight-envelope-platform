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
  { code: 'kn-IN', label: 'ಕನ್ನಡ ಧ್ವನಿ' },
  { code: 'hi-IN', label: 'हिन्दी आवाज़' },
  { code: 'ta-IN', label: 'தமிழ் குரல்' },
];

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let speechGeneration = 0;

export function isNarrationSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || 'Audio' in window);
}

function rankVoice(voice: SpeechSynthesisVoice, lang: string): number {
  const normalized = voice.lang.replace('_', '-').toLowerCase();
  const target = lang.toLowerCase();
  let score = normalized === target ? 100 : normalized.startsWith(target.split('-')[0]) ? 70 : 0;
  if (/google|microsoft|premium|enhanced|natural/i.test(voice.name)) score += 20;
  if (voice.localService) score += 5;
  return score;
}

export async function loadNarrationVoices(timeoutMs = 1800): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length) return immediate;
  return new Promise((resolve) => {
    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, timeoutMs);
  });
}

export async function findNarrationVoice(lang: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await loadNarrationVoices();
  const ranked = voices
    .map((voice) => ({ voice, score: rankVoice(voice, lang) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.voice || null;
}

export async function speak(text: string, lang: string = 'en-US', onEnd?: () => void): Promise<boolean> {
  if (!isNarrationSupported()) return false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const voice = await findNarrationVoice(lang);
  if (!voice && (lang === 'hi-IN' || lang === 'ta-IN' || lang === 'kn-IN')) {
    const generation = ++speechGeneration;
    const chunks: string[] = [];
    let remaining = text.trim();
    while (remaining) {
      if (remaining.length <= 190) { chunks.push(remaining); break; }
      let cut = Math.max(remaining.lastIndexOf('.', 190), remaining.lastIndexOf('।', 190), remaining.lastIndexOf(' ', 190));
      if (cut < 80) cut = 190;
      chunks.push(remaining.slice(0, cut + 1).trim());
      remaining = remaining.slice(cut + 1).trim();
    }
    void (async () => {
      try {
        for (const chunk of chunks) {
          if (generation !== speechGeneration) return;
          const blob = await getLocalizedSpeechAudio(chunk, lang);
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          currentAudio = audio;
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
            audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Localized audio failed')); };
            audio.play().catch(reject);
          });
        }
      } catch {
        // The button returns to idle through onEnd below. Native voice packs
        // remain the preferred offline path.
      } finally {
        if (generation === speechGeneration) {
          currentAudio = null;
          if (onEnd) onEnd();
        }
      }
    })();
    return true;
  }
  if (!('speechSynthesis' in window)) return false;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = lang.startsWith('ta') || lang.startsWith('kn') ? 0.88 : lang.startsWith('hi') ? 0.92 : 1.0;
  utter.pitch = 1.0;
  if (voice) utter.voice = voice;
  if (onEnd) utter.onend = onEnd;
  currentUtterance = utter;
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking() {
  speechGeneration += 1;
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking)
    || !!(currentAudio && !currentAudio.paused && !currentAudio.ended);
}
import { getLocalizedSpeechAudio } from '../api/client';
