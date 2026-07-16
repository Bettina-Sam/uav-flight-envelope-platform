import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, PlayCircle, Info, ScatterChart as ScatterIcon } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  ScatterChart, Scatter, ReferenceArea,
} from 'recharts';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { runMonteCarloUncertainty, getEpistemicUncertainty, getScatterData, getFeatureImportance } from '../api/client';
import { MonteCarloResponse, EpistemicResponse, ScatterResponse, FeatureImportanceResponse } from '../types';

const TARGET_OPTIONS = [
  { key: 'endurance_hr', label: 'Endurance', unit: 'hr' },
  { key: 'range_km', label: 'Range', unit: 'km' },
  { key: 'recommended_altitude_m', label: 'Recommended Altitude', unit: 'm' },
] as const;

const MODEL_COLORS: Record<string, string> = {
  LinearRegression: '#8A9BB5', RandomForest: '#F5A623', ExtraTrees: '#E07A5F',
  GradientBoosting: '#9B59B6', SVR: '#3D9970', XGBoost: '#4FD1C5', GaussianProcess: '#5B8DEF',
};

function histogramBins(samples: number[], binCount = 24) {
  if (samples.length === 0) return [];
  const min = Math.min(...samples), max = Math.max(...samples);
  const span = max - min || 1;
  const width = span / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width, x1: min + (i + 1) * width, count: 0,
  }));
  for (const s of samples) {
    let idx = Math.floor((s - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return bins.map((b) => ({ label: b.x0.toFixed(1), count: b.count, mid: (b.x0 + b.x1) / 2 }));
}

export default function UncertaintyAnalysisPage() {
  const { input } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);

  const [fiData, setFiData] = useState<FeatureImportanceResponse | null>(null);
  useEffect(() => { getFeatureImportance().then(setFiData).catch(() => setFiData(null)); }, []);

  // --- Scatter (true vs predicted, all models) ---
  const [scatterTarget, setScatterTarget] = useState<typeof TARGET_OPTIONS[number]['key']>('endurance_hr');
  const [scatterData, setScatterData] = useState<ScatterResponse | null>(null);
  const [scatterLoading, setScatterLoading] = useState(true);
  useEffect(() => {
    setScatterLoading(true);
    getScatterData().then(setScatterData).catch(() => setScatterData(null)).finally(() => setScatterLoading(false));
  }, []);

  // --- Aleatoric (Monte Carlo) ---
  const [mcTarget, setMcTarget] = useState<typeof TARGET_OPTIONS[number]['key']>('endurance_hr');
  const [nSamples, setNSamples] = useState(1000);
  const [massStd, setMassStd] = useState(5);
  const [cd0Std, setCd0Std] = useState(8);
  const [batteryStd, setBatteryStd] = useState(6);
  const [propEffStd, setPropEffStd] = useState(5);
  const [mc, setMc] = useState<MonteCarloResponse | null>(null);
  const [mcLoading, setMcLoading] = useState(false);

  const runMC = async () => {
    setMcLoading(true);
    try {
      const res = await runMonteCarloUncertainty(input, nSamples, massStd, cd0Std, batteryStd, propEffStd);
      setMc(res);
    } finally {
      setMcLoading(false);
    }
  };

  // --- Epistemic (cross-model spread) ---
  const [epiTarget, setEpiTarget] = useState<typeof TARGET_OPTIONS[number]['key']>('endurance_hr');
  const [epi, setEpi] = useState<EpistemicResponse | null>(null);
  const [epiLoading, setEpiLoading] = useState(true);
  useEffect(() => {
    setEpiLoading(true);
    getEpistemicUncertainty(input, epiTarget).then(setEpi).catch(() => setEpi(null)).finally(() => setEpiLoading(false));
  }, [input, epiTarget]);

  const mcSummary = mc ? mc[mcTarget] : null;
  const mcUnit = TARGET_OPTIONS.find((t) => t.key === mcTarget)?.unit;
  const histData = useMemo(() => (mcSummary ? histogramBins(mcSummary.samples) : []), [mcSummary]);

  const epiChartData = (epi?.predictions || []).map((p) => ({ name: p.model, value: Number(p.value.toFixed(2)), r2: p.test_r2 }));

  return (
    <div>
      <div className="eyebrow mb-2">Uncertainty Quantification</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Aleatoric &amp; Epistemic Uncertainty</h1>
      <p className="text-muted text-sm mb-4 max-w-3xl">
        Two independent sources of uncertainty, quantified separately: <b className="text-text">aleatoric</b> —
        irreducible real-world variability (manufacturing tolerance, battery cell spread, aerodynamic
        finish) — via Monte Carlo propagation through the physics engine; and <b className="text-text">epistemic</b> —
        uncertainty from limited model knowledge — via cross-model prediction spread across 5
        independently trained algorithms (ensemble disagreement, in the spirit of Lakshminarayanan et al.).
      </p>
      <div className="panel p-4 mb-8 border-cyan/20 bg-cyan/5 flex gap-3 text-xs text-muted">
        <Info className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
        <p>
          This platform benchmarks <b className="text-text">7 regression algorithms</b> (Linear Regression,
          Random Forest, Extra Trees, Gradient Boosting, SVR, Gaussian Process, XGBoost) on the same
          MAE / RMSE / R² metrics, and selects the best by held-out R² — XGBoost, at R² ≈ 0.98 vs.
          Random Forest's ≈ 0.79 and SVR's ≈ 0.79 on this dataset (see table below). The domain here is
          an electric fixed-wing UAV (battery Wh, motor W, propeller efficiency) rather than a
          fuel/turboprop UAS (SFC, thrust) — the closest aleatoric analogs to SFC variability are
          battery capacity spread and propeller efficiency variation, used below.
        </p>
      </div>

      {/* Model benchmark table */}
      <div className="panel p-5 mb-8 overflow-x-auto">
        <div className="eyebrow mb-3">Model Benchmark — MAE / RMSE / R² (averaged across all 12 outputs)</div>
        {fiData ? (
          <table className="w-full text-xs font-mono min-w-[520px]">
            <thead>
              <tr className="text-muted uppercase border-b border-border">
                <th className="text-left py-2 pr-4">Model</th>
                <th className="text-right py-2 px-3">MAE</th>
                <th className="text-right py-2 px-3">RMSE</th>
                <th className="text-right py-2 pl-3">R²</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(fiData.model_comparison)
                .sort((a: any, b: any) => (b[1].avg?.R2 ?? 0) - (a[1].avg?.R2 ?? 0))
                .map(([name, m]: any) => (
                  <tr key={name} className={`border-b border-border/50 ${name === fiData.best_model_name ? 'bg-cyan/5' : ''}`}>
                    <td className="py-2 pr-4 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: MODEL_COLORS[name] || '#8A9BB5' }} />
                      <span className={name === fiData.best_model_name ? 'text-cyan' : 'text-text'}>{name}</span>
                      {name === fiData.best_model_name && <span className="text-[9px] text-cyan uppercase">selected</span>}
                    </td>
                    <td className="text-right px-3 text-muted">{m.avg?.MAE?.toFixed(2)}</td>
                    <td className="text-right px-3 text-muted">{m.avg?.RMSE?.toFixed(2)}</td>
                    <td className="text-right pl-3 text-text">{m.avg?.R2?.toFixed(3)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <div className="flex items-center gap-2 text-muted text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        )}
      </div>

      {/* True vs Predicted scatter, all models */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="eyebrow flex items-center gap-2"><ScatterIcon className="w-4 h-4 text-cyan" /> True vs Predicted — All 7 Models</div>
          <select
            value={scatterTarget}
            onChange={(e) => setScatterTarget(e.target.value as any)}
            className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text"
          >
            {TARGET_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        {scatterLoading ? (
          <div className="panel p-10 flex items-center justify-center gap-2 text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading held-out test predictions…</div>
        ) : scatterData ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(scatterData.data).map(([model, targets]) => {
              const t = targets[scatterTarget];
              if (!t) return null;
              const pts = t.y_true.map((yt, i) => ({ x: yt, y: t.y_pred[i] }));
              const allVals = [...t.y_true, ...t.y_pred];
              const lo = Math.min(...allVals), hi = Math.max(...allVals);
              return (
                <div key={model} className="panel p-3">
                  <div className="text-[10px] font-mono uppercase mb-1.5" style={{ color: MODEL_COLORS[model] || '#8A9BB5' }}>{model}</div>
                  <ResponsiveContainer width="100%" height={140}>
                    <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                      <XAxis type="number" dataKey="x" domain={[lo, hi]} hide />
                      <YAxis type="number" dataKey="y" domain={[lo, hi]} hide />
                      <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 11 }} />
                      <Scatter data={pts} fill={MODEL_COLORS[model] || c.cyan} fillOpacity={0.55} r={2} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel p-6 text-sm text-muted">Scatter data unavailable — retrain with the current train_model.py to enable this.</div>
        )}
        <p className="text-[11px] text-muted mt-2">
          Each panel: held-out test-set true value (x) vs. model prediction (y) for {TARGET_OPTIONS.find(t => t.key === scatterTarget)?.label.toLowerCase()}.
          Points hugging a diagonal indicate accurate predictions — directly comparable to a true-vs-predicted
          scatter plot for a single model, but across all 7 candidates at once.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Aleatoric: Monte Carlo */}
        <div>
          <div className="eyebrow mb-3">Aleatoric Uncertainty — Monte Carlo</div>
          <div className="panel p-4 mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Mass std %', massStd, setMassStd],
                ['CD0 std %', cd0Std, setCd0Std],
                ['Battery std %', batteryStd, setBatteryStd],
                ['Prop-eff std %', propEffStd, setPropEffStd],
              ].map(([label, val, setter]: any) => (
                <div key={label}>
                  <label className="text-[10px] font-mono text-muted block mb-1">{label}</label>
                  <input type="number" value={val} onChange={(e) => setter(Number(e.target.value))}
                    className="w-full bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text" />
                </div>
              ))}
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-mono text-muted block mb-1">Samples</label>
                <input type="number" value={nSamples} onChange={(e) => setNSamples(Number(e.target.value))}
                  className="w-full bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text" />
              </div>
              <select value={mcTarget} onChange={(e) => setMcTarget(e.target.value as any)}
                className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text">
                {TARGET_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={runMC} disabled={mcLoading}
                className="inline-flex items-center gap-1.5 bg-cyan text-bg font-mono text-[11px] uppercase px-3 py-2 rounded-md font-semibold disabled:opacity-50">
                {mcLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />} Run
              </motion.button>
            </div>
          </div>

          {mcSummary && (
            <div className="panel p-4">
              <div className="grid grid-cols-3 gap-2 font-mono text-xs mb-3">
                <div><div className="text-muted">Mean</div><div className="text-cyan">{mcSummary.mean.toFixed(2)} {mcUnit}</div></div>
                <div><div className="text-muted">Std Dev</div><div className="text-text">{mcSummary.std.toFixed(2)}</div></div>
                <div><div className="text-muted">95% CI</div><div className="text-text">[{mcSummary.ci_95_low.toFixed(1)}, {mcSummary.ci_95_high.toFixed(1)}]</div></div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={histData}>
                  <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={c.axis} fontSize={8} interval={3} />
                  <YAxis stroke={c.axis} fontSize={9} />
                  <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 11 }} />
                  <ReferenceLine x={mcSummary.mean.toFixed(1)} stroke={c.amber} strokeDasharray="4 4" />
                  <Bar dataKey="count" fill={c.cyan} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-muted mt-2">
                Distribution of {mc?.n_samples} physics-engine evaluations with normally-perturbed
                mass, CD0, battery capacity, and propeller efficiency — the aleatoric ("real-world
                variability") half of total uncertainty.
              </p>
            </div>
          )}
        </div>

        {/* Epistemic: cross-model spread */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Epistemic Uncertainty — Cross-Model Spread</div>
            <select value={epiTarget} onChange={(e) => setEpiTarget(e.target.value as any)}
              className="bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text">
              {TARGET_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="panel p-4">
            {epiLoading ? (
              <div className="flex items-center gap-2 text-muted text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : epi ? (
              <>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs mb-3">
                  <div><div className="text-muted">Mean prediction</div><div className="text-cyan">{epi.mean.toFixed(2)}</div></div>
                  <div><div className="text-muted">Spread (relative)</div><div className={epi.spread_pct < 10 ? 'text-green' : epi.spread_pct < 25 ? 'text-amber' : 'text-red'}>{epi.spread_pct.toFixed(1)}%</div></div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={epiChartData} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid stroke={c.grid} strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" stroke={c.axis} fontSize={9} />
                    <YAxis type="category" dataKey="name" stroke={c.axis} fontSize={9} width={100} />
                    <ReferenceLine x={epi.mean} stroke={c.amber} strokeDasharray="4 4" />
                    <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 11 }} />
                    <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                      {epiChartData.map((d, i) => <Cell key={i} fill={MODEL_COLORS[d.name] || c.cyan} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-[10px] text-muted mt-2">
                  How much 5 independently-trained models disagree on this exact input. Low spread =
                  well-understood region of the design space; high spread = the surrogate is
                  extrapolating — the epistemic ("model knowledge") half of total uncertainty.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Epistemic ensemble unavailable — retrain to enable.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Link to="/feature-importance" className="text-cyan font-mono text-xs uppercase tracking-wider">View Feature Importance →</Link>
      </div>
    </div>
  );
}
