import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { explainPrediction } from '../api/client';
import type { LocalExplanationResponse } from '../types';
import StatCard from '../components/StatCard';
import { formatDurationHHMM } from '../lib/duration';

const TARGETS = [
  { key: 'range_km', label: 'Range' },
  { key: 'endurance_hr', label: 'Endurance' },
] as const;

export default function MLPredictionPage() {
  const { result, input } = useUAV();
  const [target, setTarget] = useState<(typeof TARGETS)[number]['key']>('range_km');
  const [explanation, setExplanation] = useState<LocalExplanationResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!result) return;
    setLoading(true);
    explainPrediction(input, target)
      .then(setExplanation)
      .catch(() => setExplanation(null))
      .finally(() => setLoading(false));
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
  const physics = result.physics;
  const rangeDifference = physics.range_km
    ? ((ml.range_km - physics.range_km) / Math.abs(physics.range_km)) * 100
    : 0;
  const enduranceDifference = physics.endurance_hr
    ? ((ml.endurance_hr - physics.endurance_hr) / Math.abs(physics.endurance_hr)) * 100
    : 0;

  return (
    <div>
      <div className="eyebrow mb-2">Step 3 · Machine Learning</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Range &amp; Endurance ML Prediction</h1>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        The trained surrogate predicts the same two mission outputs for a fast cross-check against
        the physics calculation.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <StatCard label="ML Endurance" value={formatDurationHHMM(ml.endurance_hr)} unit="HH:MM" accent="cyan" />
        <StatCard label="ML Range Value" value={ml.range_km.toFixed(2)} unit="speed × hours" accent="green" />
      </div>

      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-3">Physics vs ML</div>
        <div className="grid sm:grid-cols-2 gap-4 font-mono text-sm">
          <div className="border border-border rounded-md p-4">
            <div className="text-muted text-xs mb-1">Endurance Difference</div>
            <div className="text-cyan">{enduranceDifference >= 0 ? '+' : ''}{enduranceDifference.toFixed(1)}%</div>
          </div>
          <div className="border border-border rounded-md p-4">
            <div className="text-muted text-xs mb-1">Range Difference</div>
            <div className="text-cyan">{rangeDifference >= 0 ? '+' : ''}{rangeDifference.toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <div className="panel p-5 mb-8">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="eyebrow">Prediction Drivers</div>
          <select
            value={target}
            onChange={(event) => setTarget(event.target.value as typeof target)}
            className="bg-bg border border-border rounded-md px-3 py-2 font-mono text-xs text-text"
          >
            {TARGETS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Computing explanation…</div>
        ) : explanation ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {explanation.contributions.slice(0, 8).map((item) => (
              <div key={item.feature} className="border border-border rounded-md p-3">
                <div className="text-[10px] text-muted">{item.feature.replace(/_/g, ' ')}</div>
                <div className="font-mono text-sm text-cyan mt-1">{item.contribution.toFixed(2)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">Explanation unavailable.</p>
        )}
      </div>

      <Link to="/comparison" className="text-cyan font-mono text-xs uppercase tracking-wider">
        Compare Physics and ML →
      </Link>
    </div>
  );
}
