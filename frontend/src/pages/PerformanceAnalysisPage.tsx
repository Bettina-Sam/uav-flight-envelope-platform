import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Gauge, Route, BatteryCharging } from 'lucide-react';
import MetricDeepDivePage from './MetricDeepDivePage';

type TabKey = 'altitude' | 'range' | 'endurance';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'altitude', label: 'Altitude', icon: Gauge },
  { key: 'range', label: 'Range', icon: Route },
  { key: 'endurance', label: 'Endurance', icon: BatteryCharging },
];

const ALTITUDE_PARAMS = [
  { key: 'wing_area_m2' as const, label: 'Wing Area (m²)', min: 0.2, max: 25 },
  { key: 'l_over_d' as const, label: 'Lift-to-Drag (L/D)', min: 5, max: 30 },
  { key: 'cruise_speed_ms' as const, label: 'Cruise Speed (m/s)', min: 8, max: 70 },
  { key: 'thrust_to_weight' as const, label: 'Thrust-to-Weight', min: 0.01, max: 0.5 },
  { key: 'mass_kg' as const, label: 'Mass (kg)', min: 7, max: 3000 },
];

const RANGE_PARAMS = [
  { key: 'battery_wh' as const, label: 'Battery Capacity (Wh)', min: 100, max: 150000 },
  { key: 'mass_kg' as const, label: 'Mass (kg)', min: 7, max: 3000 },
  { key: 'cd0' as const, label: 'CD0', min: 0.006, max: 0.08 },
  { key: 'propulsion_efficiency' as const, label: 'Propulsion Efficiency', min: 0.3, max: 0.95 },
  { key: 'cruise_speed_ms' as const, label: 'Cruise Speed (m/s)', min: 8, max: 70 },
];

const ENDURANCE_PARAMS = [
  { key: 'battery_wh' as const, label: 'Battery Capacity (Wh)', min: 100, max: 150000 },
  { key: 'mass_kg' as const, label: 'Mass (kg)', min: 7, max: 3000 },
  { key: 'l_over_d' as const, label: 'Lift-to-Drag (L/D)', min: 5, max: 30 },
  { key: 'cd0' as const, label: 'CD0', min: 0.006, max: 0.08 },
  { key: 'propulsion_efficiency' as const, label: 'Propulsion Efficiency', min: 0.3, max: 0.95 },
];

/**
 * Unified Performance Analysis page: Altitude, Range, and Endurance each get
 * the same physics/ML/comparison/sensitivity/optimization workflow depth,
 * as tabs of one page instead of three separate nav destinations.
 */
export default function PerformanceAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (searchParams.get('tab') as TabKey) || 'altitude';
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initial) ? initial : 'altitude');

  const setTabAndUrl = (k: TabKey) => {
    setTab(k);
    setSearchParams({ tab: k }, { replace: true });
  };

  return (
    <div>
      <div className="eyebrow mb-2">Performance Analysis</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Altitude &middot; Range &middot; Endurance</h1>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        The three core performance envelopes, each with the same depth of analysis: physics
        prediction, ML prediction, comparison, sensitivity, and optimization suggestions.
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
              <motion.div layoutId="perf-tab-pill" className="absolute inset-0 bg-cyan rounded-md" transition={{ duration: 0.25 }} />
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
          {tab === 'altitude' && (
            <MetricDeepDivePage
              target="recommended_altitude_m"
              title="Altitude"
              unit="m"
              accentDesc="Full physics/ML/comparison/sensitivity/optimization workflow for recommended cruise altitude."
              relevantParams={ALTITUDE_PARAMS}
            />
          )}
          {tab === 'range' && (
            <MetricDeepDivePage
              target="range_km"
              title="Range"
              unit="km"
              accentDesc="Full physics/ML/comparison/sensitivity/optimization workflow for mission range — how far this UAV can fly on a full charge."
              relevantParams={RANGE_PARAMS}
            />
          )}
          {tab === 'endurance' && (
            <MetricDeepDivePage
              target="endurance_hr"
              title="Endurance"
              unit="hr"
              accentDesc="Full physics/ML/comparison/sensitivity/optimization workflow for flight endurance — how long this UAV can stay airborne."
              relevantParams={ENDURANCE_PARAMS}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
