import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Loader2 } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { explainPrediction } from '../api/client';
import { LocalExplanationResponse } from '../types';
import NarrateButton from '../components/NarrateButton';
import { narrateML } from '../lib/narrationText';
import StatCard from '../components/StatCard';
import SafetyBadge from '../components/SafetyBadge';

const TARGET_OPTIONS = [
  { key: 'recommended_altitude_m', label: 'Recommended Altitude' },
  { key: 'range_km', label: 'Range' },
  { key: 'endurance_hr', label: 'Endurance' },
  { key: 'rate_of_climb_ms', label: 'Rate of Climb' },
  { key: 'l_over_d', label: 'L/D Ratio' },
  { key: 'power_required_w', label: 'Power Required' },
];

export default function MLPredictionPage() {
  const { result, input } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const [target, setTarget] = useState('recommended_altitude_m');
  const [explanation, setExplanation] = useState<LocalExplanationResponse | null>(null);
  const [explLoading, setExplLoading] = useState(false);

  useEffect(() => {
    if (!result) return;
    setExplLoading(true);
    explainPrediction(input, target)
      .then(setExplanation)
      .catch(() => setExplanation(null))
      .finally(() => setExplLoading(false));
  }, [result, input, target]);

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">No prediction yet. Enter UAV parameters first.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const ml = result.ml;
  const p = result.physics;

  const diffFor = (key: keyof typeof p & keyof typeof ml) => {
    const pv = p[key] as unknown as number;
    const mv = ml[key] as unknown as number;
    if (typeof pv !== 'number' || typeof mv !== 'number' || Math.abs(pv) < 1e-9) return 0;
    return ((mv - pv) / Math.abs(pv)) * 100;
  };

  const ciRows = Object.entries(ml.confidence_intervals);

  const contribChartData = (explanation?.contributions || [])
    .slice(0, 8)
    .map((fc) => ({ name: fc.feature.replace(/_/g, ' '), value: Number(fc.contribution.toFixed(2)) }))
    .reverse();

  const reliabilityPct = ml.reliability_score * 100;
  const reliabilityColor = reliabilityPct >= 75 ? c.green : reliabilityPct >= 50 ? c.amber : c.red;

  return (
    <div>
      <div className="eyebrow mb-2">Step 3</div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">ML Surrogate Prediction</h1>
        <SafetyBadge status={ml.safety_status} />
        <span className="font-mono text-[11px] text-muted border border-border rounded-full px-3 py-1">
          model: {ml.model_used}
        </span>
        <div className="ml-auto"><NarrateButton text={narrateML(result)} label="Narrate" /></div>
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Predicted by the trained {ml.model_used} model from the same 14 design features — no
        internal physics simulation runs at inference time. This is the fast, deployable surrogate.
      </p>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel p-5">
          <div className="eyebrow">Safety Classifier Confidence</div>
          <div className="font-mono text-3xl text-cyan mt-1 mb-2">{(ml.safety_confidence * 100).toFixed(1)}%</div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <motion.div className="h-full bg-cyan" initial={{ width: 0 }} animate={{ width: `${ml.safety_confidence * 100}%` }} transition={{ duration: 0.6 }} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="panel p-5">
          <div className="eyebrow">Overall Reliability Score</div>
          <div className="font-mono text-3xl mt-1 mb-2" style={{ color: reliabilityColor }}>{reliabilityPct.toFixed(0)}%</div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <motion.div className="h-full" style={{ background: reliabilityColor }} initial={{ width: 0 }} animate={{ width: `${reliabilityPct}%` }} transition={{ duration: 0.6 }} />
          </div>
          <p className="text-[11px] text-muted mt-2">
            Blends the regression model's held-out R² ({(ml.model_r2 * 100).toFixed(0)}%) with the
            safety classifier's confidence for this specific input.
          </p>
        </motion.div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatCard label="Min Altitude" value={ml.min_altitude_m.toFixed(0)} unit="m" />
        <StatCard label="Max Altitude" value={ml.max_altitude_m.toFixed(0)} unit="m" />
        <StatCard label="Mean Altitude" value={ml.mean_altitude_m.toFixed(0)} unit="m" sub="(min+max)/2 — informational only" />
        <StatCard label="Recommended Altitude" value={ml.recommended_altitude_m.toFixed(0)} unit="m" accent="cyan" />
        <StatCard label="Service Ceiling" value={ml.service_ceiling_m.toFixed(0)} unit="m" />
        <StatCard label="Absolute Ceiling" value={ml.absolute_ceiling_m.toFixed(0)} unit="m" />
        <StatCard label="Rate of Climb" value={ml.rate_of_climb_ms.toFixed(2)} unit="m/s" />
        <StatCard label="Power Required" value={ml.power_required_w.toFixed(0)} unit="W" />
        <StatCard label="Lift" value={ml.lift_n.toFixed(1)} unit="N" />
        <StatCard label="Drag" value={ml.drag_n.toFixed(2)} unit="N" />
        <StatCard label="L/D Ratio" value={ml.l_over_d.toFixed(2)} accent="green" />
        <StatCard label="Range" value={ml.range_km.toFixed(1)} unit="km" />
        <StatCard label="Endurance" value={ml.endurance_hr.toFixed(2)} unit="hr" />
      </div>

      {/* Confidence intervals */}
      <div className="panel p-5 mb-8 overflow-x-auto">
        <div className="eyebrow mb-3">Confidence Intervals (Prediction ± Held-Out RMSE)</div>
        <table className="w-full text-xs font-mono min-w-[560px]">
          <thead>
            <tr className="text-muted uppercase border-b border-border">
              <th className="text-left py-2 pr-4">Target</th>
              <th className="text-right py-2 px-3">Lower</th>
              <th className="text-right py-2 px-3">Prediction</th>
              <th className="text-right py-2 px-3">Upper</th>
              <th className="text-right py-2 pl-3">± RMSE</th>
            </tr>
          </thead>
          <tbody>
            {ciRows.map(([key, ci]) => (
              <tr key={key} className="border-b border-border/50">
                <td className="py-2 pr-4 text-text">{key.replace(/_/g, ' ')}</td>
                <td className="text-right px-3 text-muted">{ci.lower.toFixed(1)}</td>
                <td className="text-right px-3 text-cyan">{(ml as any)[key]?.toFixed ? (ml as any)[key].toFixed(1) : '—'}</td>
                <td className="text-right px-3 text-muted">{ci.upper.toFixed(1)}</td>
                <td className="text-right pl-3 text-amber">±{ci.rmse.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted mt-3">
          Uncertainty bands are the trained model's actual held-out RMSE per target — not a fixed
          percentage placeholder. Wider bands mean the model historically had more error there.
        </p>
      </div>

      {/* Physics vs ML difference quick view */}
      <div className="panel p-5 mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="eyebrow">Physics vs ML — Key Differences</div>
          <Link to="/comparison" className="text-cyan font-mono text-[11px] uppercase tracking-wider">Full comparison →</Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 font-mono text-xs">
          {(['recommended_altitude_m', 'range_km', 'endurance_hr'] as const).map((key) => {
            const d = diffFor(key as any);
            const color = Math.abs(d) < 5 ? 'text-green' : Math.abs(d) < 15 ? 'text-amber' : 'text-red';
            return (
              <div key={key} className="border border-border rounded-md p-3">
                <div className="text-muted mb-1">{key.replace(/_/g, ' ')}</div>
                <div className={`text-sm ${color}`}>{d >= 0 ? '+' : ''}{d.toFixed(1)}% difference</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering explanation */}
      <div className="panel p-5 mb-8">
        <div className="eyebrow mb-2">Engineering Explanation</div>
        <p className="text-sm text-text leading-relaxed">
          The {ml.model_used} surrogate was trained on 6,000 physics-generated configurations and
          reproduces the physics engine's recommended altitude to within roughly{' '}
          {ciRows.find(([k]) => k === 'recommended_altitude_m')?.[1].rmse.toFixed(0) ?? '—'} m RMSE
          on held-out data. Because the ML model has no built-in physical constraints, always treat
          the Physics Engine result as ground truth and use the ML output as a fast, approximate
          cross-check — the comparison view below flags any large disagreement between the two.
        </p>
      </div>

      {/* Local feature contribution */}
      <div className="panel p-5 mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="eyebrow">Local Feature Contribution (this prediction)</div>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="bg-bg border border-border rounded-md px-2 py-1 font-mono text-xs text-text"
          >
            {TARGET_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {explLoading ? (
          <div className="flex items-center gap-2 text-muted text-sm py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Computing explanation…</div>
        ) : explanation ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={contribChartData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke={c.axis} fontSize={10} />
                <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={10} width={110} />
                <ReferenceLine x={0} stroke={c.axis} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {contribChartData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? c.cyan : c.red} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted mt-2">
              Occlusion-based local attribution: each bar shows how much replacing that one feature
              with the training-set average would move the {TARGET_OPTIONS.find(t => t.key === target)?.label}
              {' '}prediction — a fast, real (not fabricated) approximation of a per-prediction "why", in the
              spirit of SHAP. See Feature Importance for the waterfall view and global picture.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Explanation unavailable — is the backend running?</p>
        )}
      </div>

      <div className="mt-8">
        <Link to="/dashboard" className="text-cyan font-mono text-xs uppercase tracking-wider">
          View Flight Envelope Dashboard →
        </Link>
      </div>
    </div>
  );
}
