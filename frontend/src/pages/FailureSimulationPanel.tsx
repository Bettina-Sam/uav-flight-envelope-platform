import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, AlertOctagon, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { simulateFailures } from '../api/client';
import { FailureSimulationResponse } from '../types';
import SafetyBadge from '../components/SafetyBadge';

const STATUS_ICON = { SAFE: CheckCircle2, CAUTION: AlertTriangle, CRITICAL: XCircle } as const;
const STATUS_COLOR = { SAFE: 'text-green', CAUTION: 'text-amber', CRITICAL: 'text-red' } as const;

export default function FailureSimulationPanel() {
  const { input, result: predictResult } = useUAV();
  const [sim, setSim] = useState<FailureSimulationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!predictResult) return;
    setLoading(true);
    simulateFailures(input)
      .then(setSim)
      .catch((e) => setError(e?.message || 'Failure simulation failed.'))
      .finally(() => setLoading(false));
  }, [predictResult, input]);

  if (!predictResult) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">Run a prediction first so there's a baseline configuration to stress-test.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  return (
    <div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Five off-nominal scenarios, each re-evaluated through the physics engine and compared to
        your current baseline: engine failure, battery degradation, a sudden payload increase,
        headwind gusts, and propeller efficiency loss.
      </p>

      {loading ? (
        <div className="panel p-10 flex items-center justify-center gap-2 text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Running scenarios…</div>
      ) : error ? (
        <div className="panel p-4 border-red/30 text-red text-sm">{error}</div>
      ) : sim ? (
        <div className="space-y-4">
          {sim.results.map((r, i) => {
            const Icon = STATUS_ICON[r.new_safety_status as keyof typeof STATUS_ICON] || AlertOctagon;
            const color = STATUS_COLOR[r.new_safety_status as keyof typeof STATUS_COLOR] || 'text-muted';
            return (
              <motion.div key={r.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="panel p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="font-display font-semibold text-sm">{r.label}</div>
                  {r.applicable ? <SafetyBadge status={r.new_safety_status as any} /> : (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted border border-border rounded-full px-3 py-1">N/A</span>
                  )}
                </div>
                <p className="text-xs text-muted mb-3">{r.description}</p>
                {r.applicable && Object.keys(r.deltas).length > 0 && (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-xs font-mono min-w-[420px]">
                      <thead>
                        <tr className="text-muted uppercase border-b border-border">
                          <th className="text-left py-1.5 pr-4">Metric</th>
                          <th className="text-right py-1.5 px-3">Before</th>
                          <th className="text-right py-1.5 px-3">After</th>
                          <th className="text-right py-1.5 pl-3">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(r.deltas).filter(([, d]) => Math.abs(d.delta) > 1e-6).map(([k, d]) => (
                          <tr key={k} className="border-b border-border/40">
                            <td className="py-1.5 pr-4 text-text">{k.replace(/_/g, ' ')}</td>
                            <td className="text-right px-3 text-muted">{d.before.toFixed(2)}</td>
                            <td className="text-right px-3 text-text">{d.after.toFixed(2)}</td>
                            <td className={`text-right pl-3 ${d.delta < 0 ? 'text-red' : 'text-green'}`}>{d.delta_pct >= 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className={`text-xs leading-relaxed flex gap-2 ${color}`}>
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" /> {r.explanation}
                </p>
              </motion.div>
            );
          })}
        </div>
      ) : null}

    </div>
  );
}
