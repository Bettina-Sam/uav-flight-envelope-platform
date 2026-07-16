import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Wand2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { autoDesign } from '../api/client';
import { AutoDesignResponse, AutoDesignCandidate } from '../types';
import SafetyBadge from '../components/SafetyBadge';

export default function AutoDesignPanel() {
  const { setInput, runPrediction } = useUAV();
  const navigate = useNavigate();

  const [targetEndurance, setTargetEndurance] = useState<string>('4');
  const [useEndurance, setUseEndurance] = useState(true);
  const [targetRange, setTargetRange] = useState<string>('150');
  const [useRange, setUseRange] = useState(true);
  const [payload, setPayload] = useState('3');

  const [result, setResult] = useState<AutoDesignResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!useEndurance && !useRange) {
      setError('Enable at least one target (Endurance or Range).');
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const res = await autoDesign(
        useEndurance ? Number(targetEndurance) : null,
        useRange ? Number(targetRange) : null,
        Number(payload),
        400
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Auto-design search failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdopt = async (candidate: AutoDesignCandidate) => {
    setInput(candidate.input);
    await runPrediction(candidate.input);
    navigate('/physics');
  };

  return (
    <div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Specify what you need — endurance, range, payload — and the search will propose a wing
        area, motor power, battery capacity, mass, and cruise speed that gets close to it. This
        runs a random search + local coordinate-descent refinement directly against the physics
        engine (not a joint global optimizer, and not the ML model) — typically a few hundred fast
        physics evaluations, done server-side in under a second.
      </p>

      <div className="panel p-5 mb-6 grid sm:grid-cols-2 gap-5">
        <div>
          <label className="flex items-center gap-2 text-xs font-mono text-muted mb-2">
            <input type="checkbox" checked={useEndurance} onChange={(e) => setUseEndurance(e.target.checked)} className="accent-cyan" />
            Target Endurance (hr)
          </label>
          <input
            type="number" step="0.1" value={targetEndurance} disabled={!useEndurance}
            onChange={(e) => setTargetEndurance(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm text-text disabled:opacity-40"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-mono text-muted mb-2">
            <input type="checkbox" checked={useRange} onChange={(e) => setUseRange(e.target.checked)} className="accent-cyan" />
            Target Range (km)
          </label>
          <input
            type="number" step="1" value={targetRange} disabled={!useRange}
            onChange={(e) => setTargetRange(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm text-text disabled:opacity-40"
          />
        </div>
        <div>
          <label className="text-xs font-mono text-muted mb-2 block">Payload (kg) — held fixed</label>
          <input
            type="number" step="0.1" value={payload} onChange={(e) => setPayload(e.target.value)}
            className="w-full bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm text-text"
          />
        </div>
        <div className="flex items-end">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleRun} disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-5 py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {loading ? 'Searching…' : 'Run Auto Design'}
          </motion.button>
        </div>
      </div>

      {error && <div className="panel p-4 border-red/30 text-red text-sm mb-6">{error}</div>}

      {result && (
        <>
          <div className="panel p-5 mb-4 border-cyan/30 bg-cyan/5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="eyebrow flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-cyan" /> Best Candidate</div>
              <SafetyBadge status={result.best.safety_status as any} />
            </div>
            <div className="grid sm:grid-cols-3 gap-4 font-mono text-sm mb-4">
              <div><div className="text-[10px] text-muted">Achieved Endurance</div><div className="text-text">{result.best.achieved_endurance_hr.toFixed(2)} hr {result.target_endurance_hr && <span className="text-[10px] text-muted">(target {result.target_endurance_hr})</span>}</div></div>
              <div><div className="text-[10px] text-muted">Achieved Range</div><div className="text-text">{result.best.achieved_range_km.toFixed(1)} km {result.target_range_km && <span className="text-[10px] text-muted">(target {result.target_range_km})</span>}</div></div>
              <div><div className="text-[10px] text-muted">Recommended Altitude</div><div className="text-cyan">{result.best.achieved_recommended_altitude_m.toFixed(0)} m</div></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs mb-4">
              <div><div className="text-muted">Wing Area</div><div className="text-text">{result.best.input.wing_area_m2.toFixed(2)} m²</div></div>
              <div><div className="text-muted">Thrust-to-Weight</div><div className="text-text">{result.best.input.thrust_to_weight.toFixed(3)}</div></div>
              <div><div className="text-muted">Battery</div><div className="text-text">{result.best.input.battery_wh.toFixed(0)} Wh</div></div>
              <div><div className="text-muted">Mass</div><div className="text-text">{result.best.input.mass_kg.toFixed(1)} kg</div></div>
              <div><div className="text-muted">Cruise Speed</div><div className="text-text">{result.best.input.cruise_speed_ms.toFixed(1)} m/s</div></div>
            </div>
            <button
              onClick={() => handleAdopt(result.best)}
              className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-md font-semibold hover:opacity-90 transition"
            >
              Load Into UAV Input &amp; Run Prediction <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <p className="text-[10px] text-muted mt-2">
              {result.iterations_run} physics-engine evaluations · method: {result.method.replace(/_/g, ' ')}
            </p>
          </div>

          {result.alternatives.length > 0 && (
            <div className="grid sm:grid-cols-3 gap-3">
              {result.alternatives.map((alt, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="panel p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-muted">Alternative {i + 1}</span>
                    <SafetyBadge status={alt.safety_status as any} size="sm" />
                  </div>
                  <div className="font-mono text-xs space-y-1 mb-3">
                    <div className="flex justify-between"><span className="text-muted">Endurance</span><span className="text-text">{alt.achieved_endurance_hr.toFixed(2)} hr</span></div>
                    <div className="flex justify-between"><span className="text-muted">Range</span><span className="text-text">{alt.achieved_range_km.toFixed(1)} km</span></div>
                    <div className="flex justify-between"><span className="text-muted">Wing Area</span><span className="text-text">{alt.input.wing_area_m2.toFixed(2)} m²</span></div>
                    <div className="flex justify-between"><span className="text-muted">Battery</span><span className="text-text">{alt.input.battery_wh.toFixed(0)} Wh</span></div>
                  </div>
                  <button onClick={() => handleAdopt(alt)} className="text-cyan font-mono text-[10px] uppercase tracking-wider">Load this →</button>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}
