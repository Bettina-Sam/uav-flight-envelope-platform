/**
 * Subtle avionics-style audio feedback, synthesized with the Web Audio API
 * (no audio files to ship). Muted by default on first visit; the person's
 * choice is remembered in localStorage.
 */
const STORAGE_KEY = 'uav-envelope-sound-enabled';

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

export function isSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

function tone(freq: number, startOffset: number, duration: number, gainPeak: number, type: OscillatorType = 'sine') {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** SAFE: a short two-note ascending confirmation chime. */
function playSafe() {
  tone(660, 0, 0.16, 0.06);
  tone(880, 0.12, 0.22, 0.06);
}

/** CAUTION: a single soft mid-tone alert, played twice. */
function playCaution() {
  tone(440, 0, 0.18, 0.07, 'triangle');
  tone(440, 0.28, 0.18, 0.07, 'triangle');
}

/** CRITICAL: a low, urgent triple warning tone. */
function playCritical() {
  tone(220, 0, 0.14, 0.09, 'square');
  tone(220, 0.2, 0.14, 0.09, 'square');
  tone(220, 0.4, 0.18, 0.09, 'square');
}

export function playSafetyTone(status: 'SAFE' | 'CAUTION' | 'CRITICAL') {
  if (!isSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();
  if (status === 'SAFE') playSafe();
  else if (status === 'CAUTION') playCaution();
  else playCritical();
}

export function playFlightPhaseTone(phase: 'CLIMB' | 'CRUISE' | 'DESCEND') {
  if (!isSoundEnabled()) return;
  const audio = getCtx();
  if (!audio) return;
  if (audio.state === 'suspended') audio.resume();

  if (phase === 'CLIMB') {
    tone(420, 0, 0.18, 0.035, 'triangle');
    tone(560, 0.12, 0.18, 0.035, 'triangle');
    tone(720, 0.24, 0.2, 0.035, 'triangle');
  } else if (phase === 'CRUISE') {
    tone(310, 0, 0.32, 0.025, 'sine');
    tone(320, 0.18, 0.34, 0.02, 'sine');
  } else {
    tone(720, 0, 0.18, 0.035, 'triangle');
    tone(560, 0.12, 0.18, 0.035, 'triangle');
    tone(420, 0.24, 0.2, 0.035, 'triangle');
  }
}
