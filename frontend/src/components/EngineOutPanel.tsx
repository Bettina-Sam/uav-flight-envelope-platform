import { ShieldCheck, ShieldAlert, PlaneTakeoff } from 'lucide-react';
import { EngineOutInfo } from '../types';

export default function EngineOutPanel({ engineOut, numEngines }: { engineOut: EngineOutInfo; numEngines: number }) {
  if (!engineOut.applicable) {
    return (
      <div className="panel p-5">
        <div className="eyebrow mb-2">Engine-Out Safety Analysis</div>
        <p className="text-sm text-muted">
          Not applicable — this configuration has {numEngines} engine{numEngines !== 1 ? 's' : ''} (no
          redundant engine to lose). Set Number of Engines to 2 on the UAV Input page to evaluate the
          twin-engine, engine-out contingency case.
        </p>
      </div>
    );
  }

  const ok = engineOut.can_maintain_min_altitude;

  return (
    <div className={`panel p-5 border ${ok ? 'border-green/30' : 'border-amber/30'}`}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="eyebrow">Engine-Out Safety Analysis (Twin-Engine)</div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider px-3 py-1 text-xs ${
          ok ? 'bg-green/10 border-green/30 text-green' : 'bg-amber/10 border-amber/30 text-amber'
        }`}>
          {ok ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
          {ok ? 'Can maintain flight' : 'Cannot maintain floor altitude'}
        </span>
      </div>
      <p className="text-sm text-text mb-4">
        With 1 of {numEngines} engines inoperative ({(engineOut.power_loss_fraction * 100).toFixed(0)}% power
        loss), this is the standard multi-engine contingency check every twin-engine aircraft is assessed
        against.
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <div className="eyebrow">Single-Engine Service Ceiling</div>
          <div className="font-mono text-xl text-cyan mt-1">{engineOut.single_engine_service_ceiling_m.toFixed(0)} m</div>
        </div>
        <div>
          <div className="eyebrow">ROC at Floor (1 engine out)</div>
          <div className="font-mono text-xl text-text mt-1">{engineOut.single_engine_roc_at_min_alt_ms.toFixed(2)} m/s</div>
        </div>
        <div className="flex items-center gap-2 text-muted">
          <PlaneTakeoff className="w-4 h-4" />
          <span className="text-xs">{engineOut.engines_operating} of {numEngines} engines operating in this scenario</span>
        </div>
      </div>
    </div>
  );
}
