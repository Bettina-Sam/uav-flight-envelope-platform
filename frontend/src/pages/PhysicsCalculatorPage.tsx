import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useUAV } from '../context/UAVContext';
import StatCard from '../components/StatCard';
import SafetyBadge from '../components/SafetyBadge';
import NarrateButton from '../components/NarrateButton';
import { narratePhysics } from '../lib/narrationText';
import type { PhysicsResult } from '../types';

function interpret(p: PhysicsResult) {
  const notes: string[] = [];
  if (p.aspect_ratio < 8) notes.push(`Aspect ratio ${p.aspect_ratio.toFixed(1)} is on the low side for a fixed-wing UAV — expect higher induced drag and reduced glide performance versus a higher-AR design.`);
  else if (p.aspect_ratio > 14) notes.push(`Aspect ratio ${p.aspect_ratio.toFixed(1)} is high — good for endurance/L-over-D, but the longer, more slender wing will be structurally softer and more gust-sensitive.`);
  else notes.push(`Aspect ratio ${p.aspect_ratio.toFixed(1)} sits in a conventional mini-UAV band — a reasonable balance of induced drag and structural stiffness.`);

  if (p.wing_loading_kg_m2 > 25) notes.push(`Wing loading (${p.wing_loading_kg_m2.toFixed(1)} kg/m²) is relatively high, which raises stall speed and reduces low-speed maneuverability.`);
  else notes.push(`Wing loading (${p.wing_loading_kg_m2.toFixed(1)} kg/m²) is moderate-to-low, favoring a lower stall speed and gentler handling.`);

  if (p.l_over_d > 15) notes.push(`L/D of ${p.l_over_d.toFixed(1)} at the recommended altitude is efficient — this is the main driver of the ${p.endurance_hr.toFixed(1)} hr endurance and ${p.range_km.toFixed(0)} km range estimate.`);
  else notes.push(`L/D of ${p.l_over_d.toFixed(1)} is modest; endurance and range are being constrained more by aerodynamic efficiency than by battery capacity alone.`);

  const marginPct = p.power_available_w > 0 ? ((p.power_available_w - p.power_required_w) / p.power_available_w) * 100 : 0;
  notes.push(`Power margin at the recommended altitude is ${marginPct.toFixed(0)}% (${p.power_available_w.toFixed(0)} W available vs ${p.power_required_w.toFixed(0)} W required) — this headroom is what drives the ${p.rate_of_climb_ms.toFixed(1)} m/s climb rate.`);

  return notes;
}

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
  const notes = interpret(p);

  return (
    <div>
      <div className="eyebrow mb-2">Step 2 &middot; Engineering Dashboard</div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">Physics Engine Results</h1>
        <SafetyBadge status={p.safety_status} />
        <div className="ml-auto"><NarrateButton text={narratePhysics(result)} label="Narrate" /></div>
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Computed directly from ISA atmosphere and steady-level-flight equations — no ML involved.
        This is the transparent, auditable ground truth the ML surrogate is trained to approximate.
      </p>

      {/* Input Summary */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel p-5 mb-6">
        <div className="eyebrow mb-3">Input Summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 font-mono text-xs">
          <div><div className="text-muted">Mass</div><div className="text-text text-sm mt-0.5">{result.input.mass_kg} kg</div></div>
          <div><div className="text-muted">Payload</div><div className="text-text text-sm mt-0.5">{result.input.payload_kg} kg</div></div>
          <div><div className="text-muted">Wing Area</div><div className="text-text text-sm mt-0.5">{result.input.wing_area_m2} m²</div></div>
          <div><div className="text-muted">L/D</div><div className="text-text text-sm mt-0.5">{result.input.l_over_d}</div></div>
          <div><div className="text-muted">Cruise Speed</div><div className="text-text text-sm mt-0.5">{result.input.cruise_speed_ms} m/s</div></div>
          <div><div className="text-muted">Thrust-to-Weight</div><div className="text-text text-sm mt-0.5">{result.input.thrust_to_weight}</div></div>
        </div>
      </motion.div>

      {/* Physics Results */}
      <div className="eyebrow mb-3">Physics Results</div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {[
          ['Min Altitude', p.min_altitude_m.toFixed(0), 'm'],
          ['Max Altitude', p.max_altitude_m.toFixed(0), 'm'],
          ['Mean Altitude', p.mean_altitude_m.toFixed(0), 'm'],
          ['Recommended Altitude', p.recommended_altitude_m.toFixed(0), 'm'],
          ['Service Ceiling', p.service_ceiling_m.toFixed(0), 'm'],
          ['Absolute Ceiling', p.absolute_ceiling_m.toFixed(0), 'm'],
          ['Rate of Climb', p.rate_of_climb_ms.toFixed(2), 'm/s'],
          ['Stall Speed', p.stall_speed_ms.toFixed(1), 'm/s'],
          ['Power Required', p.power_required_w.toFixed(0), 'W'],
          ['Power Available', p.power_available_w.toFixed(0), 'W'],
          ['Lift', p.lift_n.toFixed(1), 'N'],
          ['Drag', p.drag_n.toFixed(2), 'N'],
          ['L/D Ratio', p.l_over_d.toFixed(2), ''],
          ['Range', p.range_km.toFixed(1), 'km'],
          ['Endurance', p.endurance_hr.toFixed(2), 'hr'],
          ['Wing Loading', p.wing_loading_kg_m2.toFixed(1), 'kg/m²'],
        ].map(([label, value, unit], i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}>
            <StatCard label={label as string} value={value as string} unit={unit as string} accent={label === 'Recommended Altitude' ? 'cyan' : label === 'L/D Ratio' ? 'green' : 'text'} />
          </motion.div>
        ))}
      </div>

      {/* Engineering interpretation */}
      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-3">Engineering Interpretation</div>
        <ul className="space-y-2.5">
          {notes.map((n, i) => (
            <li key={i} className="text-sm text-text leading-relaxed flex gap-2">
              <span className="text-cyan shrink-0">▸</span>{n}
            </li>
          ))}
        </ul>
      </div>

      {/* Why this altitude */}
      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-2">Why This Altitude Was Recommended</div>
        <p className="text-sm text-text leading-relaxed">{p.recommended_reason}</p>
      </div>

      {/* Safety assessment */}
      <div className="panel p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="eyebrow">Safety Assessment</div>
          <SafetyBadge status={p.safety_status} size="sm" />
        </div>
        {p.warnings.length === 0 ? (
          <p className="text-sm text-muted">No warnings raised for this configuration.</p>
        ) : (
          <ul className="space-y-2">
            {p.warnings.map((w, i) => (
              <li key={i} className="text-sm text-muted flex gap-2">
                <span className="text-amber">▲</span>{w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <Link to="/ml" className="text-cyan font-mono text-xs uppercase tracking-wider">
          View ML Prediction →
        </Link>
      </div>
    </div>
  );
}
