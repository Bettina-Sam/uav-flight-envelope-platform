import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle, LayoutGrid, Table2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';

const METRIC_META: Record<string, { label: string; unit: string }> = {
  recommended_altitude_m: { label: 'Recommended Altitude', unit: 'm' },
  service_ceiling_m: { label: 'Service Ceiling', unit: 'm' },
  absolute_ceiling_m: { label: 'Absolute Ceiling', unit: 'm' },
  rate_of_climb_ms: { label: 'Rate of Climb', unit: 'm/s' },
  range_km: { label: 'Range', unit: 'km' },
  endurance_hr: { label: 'Endurance', unit: 'hr' },
  lift_n: { label: 'Lift', unit: 'N' },
  drag_n: { label: 'Drag', unit: 'N' },
  l_over_d: { label: 'Lift-to-Drag Ratio', unit: '' },
  power_required_w: { label: 'Power Required', unit: 'W' },
};

const ORDER = [
  'recommended_altitude_m', 'endurance_hr', 'range_km', 'service_ceiling_m', 'absolute_ceiling_m',
  'rate_of_climb_ms', 'lift_n', 'drag_n', 'l_over_d', 'power_required_w',
];

function tier(absDiff: number, normalizedError: number | null): 'green' | 'yellow' | 'red' {
  if (normalizedError !== null) {
    if (absDiff < 5 || normalizedError <= 0.35) return 'green';
    if (absDiff < 20 || normalizedError <= 1.0) return 'yellow';
    return 'red';
  }
  if (absDiff < 5) return 'green';
  if (absDiff < 20) return 'yellow';
  return 'red';
}

const TIER_STYLE = {
  green: { bar: 'bg-green', text: 'text-green', bg: 'bg-green/10 border-green/30', Icon: CheckCircle2, label: 'Agree' },
  yellow: { bar: 'bg-amber', text: 'text-amber', bg: 'bg-amber/10 border-amber/30', Icon: AlertTriangle, label: 'Diverge' },
  red: { bar: 'bg-red', text: 'text-red', bg: 'bg-red/10 border-red/30', Icon: XCircle, label: 'ML Divergence' },
} as const;

function interpretation(metric: string, diffPct: number, t: 'green' | 'yellow' | 'red'): string {
  const dir = diffPct >= 0 ? 'higher' : 'lower';
  const meta = METRIC_META[metric];
  if (t === 'green') return `ML tracks the physics engine closely on ${meta.label.toLowerCase()} (${Math.abs(diffPct).toFixed(1)}% ${dir}) — consistent with the model's training fit for this region of the design space.`;
  if (t === 'yellow') return `ML is ${Math.abs(diffPct).toFixed(1)}% ${dir} than physics on ${meta.label.toLowerCase()}. Likely a mildly out-of-distribution input or a region where the surrogate has higher residual error.`;
  if (t === 'red') return `Large ML-vs-physics disagreement (${Math.abs(diffPct).toFixed(1)}% ${dir}) on ${meta.label.toLowerCase()}. Treat this as a surrogate-model warning, not a physics conflict; rely on the physics engine.`;
  return `Large disagreement (${Math.abs(diffPct).toFixed(1)}% ${dir}) on ${meta.label.toLowerCase()} — treat the ML value with caution here and rely on the physics engine.`;
}

function recommendation(t: 'green' | 'yellow' | 'red'): string {
  if (t === 'green') return 'Either value is safe to use for reporting.';
  if (t === 'yellow') return 'Prefer physics for final reporting; ML is still useful as a sanity check.';
  return 'Use the physics engine value. The ML surrogate is unreliable for this metric/input.';
}

