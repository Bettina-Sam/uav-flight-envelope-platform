import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, BatteryCharging } from 'lucide-react';
import MetricDeepDivePage from './MetricDeepDivePage';

type TabKey = 'range' | 'endurance';

const TABS = [
  { key: 'range' as const, label: 'Range', icon: Route },
  { key: 'endurance' as const, label: 'Endurance', icon: BatteryCharging },
];

const RANGE_PARAMS = [
  { key: 'fuel_capacity_l' as const, label: 'Fuel Capacity (L)', min: 0, max: 5000 },
  { key: 'sfc_kg_per_n_s' as const, label: 'SFC (kg/N*s)', min: 0.000003, max: 0.00002 },
  { key: 'battery_wh' as const, label: 'Battery Capacity (Wh)', min: 100, max: 150000 },
  { key: 'mass_kg' as const, label: 'Mass (kg)', min: 7, max: 3000 },
  { key: 'cd0' as const, label: 'CD0', min: 0.006, max: 0.08 },
  { key: 'propulsion_efficiency' as const, label: 'Propulsion Efficiency', min: 0.3, max: 0.95 },
  { key: 'cruise_speed_ms' as const, label: 'Cruise Speed (m/s)', min: 8, max: 70 },
];

const ENDURANCE_PARAMS = [
  { key: 'fuel_capacity_l' as const, label: 'Fuel Capacity (L)', min: 0, max: 5000 },
  { key: 'sfc_kg_per_n_s' as const, label: 'SFC (kg/N*s)', min: 0.000003, max: 0.00002 },
  { key: 'battery_wh' as const, label: 'Battery Capacity (Wh)', min: 100, max: 150000 },
  { key: 'mass_kg' as const, label: 'Mass (kg)', min: 7, max: 3000 },
  { key: 'l_over_d' as const, label: 'Lift-to-Drag (L/D)', min: 5, max: 30 },
  { key: 'cd0' as const, label: 'CD0', min: 0.006, max: 0.08 },
  { key: 'propulsion_efficiency' as const, label: 'Propulsion Efficiency', min: 0.3, max: 0.95 },
];

export default function PerformanceAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const initial: TabKey = requested === 'endurance' ? 'endurance' : 'range';
  const [tab, setTab] = useState<TabKey>(initial);

  const selectTab = (next: TabKey) => {
    setTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  return (
    <div>
      <div className="eyebrow mb-2">Performance Analysis</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Range &amp; Endurance</h1>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Physics, ML comparison, parameter sweeps, and optimization suggestions for range and endurance.
      </p>

      <div className="inline-flex rounded-lg border border-border p-1 mb-8 bg-panel/40">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => selectTab(item.key)}
            className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-md font-mono text-xs uppercase tracking-wider transition-colors ${
              tab === item.key ? 'text-bg' : 'text-muted hover:text-text'
            }`}
          >
            {tab === item.key && <motion.div layoutId="perf-tab-pill" className="absolute inset-0 bg-cyan rounded-md" />}
            <item.icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {tab === 'range' ? (
            <MetricDeepDivePage
              target="range_km"
              title="Range"
              unit=""
              accentDesc="Physics, ML, sensitivity sweeps, and optimization for the project range value."
              relevantParams={RANGE_PARAMS}
            />
          ) : (
            <MetricDeepDivePage
              target="endurance_hr"
              title="Endurance"
              unit="hr"
              accentDesc="Physics, ML, sensitivity sweeps, and optimization for time airborne."
              relevantParams={ENDURANCE_PARAMS}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
