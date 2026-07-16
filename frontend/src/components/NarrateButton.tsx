import { useEffect, useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { speak, stopSpeaking, isNarrationSupported, isSpeaking, VOICE_LANGS } from '../lib/voiceNarration';

interface Props {
  text: string;
  label?: string;
}

/** Drop-in "narrate this page" control. Reads `text` aloud via the
 * browser's built-in TTS. Shows nothing if the browser doesn't support
 * SpeechSynthesis rather than a dead button. */
export default function NarrateButton({ text, label = 'Narrate this page' }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLang] = useState('en-US');
  const supported = isNarrationSupported();

  useEffect(() => {
    if (!supported) return;
    const interval = setInterval(() => setSpeaking(isSpeaking()), 400);
    return () => clearInterval(interval);
  }, [supported]);

  if (!supported) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      speak(text, lang, () => setSpeaking(false));
      setSpeaking(true);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md border transition ${
          speaking ? 'bg-cyan/15 border-cyan/50 text-cyan' : 'border-border text-muted hover:text-text hover:border-cyan/50'
        }`}
      >
        {speaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
        {speaking ? 'Stop' : label}
      </button>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        title="Voice / accent (pronunciation only — text stays in English)"
        className="bg-bg border border-border rounded-md px-1.5 py-1.5 font-mono text-[10px] text-muted"
      >
        {VOICE_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
    </div>
  );
}
