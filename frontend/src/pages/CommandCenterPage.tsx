import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import { Activity, Fuel, Route, BatteryCharging, Sliders, GitCompare, Download, Loader2, RotateCcw } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { predict, getDesignScore } from '../api/client';
import { PredictResponse, DesignScoreResponse, UAVInput } from '../types';
import { listSavedConfigs, SavedConfig } from '../lib/savedConfigs';
import { narrateDashboard } from '../lib/narrationText';
import StatCard from '../components/StatCard';
import NarrateButton from '../components/NarrateButton';
import { drawFlightCard } from '../lib/flightCard';
import { formatDurationHHMM } from '../lib/duration';

const SLIDERS: { key: keyof UAVInput; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'mass_kg', label: 'Mass', min: 7, max: 3000, step: 1, unit: 'kg' },
  { key: 'fuel_capacity_l', label: 'Fuel Capacity', min: 0, max: 5000, step: 5, unit: 'L' },
  { key: 'sfc_kg_per_n_s', label: 'SFC', min: 0.000003, max: 0.00002, step: 0.0000005, unit: 'kg/N*s' },
  { key: 'thrust_to_weight', label: 'Thrust-to-Weight', min: 0.05, max: 1.2, step: 0.01, unit: '' },
  { key: 'battery_wh', label: 'Battery (Wh)', min: 100, max: 150000, step: 100, unit: 'Wh' },
  { key: 'wing_area_m2', label: 'Wing Area', min: 0.3, max: 25, step: 0.1, unit: 'm²' },
  { key: 'cd0', label: 'CD0', min: 0.006, max: 0.08, step: 0.001, unit: '' },
  { key: 'propulsion_efficiency', label: 'Propulsion Efficiency', min: 0.3, max: 0.95, step: 0.01, unit: '' },
];

const TAPAS_BASELINE_RANGE_KM = 158.21;
const FUEL_DENSITY_KG_PER_L = 0.8;

