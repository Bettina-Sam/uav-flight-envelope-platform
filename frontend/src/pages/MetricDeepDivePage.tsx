import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, PlayCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { runSensitivity, getOptimizeSuggestions } from '../api/client';
import { SensitivityPoint, UAVInput, OptimizeSuggestion } from '../types';
import StatCard from '../components/StatCard';
import SafetyBadge from '../components/SafetyBadge';

interface ParamCfg { key: keyof UAVInput; label: string; min: number; max: number }

interface Props {
  target: 'range_km' | 'endurance_hr' | 'recommended_altitude_m';
  title: string;
  unit: string;
  accentDesc: string;
  relevantParams: ParamCfg[];
}

const TIER_COLOR = (absDiff: number) => (absDiff < 5 ? 'text-green' : absDiff < 15 ? 'text-amber' : 'text-red');

export default function MetricDeepDivePage({ target, title, unit, accentDesc, relevantParams }: Props) {
  const { input, result } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);

  const [param, setParam] = useState<keyof UAVInput>(relevantParams[0].key);
  const [sweep, setSweep] = useState<SensitivityPoint[] | null>(null);
  const [sweepLoading, setSweepLoading] = useState(false);

  const [suggestions, setSuggestions] = useState<OptimizeSuggestion[] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    setSweep(null);
  }, [target]);

  useEffect(() => {
    if (!result) return;
    setSuggestLoading(true);
    getOptimizeSuggestions(input, target)
      .then((r) => setSuggestions(r.suggestions))
      .catch(() => setSuggestions(null))
      .finally(() => setSuggestLoading(false));
  }, [result, input, target]);

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">No prediction yet. Enter UAV parameters first.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const physicsValue = result.physics[target];
  const mlValue = result.ml[target];
  const entry = result.comparison.find((e) => e.target === target);
  const ci = (result.ml.confidence_intervals as any)[target];
  const paramCfg = relevantParams.find((p) => p.key === param)!;

  const runSweep = async () => {
    setSweepLoading(true);
    try {
      const pts = await runSensitivity(input, param, paramCfg.min, paramCfg.max, 18);
      setSweep(pts);
    } finally {
      setSweepLoading(false);
    }
  };

  const chartData = (sweep || []).map((p) => ({
    value: Number(p.parameter_value.toFixed(2)),
    target: target === 'range_km' ? Number(p.range_km.toFixed(1))
      : target === 'endurance_hr' ? Number(p.endurance_hr.toFixed(2))
      : Number(p.recommended_altitude_m.toFixed(0)),
  }));

  const diffTier = entry ? TIER_COLOR(Math.abs(entry.difference_pct)) : 'text-muted';

  return (
    <div>
      <div className="eyebrow mb-2">Deep-Dive Analysis</div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <SafetyBadge status={result.physics.safety_status} />
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">{accentDesc}</p>

      {/* Physics + ML predictions */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5">
          <div className="eyebrow mb-2">Physics Prediction</div>
          <div className="font-mono text-3xl text-text">{physicsValue.toFixed(2)} <span className="text-sm text-muted">{unit}</span></div>
          <p className="text-xs text-muted mt-2">Computed directly from steady-level-flight equations at the recommended cruise altitude.</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="panel p-5">
          <div className="eyebrow mb-2">ML Prediction</div>
          <div className="font-mono text-3xl text-cyan">{mlValue.toFixed(2)} <span className="text-sm text-muted">{unit}</span></div>
          {ci && (
            <p className="text-xs text-muted mt-2">
              90%-ish band (± held-out RMSE): {Math.max(0, mlValue - ci.rmse).toFixed(2)} – {(mlValue + ci.rmse).toFixed(2)} {unit}
            </p>
          )}
        </motion.div>
      </div>

      {/* Comparison */}
      {entry && (
        <div className="panel p-5 mb-6">
          <div className="eyebrow mb-3">Physics vs ML Comparison</div>
          <div className="flex items-center gap-2 font-mono text-sm flex-wrap">
            <div className="px-3 py-1.5 rounded-md border border-border">
              <div className="text-[10px] text-muted">Physics</div>
              <div className="text-text">{entry.physics_value.toFixed(2)} {unit}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted" />
            <div className="px-3 py-1.5 rounded-md border border-border">
              <div className="text-[10px] text-muted">ML</div>
              <div className="text-cyan">{entry.ml_value.toFixed(2)} {unit}</div>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-muted" />
            <div className="px-3 py-1.5 rounded-md border border-border">
              <div className="text-[10px] text-muted">Difference</div>
              <div className={diffTier}>{entry.difference_pct >= 0 ? '+' : ''}{entry.difference_pct.toFixed(1)}%</div>
            </div>
          </div>
          <Link to="/comparison" className="text-cyan font-mono text-[11px] uppercase tracking-wider mt-3 inline-block">Full comparison →</Link>
        </div>
      )}

      {/* Sensitivity + graph */}
      <div className="panel p-5 mb-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <div className="eyebrow">Sensitivity — {title} vs Parameter</div>
          <div className="flex items-center gap-2">
            <select
              value={param}
              onChange={(e) => { setParam(e.target.value as keyof UAVInput); setSweep(null); }}
              className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text"
            >
              {relevantParams.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={runSweep} disabled={sweepLoading}
              className="inline-flex items-center gap-1.5 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {sweepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              Sweep
            </motion.button>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
              <XAxis dataKey="value" stroke={c.axis} fontSize={10} label={{ value: paramCfg.label, position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
              <YAxis stroke={c.axis} fontSize={10} label={{ value: `${title} (${unit})`, angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 10 }} />
              <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
              <Line type="monotone" dataKey="target" stroke={c.cyan} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-muted">Run a sweep to see how {title.toLowerCase()} responds to {paramCfg.label.toLowerCase()}.</div>
        )}
      </div>

      {/* Optimization suggestions */}
      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan" /> Optimization Suggestions</div>
        {suggestLoading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Computing one-at-a-time sensitivities…</div>
        ) : suggestions && suggestions.length > 0 ? (
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <motion.div key={s.parameter} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="border border-border rounded-md p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <span className="font-mono text-sm text-text">{s.label}</span>
                  <span className="font-mono text-xs text-green">+{s.projected_change_pct.toFixed(1)}% {title.toLowerCase()}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{s.rationale}</p>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No single-parameter change (±10%) produced a meaningful improvement from the current configuration — it's already close to a local optimum among these parameters.</p>
        )}
      </div>

      {/* Engineering recommendation */}
      <div className="panel p-5">
        <div className="eyebrow mb-2">Engineering Recommendation</div>
        <p className="text-sm text-text leading-relaxed">
          {entry && Math.abs(entry.difference_pct) < 5
            ? `Physics and ML agree closely on ${title.toLowerCase()} (${Math.abs(entry.difference_pct).toFixed(1)}% apart) — the current estimate of ${physicsValue.toFixed(2)} ${unit} can be reported with confidence.`
            : `Physics and ML diverge by ${entry ? Math.abs(entry.difference_pct).toFixed(1) : '—'}% on ${title.toLowerCase()} — treat the physics-engine value (${physicsValue.toFixed(2)} ${unit}) as authoritative and consider this configuration to be outside the ML model's best-fit region.`}
          {' '}{suggestions && suggestions.length > 0 && `The single highest-leverage change available is adjusting ${suggestions[0].label.toLowerCase()}, projected to improve ${title.toLowerCase()} by ${suggestions[0].projected_change_pct.toFixed(1)}%.`}
        </p>
      </div>
    </div>
  );
}
