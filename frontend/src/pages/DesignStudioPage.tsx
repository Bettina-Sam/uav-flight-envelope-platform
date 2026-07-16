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
      <div className="eyebrow mb-2">Design Studio</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Optimize &amp; Stress-Test</h1>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Two ways to explore the design space: search forward from a target (Auto Design), or
        stress-test the configuration you already have (Failure Simulation).
      </p>

      <div className="inline-flex rounded-lg border border-border p-1 mb-8 bg-panel/40">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTabAndUrl(t.key)}
            className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-colors ${
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
