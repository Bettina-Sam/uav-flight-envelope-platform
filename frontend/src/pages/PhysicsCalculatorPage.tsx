import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUAV } from '../context/UAVContext';
import StatCard from '../components/StatCard';
import { formatDurationHHMM } from '../lib/duration';
import NarrateButton from '../components/NarrateButton';
import { narratePhysics } from '../lib/narrationText';

export default function PhysicsCalculatorPage() {
  const { result } = useUAV();

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">No prediction yet. Enter UAV parameters first.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const p = result.physics;
  const usesFuel = result.input.fuel_capacity_l > 0 && result.input.sfc_kg_per_n_s > 0;

  return (
    <div>
      <div className="eyebrow mb-2">Step 2 · Physics</div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">Range &amp; Endurance Results</h1>
        <div className="ml-auto"><NarrateButton text={narratePhysics(result)} label="Narrate" /></div>
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Transparent performance estimates calculated from the entered aircraft, propulsion,
        fuel, and battery parameters without using the ML surrogate.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <StatCard label="Endurance" value={formatDurationHHMM(p.endurance_hr)} unit="HH:MM" accent="cyan" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <StatCard label="Range Value" value={p.range_km.toFixed(2)} unit="speed × hours" accent="green" />
        </motion.div>
      </div>

      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-3">Calculation Basis</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-sm">
          <div><div className="text-muted text-xs">Energy Model</div><div className="text-text mt-1">{usesFuel ? 'Breguet Fuel' : 'Electric Battery'}</div></div>
          <div><div className="text-muted text-xs">Cruise Speed</div><div className="text-text mt-1">{result.input.cruise_speed_ms} m/s</div></div>
          <div><div className="text-muted text-xs">Lift / Drag</div><div className="text-text mt-1">{p.l_over_d.toFixed(2)}</div></div>
          <div><div className="text-muted text-xs">Drag</div><div className="text-text mt-1">{p.drag_n.toFixed(2)} N</div></div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="panel p-5">
          <div className="eyebrow mb-3">Endurance Formula</div>
          <p className="text-sm text-muted leading-relaxed">
            {usesFuel
              ? 'Fuel endurance uses the Breguet weight-ratio relation with fuel density 0.8 kg/L and a 20% reserve.'
              : 'Electric endurance divides usable battery energy by the required electrical power with a 20% reserve.'}
          </p>
        </div>
        <div className="panel p-5">
          <div className="eyebrow mb-3">Range Convention</div>
          <p className="text-sm text-muted leading-relaxed">
            Range value = cruise speed in m/s × endurance in decimal hours, following the direct convention selected for this project.
          </p>
        </div>
      </div>

      <Link to="/ml" className="text-cyan font-mono text-xs uppercase tracking-wider">
        View ML Prediction →
      </Link>
    </div>
  );
}
