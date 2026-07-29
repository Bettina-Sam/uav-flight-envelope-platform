import { useEffect, useRef, useState } from 'react';
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

function isFirefox(): boolean {
  return /firefox|fxios/i.test(window.navigator.userAgent);
}

function isAndroid(): boolean {
  return /android/i.test(window.navigator.userAgent);
}

function isMacSafariDesktop(): boolean {
  return isSafari() && !isIOS();
}

/** The browser hasn't (and may never) fire `beforeinstallprompt`, but the
 * button must still be visible and clickable — it just falls back to
 * showing manual steps for whatever browser/OS combo we detected. */
function manualInstallSteps(): string[] {
  if (isIOS() && isSafari()) {
    return ['Tap the Share icon in Safari\u2019s toolbar', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" to confirm'];
  }
  if (isMacSafariDesktop()) {
    return ['Open the File menu', 'Choose "Add to Dock\u2026" (Safari 17+) or "Add to Home Screen"', 'Confirm the app name and add it'];
  }
  if (isFirefox()) {
    return ['Firefox does not support one-click app installs', 'Use the browser menu for an "Install" option if offered, or bookmark this page', 'For a true app install, open this URL in Chrome or Edge instead'];
  }
  if (isAndroid()) {
    return ['Open the browser menu (\u22ee)', 'Tap "Install app" or "Add to Home screen"', 'Confirm to add the icon to your home screen'];
  }
  return ['Open the browser menu', 'Look for "Install\u2026" or "Add to Home screen"', 'If it\u2019s not offered yet, browse a little more \u2014 some browsers only offer install after more engagement'];
}

export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!showHint) return;
    const onClick = (e: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(e.target as Node)) setShowHint(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowHint(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showHint]);

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-green">
        <CheckCircle2 className="w-4 h-4" /> Installed
      </span>
    );
  }

  const handleInstall = async () => {
    if (!deferredPrompt) {
      setShowHint((v) => !v);
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  const steps = manualInstallSteps();

  return (
    <div className="relative" ref={hintRef}>
      <button
        onClick={handleInstall}
        className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider rounded-md
          border border-cyan/40 text-cyan hover:bg-cyan/10 transition-colors
          ${compact ? 'px-3 py-1.5' : 'px-4 py-2.5'}`}
      >
        <Download className="w-4 h-4" /> Install App
      </button>
      {showHint && !deferredPrompt && (
        <div className="absolute right-0 mt-2 w-64 panel p-4 z-50 text-xs text-text normal-case tracking-normal">
          <p className="flex items-center gap-1.5 mb-2 font-semibold">
            <Share className="w-3.5 h-3.5 text-cyan" /> To install this app:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-muted">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