function PerformanceVisual({
  label, value, numericValue, ghostValue, ghostLabel, icon: Icon,
}: {
  label: string;
  value: string;
  numericValue: number;
  ghostValue?: number;
  ghostLabel?: string;
  icon: typeof Route;
}) {
  const scaleMax = Math.max(numericValue, ghostValue ?? 0, 1) * 1.1;
  const currentWidth = Math.min(100, (numericValue / scaleMax) * 100);
  const ghostWidth = ghostValue == null ? 0 : Math.min(100, (ghostValue / scaleMax) * 100);
  return (
    <div className="panel p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="eyebrow flex items-center gap-2"><Icon className="w-4 h-4 text-cyan" /> {label}</div>
        <div className="font-mono text-3xl text-cyan">{value}</div>
      </div>
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-[10px] font-mono text-muted mb-1.5"><span>Current</span><span>{numericValue.toFixed(2)}</span></div>
          <div className="h-4 rounded-full bg-border/60 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${currentWidth}%` }} className="h-full bg-cyan rounded-full" />
          </div>
        </div>
        {ghostValue != null && (
          <div>
            <div className="flex justify-between text-[10px] font-mono text-muted mb-1.5"><span>{ghostLabel || 'Ghost'}</span><span>{ghostValue.toFixed(2)}</span></div>
            <div className="h-3 rounded-full bg-border/60 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${ghostWidth}%` }} className="h-full bg-amber rounded-full" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FuelGauge({ capacityL, estimatedBurnKgHr }: { capacityL: number; estimatedBurnKgHr: number }) {
  const capped = Math.max(0, Math.min(1, capacityL / 500));
  const angle = -100 + capped * 200;
  const reserveHours = estimatedBurnKgHr > 0 ? (capacityL * FUEL_DENSITY_KG_PER_L * 0.8) / estimatedBurnKgHr : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="eyebrow flex items-center gap-1.5"><Fuel className="w-3.5 h-3.5 text-amber" /> Fuel</div>
        <span className="text-[10px] font-mono text-muted">{capacityL.toFixed(0)} L</span>
      </div>
      <svg viewBox="0 0 180 112" className="w-full max-w-[220px] mx-auto">
        <path d="M24 92 A66 66 0 0 1 156 92" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="14" strokeLinecap="round" />
        <path d="M24 92 A66 66 0 0 1 156 92" fill="none" stroke="#F5A623" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${capped * 208} 208`} />
        <line x1="90" y1="92" x2="90" y2="34" stroke="#4FD1C5" strokeWidth="3" strokeLinecap="round" transform={`rotate(${angle} 90 92)`} />
        <circle cx="90" cy="92" r="5" fill="#4FD1C5" />
        <text x="24" y="108" fontSize="10" fontFamily="monospace" fill="#8A9BB5">EMPTY</text>
        <text x="134" y="108" fontSize="10" fontFamily="monospace" fill="#8A9BB5">500L+</text>
      </svg>
      <div className="text-center text-[11px] text-muted">
        Breguet fuel endurance: <span className="font-mono text-text">{formatDurationHHMM(reserveHours)} HH:MM</span>
      </div>
    </div>
  );
}

function sliderValue(input: UAVInput, key: keyof UAVInput) {
  const value = input[key] as number | string;
  if (typeof value !== 'number') return value;
  if (key === 'sfc_kg_per_n_s') return value.toExponential(2);
  if (key === 'cd0' || key === 'thrust_to_weight' || key === 'propulsion_efficiency') {
    return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  }
  return value;
}

export default function CommandCenterPage() {
  const { input, result: baseResult } = useUAV();

  const [liveInput, setLiveInput] = useState<UAVInput>(input);
  const [liveResult, setLiveResult] = useState<PredictResponse | null>(baseResult);
  const [tuning, setTuning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashboardExportRef = useRef<HTMLDivElement>(null);
  const [exportingPng, setExportingPng] = useState(false);

  const [score, setScore] = useState<DesignScoreResponse | null>(null);

  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [ghostId, setGhostId] = useState<string>('');
  const [ghostResult, setGhostResult] = useState<PredictResponse | null>(null);
  const [ghostLoading, setGhostLoading] = useState(false);

  useEffect(() => { setSavedConfigs(listSavedConfigs()); }, []);
  useEffect(() => { setLiveInput(input); setLiveResult(baseResult); }, [input, baseResult]);
  useEffect(() => {
    if (liveResult) getDesignScore(liveInput).then(setScore).catch(() => setScore(null));
  }, [liveResult, liveInput]);

  const handleSlide = (key: keyof UAVInput, value: number) => {
    const next = { ...liveInput, [key]: value };
    setLiveInput(next);
    setTuning(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await predict(next);
        setLiveResult(res);
      } finally {
        setTuning(false);
      }
    }, 300);
  };

  const resetTuning = () => { setLiveInput(input); setLiveResult(baseResult); };

  const handleGhostSelect = async (id: string) => {
    setGhostId(id);
    if (!id) { setGhostResult(null); return; }
    const cfg = savedConfigs.find((c) => c.id === id);
    if (!cfg) return;
    setGhostLoading(true);
    try {
      const res = await predict(cfg.input);
      setGhostResult(res);
    } finally {
      setGhostLoading(false);
    }
  };

  const handleExportCard = () => {
    if (!liveResult || !score) return;
    drawFlightCard(liveInput, liveResult, score);
  };

  const handleExportDashboard = async () => {
    if (!dashboardExportRef.current) return;
    setExportingPng(true);
    try {
      const canvas = await html2canvas(dashboardExportRef.current, {
        backgroundColor: '#07111f',
        useCORS: true,
        scale: Math.min(2, window.devicePixelRatio || 1),
        logging: false,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png', 1);
      link.download = `mission-control-${liveInput.aircraft_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
      link.click();
    } finally {
      setExportingPng(false);
    }
  };

  const narration = useMemo(() => (liveResult ? narrateDashboard(liveResult, score) : ''), [liveResult, score]);

  if (!liveResult) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">Run a prediction first to populate the Command Center.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const p = liveResult.physics;
  const tapasRangePct = (p.range_km / TAPAS_BASELINE_RANGE_KM) * 100;
  const fuelBurnKgHr = p.endurance_hr > 0 ? (liveInput.fuel_capacity_l * FUEL_DENSITY_KG_PER_L * 0.8) / p.endurance_hr : 0;
  const fuelConfig = liveInput.fuel_capacity_l > 0 || liveInput.sfc_kg_per_n_s > 0;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <div className="eyebrow mb-1">Command Center</div>
          <h1 className="font-display text-3xl font-semibold">Mission Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <NarrateButton text={narration} label="Narrate" />
          <button disabled={exportingPng} onClick={handleExportDashboard} className="inline-flex items-center gap-1.5 border border-cyan/50 text-cyan font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-md font-semibold hover:bg-cyan/10 transition disabled:opacity-50">
            {exportingPng ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Mission Control PNG
          </button>
          <button onClick={handleExportCard} className="inline-flex items-center gap-1.5 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-md font-semibold hover:opacity-90 transition">
            <Download className="w-3.5 h-3.5" /> Compact Card
          </button>
        </div>
      </div>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Range and endurance at a glance
        — with live tuning sliders and an optional side-by-side ghost comparison.
      </p>

      <div ref={dashboardExportRef} className="p-3 -mx-3 bg-bg rounded-lg">
      <div className="flex items-end justify-between gap-3 mb-3 px-1">
        <div>
          <div className="eyebrow">Mission Control Snapshot</div>
          <div className="font-display text-xl font-semibold mt-1">{liveInput.aircraft_name}</div>
        </div>
        <div className="text-[10px] font-mono text-muted">{new Date().toLocaleString()}</div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <PerformanceVisual
          label="Endurance"
          value={formatDurationHHMM(p.endurance_hr)}
          numericValue={p.endurance_hr}
          ghostValue={ghostResult?.physics.endurance_hr}
          ghostLabel={savedConfigs.find((c) => c.id === ghostId)?.name}
          icon={BatteryCharging}
        />
        <PerformanceVisual
          label="Range"
          value={p.range_km.toFixed(2)}
          numericValue={p.range_km}
          ghostValue={ghostResult?.physics.range_km}
          ghostLabel={savedConfigs.find((c) => c.id === ghostId)?.name}
          icon={Route}
        />
        <div className="panel p-5">
          <div className="eyebrow flex items-center gap-2 mb-3"><Activity className="w-4 h-4 text-cyan" /> Range Reference</div>
          <div className="font-mono text-3xl text-amber">{tapasRangePct.toFixed(0)}%</div>
          <p className="text-[11px] text-muted mt-2">Relative to the IUAS-MALE reference range value.</p>
        </div>
        {fuelConfig && <div className="panel p-5"><FuelGauge capacityL={liveInput.fuel_capacity_l} estimatedBurnKgHr={fuelBurnKgHr} /></div>}
      </div>

      {score && (
        <div className="panel p-5 mb-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl font-bold text-bg" style={{ background: score.grade === 'A' ? '#22C55E' : score.grade === 'F' ? '#EF4444' : '#4FD1C5' }}>
              {score.grade}
            </div>
            <div>
              <div className="eyebrow">Design Score</div>
              <div className="font-mono text-2xl text-text">{score.total.toFixed(0)}<span className="text-sm text-muted">/100</span></div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
            <StatCard label="Endurance" value={formatDurationHHMM(p.endurance_hr)} unit="HH:MM" />
            <StatCard label="Range" value={p.range_km.toFixed(2)} />
            <StatCard label="L/D" value={p.l_over_d.toFixed(2)} accent="green" />
            <StatCard label="Fuel Burn" value={fuelBurnKgHr.toFixed(1)} unit="kg/h" />
          </div>
        </div>
      )}
      </div>

      {/* Live tuning */}
      <div className="panel p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="eyebrow flex items-center gap-2"><Sliders className="w-4 h-4 text-cyan" /> Live Tuning</div>
          <div className="flex items-center gap-2">
            {tuning && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan" />}
            <button onClick={resetTuning} className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-muted hover:text-cyan transition"><RotateCcw className="w-3 h-3" /> Reset</button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SLIDERS.map((s) => (
            <div key={s.key}>
              <div className="flex justify-between text-[10px] font-mono text-muted mb-1.5">
                <span>{s.label}</span>
                <span className="text-cyan">{sliderValue(liveInput, s.key)} {s.unit}</span>
              </div>
              <input
                type="range" min={s.min} max={s.max} step={s.step}
                value={liveInput[s.key] as number}
                onChange={(e) => handleSlide(s.key, Number(e.target.value))}
                className="w-full accent-cyan"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted mt-3">Drag any slider — results update automatically (debounced ~300ms), no need to submit the form.</p>
      </div>

      {/* Ghost comparison */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="eyebrow flex items-center gap-2"><GitCompare className="w-4 h-4 text-cyan" /> Ghost Comparison</div>
          <select
            value={ghostId}
            onChange={(e) => handleGhostSelect(e.target.value)}
            className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text"
          >
            <option value="">None — select a saved config</option>
            {savedConfigs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {ghostLoading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Computing ghost…</div>
        ) : ghostResult ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono min-w-[420px]">
              <thead>
                <tr className="text-muted uppercase border-b border-border">
                  <th className="text-left py-2 pr-4">Metric</th>
                  <th className="text-right py-2 px-3 text-cyan">Current</th>
                  <th className="text-right py-2 pl-3 text-amber">Ghost</th>
                </tr>
              </thead>
              <tbody>
                {(['endurance_hr', 'range_km'] as const).map((k) => (
                  <tr key={k} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text">{k.replace(/_/g, ' ')}</td>
                    <td className="text-right px-3 text-cyan">{k === 'endurance_hr' ? formatDurationHHMM(liveResult.physics[k]) : (liveResult.physics[k] as number).toFixed(2)}</td>
                    <td className="text-right pl-3 text-amber">{k === 'endurance_hr' ? formatDurationHHMM(ghostResult.physics[k]) : (ghostResult.physics[k] as number).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted">Pick a saved configuration to compare side by side against the current live result.</p>
        )}
      </div>
    </div>
  );
}
