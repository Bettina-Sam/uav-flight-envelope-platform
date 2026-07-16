import { useEffect, useState } from 'react';
import { Download, CheckCircle2, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isSafari(): boolean {
  const ua = window.navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|crios|fxios/i.test(ua);
}

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green">
        <CheckCircle2 className="w-4 h-4" /> Installed
      </span>
    );
  }

  // iOS Safari never fires beforeinstallprompt - it has its own manual
  // Share -> Add to Home Screen flow. Show a real button that opens
  // instructions instead of silently doing nothing.
  if (!deferredPrompt && isIOS() && isSafari()) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowIOSHint((v) => !v)}
          className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider rounded-md
            border border-cyan/40 text-cyan hover:bg-cyan/10 transition-colors
            ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}
        >
          <Download className="w-4 h-4" /> Install App
        </button>
        {showIOSHint && (
          <div className="absolute right-0 mt-2 w-64 panel p-4 z-50 text-xs text-text normal-case tracking-normal">
            <p className="flex items-center gap-1.5 mb-2 font-semibold">
              <Share className="w-3.5 h-3.5 text-cyan" /> To install on iOS:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-muted">
              <li>Tap the Share icon in Safari's toolbar</li>
              <li>Scroll down and tap "Add to Home Screen"</li>
              <li>Tap "Add" to confirm</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  if (!deferredPrompt) {
    // Browser hasn't offered install yet (already installed, unsupported
    // browser, or PWA install criteria not yet met - e.g. this only fires
    // reliably over HTTPS/production builds, not `npm run dev`).
    return null;
  }

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <button
      onClick={handleInstall}
      className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider rounded-md
        border border-cyan/40 text-cyan hover:bg-cyan/10 transition-colors
        ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}
    >
      <Download className="w-4 h-4" /> Install App
    </button>
  );
}
