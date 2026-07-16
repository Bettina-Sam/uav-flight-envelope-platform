import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2 } from 'lucide-react';
import { getFeatureImportance, explainPrediction } from '../api/client';
import { FeatureImportanceResponse, LocalExplanationResponse } from '../types';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { useUAV } from '../context/UAVContext';

const TARGET_OPTIONS = [
  { key: 'recommended_altitude_m', label: 'Recommended Altitude' },
  { key: 'range_km', label: 'Range' },
  { key: 'endurance_hr', label: 'Endurance' },
  { key: 'rate_of_climb_ms', label: 'Rate of Climb' },
  { key: 'l_over_d', label: 'L/D Ratio' },
  { key: 'power_required_w', label: 'Power Required' },
];

function LocalExplanationSection() {
  const { input, result } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const [target, setTarget] = useState('recommended_altitude_m');
  const [explanation, setExplanation] = useState<LocalExplanationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!result) return;
    setLoading(true);
    explainPrediction(input, target).then(setExplanation).catch(() => setExplanation(null)).finally(() => setLoading(false));
  }, [result, input, target]);

  if (!result) {
    return (
      <div className="panel p-6 mb-8 text-center">
        <p className="text-muted text-sm mb-3">Run a prediction to see a local (per-prediction) explanation here.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  // Build waterfall: start at dataset mean prediction, add each contribution
  // in descending magnitude, ending at the final prediction.
  const contribs = explanation ? [...explanation.contributions].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10) : [];
  let running = explanation?.dataset_mean_prediction ?? 0;
  const waterfallData = contribs.map((fc) => {
    const start = running;
    running += fc.contribution;
    return {
      name: fc.feature.replace(/_/g, ' '),
      base: Math.min(start, running),
      delta: Math.abs(fc.contribution),
      positive: fc.contribution >= 0,
    };
  });

  const maxAbs = Math.max(1, ...contribs.map((fc) => Math.abs(fc.contribution)));

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
        <div className="eyebrow">Local Explanation — Why This Prediction?</div>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text"
        >
          {TARGET_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>

      {loading || !explanation ? (
        <div className="panel p-8 flex items-center justify-center gap-2 text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Computing local attribution…
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Waterfall */}
          <div className="panel p-5">
            <div className="eyebrow mb-4">Waterfall — Feature-by-Feature Build-up</div>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={waterfallData} layout="vertical" margin={{ left: 40 }} barCategoryGap={6}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke={c.axis} fontSize={10} />
                <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={9} width={110} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="delta" stackId="wf" radius={[0, 3, 3, 0]}>
                  {waterfallData.map((d, i) => <Cell key={i} fill={d.positive ? c.cyan : c.red} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted mt-2">
              Starts at the training-set average prediction ({explanation.dataset_mean_prediction.toFixed(1)}) and
              walks feature-by-feature to this configuration's prediction ({explanation.baseline_prediction.toFixed(1)}).
            </p>
          </div>

          {/* Force-plot style summary */}
          <div className="panel p-5">
            <div className="eyebrow mb-4">Force Plot — Push Toward / Away</div>
            <div className="flex justify-between font-mono text-xs text-muted mb-2">
              <span>Dataset avg: {explanation.dataset_mean_prediction.toFixed(1)}</span>
              <span className="text-cyan">This prediction: {explanation.baseline_prediction.toFixed(1)}</span>
            </div>
            <div className="flex w-full h-8 rounded-md overflow-hidden border border-border mb-4">
              {contribs.map((fc, i) => (
                <div
                  key={i}
                  title={`${fc.feature}: ${fc.contribution >= 0 ? '+' : ''}${fc.contribution.toFixed(2)}`}
                  style={{
                    width: `${(Math.abs(fc.contribution) / (contribs.reduce((s, x) => s + Math.abs(x.contribution), 0) || 1)) * 100}%`,
                    background: fc.contribution >= 0 ? c.cyan : c.red,
                  }}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {contribs.slice(0, 6).map((fc, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted">{fc.feature.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${(Math.abs(fc.contribution) / maxAbs) * 100}%`, background: fc.contribution >= 0 ? c.cyan : c.red }}
                      />
                    </div>
                    <span className={fc.contribution >= 0 ? 'text-cyan' : 'text-red'}>
                      {fc.contribution >= 0 ? '+' : ''}{fc.contribution.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-4">
              Cyan segments push the prediction above the training average; red segments pull it below.
              Method: {explanation.method.replace(/_/g, ' ')}.
            </p>
          </div>
        </div>
      )}

      <div className="panel p-5 mt-4">
        <div className="eyebrow mb-2">Engineering Interpretation</div>
        {explanation && contribs.length > 0 && (
          <p className="text-sm text-text leading-relaxed">
            The single largest driver of this {TARGET_OPTIONS.find(t => t.key === target)?.label.toLowerCase()} prediction is{' '}
            <span className="text-cyan">{contribs[0].feature.replace(/_/g, ' ')}</span>
            {' '}(current value {contribs[0].value.toFixed(2)} vs training average {contribs[0].training_mean.toFixed(2)}), which{' '}
            {contribs[0].direction === 'increases' ? 'pushes the prediction up' : contribs[0].direction === 'decreases' ? 'pulls the prediction down' : 'has negligible effect'}.
            {contribs.length > 1 && (
              <> The next most influential factor is <span className="text-cyan">{contribs[1].feature.replace(/_/g, ' ')}</span>.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function FeatureImportancePage() {
  const [data, setData] = useState<FeatureImportanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const COLORS = [c.cyan, c.amber, c.green, c.red, c.muted];

  useEffect(() => {
    getFeatureImportance().then(setData).catch((e) => setError(e.message || 'Failed to load'));
  }, []);

  if (error) {
    return <div className="panel p-6 text-red text-sm">{error} — is the backend running?</div>;
  }
  if (!data) {
    return <div className="flex items-center gap-2 text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading model insights…</div>;
  }

  const permData = Object.entries(data.permutation_importance)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Number(value.toFixed(4)) }));

  const nativeData = Object.entries(data.native_feature_importance)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value: Number(value.toFixed(4)) }));

  const modelRows = Object.entries(data.model_comparison).sort((a, b) => b[1].avg.R2 - a[1].avg.R2);

  return (
    <div>
      <div className="eyebrow mb-2">Step 5 &middot; Explainable AI</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Feature Importance &amp; Model Comparison</h1>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Best model: <span className="text-cyan font-mono">{data.best_model_name}</span> ·
        Safety classifier accuracy: <span className="text-cyan font-mono">{(data.safety_classifier_accuracy * 100).toFixed(1)}%</span>
      </p>

      <LocalExplanationSection />

      <div className="grid lg:grid-cols-2 gap-4 mb-8">
        <div className="panel p-5">
          <div className="eyebrow mb-4">Global Feature Importance — Permutation (model-agnostic)</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={permData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={c.axis} fontSize={10} />
              <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={10} width={110} />
              <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {permData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted mt-2">
            Measures the drop in R² when each feature is randomly shuffled — the standard,
            model-agnostic importance metric.
          </p>
        </div>

        <div className="panel p-5">
          <div className="eyebrow mb-4">Native Feature Importance ({data.best_model_name})</div>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={nativeData} layout="vertical" margin={{ left: 40 }}>
              <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke={c.axis} fontSize={10} />
              <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={10} width={110} />
              <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
              <Bar dataKey="value" fill={c.amber} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[11px] text-muted mt-2">
            Gain-based importance internal to the tree ensemble — how much each feature reduces
            training loss when used for a split.
          </p>
        </div>
      </div>

      <div className="panel p-5 overflow-x-auto">
        <div className="eyebrow mb-4">Model Comparison (test set, averaged across 12 targets)</div>
        <table className="w-full text-sm font-mono min-w-[560px]">
          <thead>
            <tr className="text-muted text-xs uppercase border-b border-border">
              <th className="text-left py-2 pr-4">Model</th>
              <th className="text-right py-2 px-3">R²</th>
              <th className="text-right py-2 px-3">MAE</th>
              <th className="text-right py-2 px-3">RMSE</th>
              <th className="text-right py-2 px-3">MAPE %</th>
              <th className="text-right py-2 pl-3">Train Time</th>
            </tr>
          </thead>
          <tbody>
            {modelRows.map(([name, m]) => (
              <tr key={name} className={`border-b border-border/50 ${name === data.best_model_name ? 'text-cyan' : 'text-text'}`}>
                <td className="py-2 pr-4">{name}{name === data.best_model_name && ' ★'}</td>
                <td className="text-right px-3">{m.avg.R2.toFixed(4)}</td>
                <td className="text-right px-3">{m.avg.MAE.toFixed(2)}</td>
                <td className="text-right px-3">{m.avg.RMSE.toFixed(2)}</td>
                <td className="text-right px-3">{m.avg.MAPE.toFixed(2)}</td>
                <td className="text-right pl-3">{m.train_seconds}s{m.note ? ' *' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-muted mt-3">* Gaussian Process trained on a subsample for computational tractability (O(n³) exact-inference cost).</p>
      </div>
    </div>
  );
}
