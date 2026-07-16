import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sliders, GitCompare, Download, Loader2, RotateCcw } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { predict, getDesignScore } from '../api/client';
import { PredictResponse, DesignScoreResponse, UAVInput } from '../types';
import { listSavedConfigs, SavedConfig } from '../lib/savedConfigs';
import { narrateDashboard } from '../lib/narrationText';
import FlightProfileVisualizer from '../components/FlightProfileVisualizer';
import AltitudeGauge from '../components/AltitudeGauge';
import SafetyBadge from '../components/SafetyBadge';
import StatCard from '../components/StatCard';
import NarrateButton from '../components/NarrateButton';
import { drawFlightCard } from '../lib/flightCard';

const SLIDERS: { key: keyof UAVInput; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'mass_kg', label: 'Mass', min: 7, max: 3000, step: 1, unit: 'kg' },
  { key: 'battery_wh', label: 'Battery (Wh)', min: 100, max: 150000, step: 100, unit: 'Wh' },
  { key: 'wing_area_m2', label: 'Wing Area', min: 0.3, max: 25, step: 0.1, unit: 'm²' },
  { key: 'cd0', label: 'CD0', min: 0.006, max: 0.08, step: 0.001, unit: '' },
  { key: 'propulsion_efficiency', label: 'Propulsion Efficiency', min: 0.3, max: 0.95, step: 0.01, unit: '' },
];

export default function CommandCenterPage() {
  const { input, result: baseResult } = useUAV();

  const [liveInput, setLiveInput] = useState<UAVInput>(input);
  const [liveResult, setLiveResult] = useState<PredictResponse | null>(baseResult);
  const [tuning, setTuning] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <div className="eyebrow mb-1">Command Center</div>
          <h1 className="font-display text-3xl font-semibold">Mission Control</h1>
        </div>
        <div className="flex items-center gap-2">
          <NarrateButton text={narration} label="Narrate" />
          <button onClick={handleExportCard} className="inline-flex items-center gap-1.5 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-md font-semibold hover:opacity-90 transition">
            <Download className="w-3.5 h-3.5" /> Flight Card
          </button>
        </div>
      </div>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Everything at a glance: live flight profile, altitude envelope, design score, and key stats
        — with live tuning sliders and an optional side-by-side ghost comparison.
      </p>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="eyebrow">Flight Profile</div>
            <SafetyBadge status={p.safety_status} />
          </div>
          <FlightProfileVisualizer
            minAltitude={p.min_altitude_m} maxAltitude={p.max_altitude_m}
            recommendedAltitude={p.recommended_altitude_m} serviceCeiling={p.service_ceiling_m}
            cruiseSpeedMs={liveInput.cruise_speed_ms} rateOfClimbMs={p.rate_of_climb_ms}
            safetyStatus={p.safety_status as any} numEngines={1}
          />
        </div>
        <div className="panel p-5 flex flex-col items-center justify-center">
          <AltitudeGauge
            label="Altitude Envelope" min={p.min_altitude_m} max={p.max_altitude_m} recommended={p.recommended_altitude_m} serviceCeiling={p.service_ceiling_m}
            ghost={ghostResult ? {
              min: ghostResult.physics.min_altitude_m, max: ghostResult.physics.max_altitude_m,
              recommended: ghostResult.physics.recommended_altitude_m, serviceCeiling: ghostResult.physics.service_ceiling_m,
              label: savedConfigs.find((c) => c.id === ghostId)?.name || 'Ghost',
            } : undefined}
          />
        </div>
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
            <StatCard label="Endurance" value={p.endurance_hr.toFixed(2)} unit="hr" />
            <StatCard label="Range" value={p.range_km.toFixed(0)} unit="km" />
            <StatCard label="L/D" value={p.l_over_d.toFixed(2)} accent="green" />
            <StatCard label="Rate of Climb" value={p.rate_of_climb_ms.toFixed(1)} unit="m/s" />
          </div>
        </div>
      )}

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
                <span className="text-cyan">{liveInput[s.key]} {s.unit}</span>
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
                {(['recommended_altitude_m', 'endurance_hr', 'range_km', 'l_over_d', 'rate_of_climb_ms'] as const).map((k) => (
                  <tr key={k} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text">{k.replace(/_/g, ' ')}</td>
                    <td className="text-right px-3 text-cyan">{(liveResult.physics[k] as number).toFixed(2)}</td>
                    <td className="text-right pl-3 text-amber">{(ghostResult.physics[k] as number).toFixed(2)}</td>
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