export default function ComparisonPage() {
  const { result } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const [view, setView] = useState<'cards' | 'table'>('cards');

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">No prediction yet. Enter UAV parameters first.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const byTarget = Object.fromEntries(result.comparison.map((entry) => [entry.target, entry]));

  const chartData = ORDER.map((metric) => {
    const entry = byTarget[metric];
    if (!entry) return null;
    const ci = (result.ml.confidence_intervals as any)[metric];
    const normalizedError = ci?.rmse ? Math.abs(entry.ml_value - entry.physics_value) / ci.rmse : null;
    const t = tier(Math.abs(entry.difference_pct), normalizedError);
    return { name: METRIC_META[metric].label, diff: Number(entry.difference_pct.toFixed(1)), tier: t };
  }).filter(Boolean) as { name: string; diff: number; tier: 'green' | 'yellow' | 'red' }[];

  return (
    <div>
      <div className="eyebrow mb-2">Explainability &middot; Cross-Validation</div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h1 className="font-display text-3xl font-semibold">Physics vs ML — Full Comparison</h1>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setView('cards')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition ${view === 'cards' ? 'bg-cyan text-bg' : 'text-muted hover:text-text'}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Cards
          </button>
          <button
            onClick={() => setView('table')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition border-l border-border ${view === 'table' ? 'bg-cyan text-bg' : 'text-muted hover:text-text'}`}
          >
            <Table2 className="w-3.5 h-3.5" /> Table
          </button>
        </div>
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Every shared output quantity, compared side by side. Physics is the auditable ground truth;
        ML is the fast surrogate. Large gaps flag configurations the model hasn't seen much of.
      </p>

      {/* Difference chart — always visible, single view of disagreement across all metrics */}
      <div className="panel p-5 mb-8">
        <div className="eyebrow mb-4">Percent Difference by Metric (ML vs Physics)</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke={c.axis} fontSize={10} unit="%" />
            <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={10} width={140} />
            <ReferenceLine x={0} stroke={c.axis} />
            <ReferenceLine x={5} stroke={c.green} strokeDasharray="2 2" />
            <ReferenceLine x={-5} stroke={c.green} strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }}
              formatter={(v: any) => [`${v}%`, 'Difference']}
            />
            <Bar dataKey="diff" radius={[0, 4, 4, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.tier === 'green' ? c.green : d.tier === 'yellow' ? c.amber : c.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted mt-2">Dashed lines mark the ±5% "agreement" threshold used for the color coding below.</p>
      </div>

      {view === 'table' ? (
        <div className="panel p-5 overflow-x-auto">
          <table className="w-full text-xs font-mono min-w-[760px]">
            <thead>
              <tr className="text-muted uppercase border-b border-border">
                <th className="text-left py-2 pr-4">Metric</th>
                <th className="text-right py-2 px-3">Physics</th>
                <th className="text-right py-2 px-3">ML</th>
                <th className="text-right py-2 px-3">Difference</th>
                <th className="text-right py-2 px-3">Confidence</th>
                <th className="text-left py-2 pl-3">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {ORDER.map((metric) => {
                const entry = byTarget[metric];
                if (!entry) return null;
                const meta = METRIC_META[metric];
                const ci = (result.ml.confidence_intervals as any)[metric];
                const confidencePct = ci && Math.abs(entry.physics_value) > 1e-6
                  ? Math.max(0, Math.min(100, 100 - (ci.rmse / Math.abs(entry.physics_value)) * 100))
                  : null;
                const normalizedError = ci?.rmse ? Math.abs(entry.ml_value - entry.physics_value) / ci.rmse : null;
                const t = tier(Math.abs(entry.difference_pct), normalizedError);
                const style = TIER_STYLE[t];
                return (
                  <tr key={metric} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-text flex items-center gap-1.5">
                      <style.Icon className={`w-3.5 h-3.5 ${style.text}`} /> {meta.label}
                    </td>
                    <td className="text-right px-3 text-text">{entry.physics_value.toFixed(2)} {meta.unit}</td>
                    <td className="text-right px-3 text-cyan">{entry.ml_value.toFixed(2)} {meta.unit}</td>
                    <td className={`text-right px-3 ${style.text}`}>{entry.difference_pct >= 0 ? '+' : ''}{entry.difference_pct.toFixed(1)}%</td>
                    <td className="text-right px-3 text-muted">{confidencePct !== null ? `${confidencePct.toFixed(0)}%` : '—'}</td>
                    <td className="text-left pl-3 text-muted">{recommendation(t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {ORDER.map((metric, i) => {
            const entry = byTarget[metric];
            if (!entry) return null;
            const meta = METRIC_META[metric];
            const ci = (result.ml.confidence_intervals as any)[metric];
            const confidencePct = ci && Math.abs(entry.physics_value) > 1e-6
              ? Math.max(0, Math.min(100, 100 - (ci.rmse / Math.abs(entry.physics_value)) * 100))
              : null;
            const normalizedError = ci?.rmse ? Math.abs(entry.ml_value - entry.physics_value) / ci.rmse : null;
            const t = tier(Math.abs(entry.difference_pct), normalizedError);
            const style = TIER_STYLE[t];

            return (
              <motion.div
                key={metric}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`panel p-5 border ${style.bg}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="font-display font-semibold text-sm">{meta.label}</div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider ${style.text}`}>
                    <style.Icon className="w-3.5 h-3.5" /> {style.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-sm mb-3 flex-wrap">
                  <div className="px-3 py-1.5 rounded-md border border-border">
                    <div className="text-[10px] text-muted">Physics</div>
                    <div className="text-text">{entry.physics_value.toFixed(2)} {meta.unit}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                  <div className="px-3 py-1.5 rounded-md border border-border">
                    <div className="text-[10px] text-muted">ML</div>
                    <div className="text-cyan">{entry.ml_value.toFixed(2)} {meta.unit}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                  <div className={`px-3 py-1.5 rounded-md border ${style.bg}`}>
                    <div className="text-[10px] text-muted">Difference</div>
                    <div className={style.text}>{entry.difference_pct >= 0 ? '+' : ''}{entry.difference_pct.toFixed(1)}%</div>
                  </div>
                  {confidencePct !== null && (
                    <div className="px-3 py-1.5 rounded-md border border-border">
                      <div className="text-[10px] text-muted">Confidence</div>
                      <div className="text-text">{confidencePct.toFixed(0)}%</div>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted leading-relaxed mb-2">{interpretation(metric, entry.difference_pct, t)}</p>
                {normalizedError !== null && t !== 'green' && (
                  <p className="text-[11px] text-muted mb-2">Absolute gap is {normalizedError.toFixed(2)}x this model's held-out RMSE for this metric.</p>
                )}
                <p className={`text-xs font-mono ${style.text}`}>→ {recommendation(t)}</p>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex gap-4">
        <Link to="/sensitivity" className="text-cyan font-mono text-xs uppercase tracking-wider">Run Sensitivity Analysis →</Link>
        <Link to="/feature-importance" className="text-cyan font-mono text-xs uppercase tracking-wider">View Feature Importance →</Link>
      </div>
    </div>
  );
}
