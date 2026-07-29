import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, AlertOctagon } from 'lucide-react';
import AutoDesignPanel from './AutoDesignPanel';
import FailureSimulationPanel from './FailureSimulationPanel';

type TabKey = 'auto-design' | 'failure-sim';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'auto-design', label: 'Auto Design', icon: Wand2 },
  { key: 'failure-sim', label: 'Failure Simulation', icon: AlertOctagon },
];

/**
 * Design Studio: Auto Design Optimizer (inverse design — find a
 * configuration that hits a target) and Failure Simulation (stress-test
 * the current configuration) are two sides of the same "explore the design
 * space" activity, so they share one nav destination as tabs.
 */
export default function DesignStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('tab') as TabKey) || 'auto-design';
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initial) ? initial : 'auto-design');

  const setTabAndUrl = (k: TabKey) => {
    setTab(k);
    setSearchParams({ tab: k }, { replace: true });
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-6 flex-wrap mb-2">
        <div>
          <div className="eyebrow mb-2">Design Studio</div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold mb-2">Optimize &amp; Stress-Test</h1>
          <p className="text-muted text-sm max-w-2xl">
            Two ways to explore the design space: search forward from a target (Auto Design), or
            stress-test the configuration you already have (Failure Simulation).
          </p>
        </div>
        <StudioHeaderVisual tab={tab} />
      </div>

      <div className="grid grid-cols-1 sm:inline-flex w-full sm:w-auto rounded-lg border border-border p-1 mt-6 mb-8 bg-panel/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabAndUrl(t.key)}
            className={`relative inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === t.key ? 'text-bg' : 'text-muted hover:text-text'
            }`}
          >
            {tab === t.key && (
              <motion.div layoutId="studio-tab-pill" className="absolute inset-0 bg-cyan rounded-md" transition={{ duration: 0.25 }} />
            )}
            <t.icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'auto-design' ? <AutoDesignPanel /> : <FailureSimulationPanel />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Small animated badge next to the header: a radar sweep while searching
 * the design space (Auto Design), a pulsing stress ring while
 * stress-testing (Failure Simulation). Purely decorative — reacts to the
 * active tab so it never contradicts what's actually happening below. */
function StudioHeaderVisual({ tab }: { tab: TabKey }) {
  return (
    <div className="relative w-24 h-24 shrink-0 hidden sm:block" aria-hidden data-i18n-skip>
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" className="text-border" strokeWidth="1.5" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" className="text-border" strokeWidth="1" opacity="0.6" />
        <AnimatePresence mode="wait">
          {tab === 'auto-design' ? (
            <motion.g key="sweep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '50px 50px' }}
              >
                <path d="M50 50 L50 6 A44 44 0 0 1 88 28 Z" fill="url(#studioSweep)" />
              </motion.g>
              <circle cx="50" cy="50" r="3" className="fill-cyan" />
            </motion.g>
          ) : (
            <motion.g key="pulse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.circle
                cx="50" cy="50" r="10" className="fill-amber/20 stroke-amber"
                strokeWidth="1.5"
                animate={{ r: [10, 44, 10], opacity: [0.9, 0, 0.9] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <circle cx="50" cy="50" r="4" className="fill-amber" />
            </motion.g>
          )}
        </AnimatePresence>
        <defs>
          <linearGradient id="studioSweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4FD1C5" stopOpacity="0" />
            <stop offset="100%" stopColor="#4FD1C5" stopOpacity="0.35" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
