import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundEnabled, setSoundEnabled } from '../lib/sound';

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(isSoundEnabled());

  const toggle = () => {
    const next = !enabled;
    setSoundEnabled(next);
    setEnabled(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={enabled ? 'Mute avionics audio feedback' : 'Enable avionics audio feedback'}
      title={enabled ? 'Audio feedback: on' : 'Audio feedback: off'}
      className="p-2 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition"
    >
      {enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
    </button>
  );
}
