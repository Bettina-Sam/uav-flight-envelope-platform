import { useEffect, useState } from 'react';
import { Volume2, AlertCircle, Loader2 } from 'lucide-react';
import { speak, stopSpeaking, isNarrationSupported, isSpeaking, findNarrationVoice } from '../lib/voiceNarration';
import { useLanguage } from '../context/LanguageContext';

interface Props {
  text: string;
  label?: string;
}

/** Drop-in "narrate this page" control. Reads `text` aloud via the
 * browser's built-in TTS. Shows nothing if the browser doesn't support
 * SpeechSynthesis rather than a dead button. */
export default function NarrateButton({ text, label = 'Narrate this page' }: Props) {
  const { speechCode } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState<boolean | null>(null);
  const supported = isNarrationSupported();

  useEffect(() => {
    let active = true;
    setVoiceAvailable(null);
    findNarrationVoice(speechCode).then((voice) => { if (active) setVoiceAvailable(speechCode === 'en-US' || !!voice); });
    return () => { active = false; };
  }, [speechCode]);

  useEffect(() => {
    if (!supported) return;
    const interval = setInterval(() => setSpeaking(isSpeaking()), 400);
    return () => clearInterval(interval);
  }, [supported]);

  if (!supported) return null;

  const toggle = async () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else {
      const started = await speak(text, speechCode, () => setSpeaking(false));
      setSpeaking(started);
      if (!started) setVoiceAvailable(false);
    }
  };

  return (
    <div className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      <button
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md border transition ${
          speaking ? 'bg-cyan/15 border-cyan/50 text-cyan' : 'border-border text-muted hover:text-text hover:border-cyan/50'
        }`}
      >
        {speaking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
        {speaking ? 'Stop' : label}
      </button>
      {voiceAvailable === false && speechCode !== 'en-US' && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red max-w-[180px]" title="Install this language in your operating system's speech/voice settings, then restart the browser.">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {speechCode === 'ta-IN' ? 'Using online Tamil voice' : speechCode === 'kn-IN' ? 'Using online Kannada voice' : 'Using online Hindi voice'}
        </span>
      )}
    </div>
  );
}
