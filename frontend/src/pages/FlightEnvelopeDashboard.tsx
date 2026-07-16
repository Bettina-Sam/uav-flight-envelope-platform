import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, ReferenceLine,
} from 'recharts';
import { Award } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { playSafetyTone } from '../lib/sound';
import { getDesignScore } from '../api/client';
import { DesignScoreResponse } from '../types';
import AltitudeGauge from '../components/AltitudeGauge';
import SafetyBadge from '../components/SafetyBadge';
import StatCard from '../components/StatCard';
import EngineOutPanel from '../components/EngineOutPanel';
import ErrorBoundary from '../components/ErrorBoundary';
import FlightProfileVisualizer from '../components/FlightProfileVisualizer';

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
};

const GRADE_COLOR: Record<string, string> = { A: '#22C55E', B: '#4FD1C5', C: '#F5A623', D: '#F5A623', F: '#EF4444' };

export default function FlightEnvelopeDashboard() {
  const { input, result } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const lastAnnounced = useRef<string | null>(null);
  const [score, setScore] = useState<DesignScoreResponse | null>(null);

  useEffect(() => {
    if (result && lastAnnounced.current !== result.physics.safety_status) {
      playSafetyTone(result.physics.safety_status as any);
      lastAnnounced.current = result.physics.safety_status;
    }
  }, [result]);

  useEffect(() => {
    if (!result) return;
    getDesignScore(input).then(setScore).catch(() => setScore(null));
  }, [result, input]);

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">No prediction yet. Enter UAV parameters first.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const { physics, ml, comparison } = result;

  const envelopeData = physics.envelope_profile.map((p) => ({
    altitude: Math.round(p.altitude_m),
    roc: Number(p.rate_of_climb_ms.toFixed(3)),
    p_req: Math.round(p.power_required_w),
    p_avail: Math.round(p.power_available_w),
    l_over_d: Number(p.l_over_d.toFixed(2)),
    feasible: p.feasible ? 1 : 0,
  }));

  const comparisonData = comparison
    .filter((c) => !['lift_n', 'drag_n'].includes(c.target))
    .map((c) => ({
      name: c.target.replace(/_/g, ' ').replace(' m', '').replace(' ms', ''),
      Physics: Number(c.physics_value.toFixed(2)),
      ML: Number(c.ml_value.toFixed(2)),
    }));

  return (
    <div>
      <div className="eyebrow mb-2">Step 4</div>
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">Flight Envelope Dashboard</h1>
        <SafetyBadge status={physics.safety_status} size="lg" />
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Full altitude sweep of steady-level-flight performance, with the physics engine and ML
        surrogate shown side by side.
      </p>

      <motion.div {...fadeUp} transition={{ duration: 0.35 }} className="grid lg:grid-cols-3 gap-4 mb-8">
        <div className="panel p-5 flex flex-col items-center justify-center">
          <AltitudeGauge
            min={physics.min_altitude_m}
            max={physics.max_altitude_m}
            recommended={physics.recommended_altitude_m}
            serviceCeiling={physics.service_ceiling_m}
            label="Recommended Altitude (Physics)"
          />
        </div>
        <div className="panel p-5 flex flex-col items-center justify-center">
          <AltitudeGauge
            min={ml.min_altitude_m}
            max={ml.max_altitude_m}
            recommended={ml.recommended_altitude_m}
            serviceCeiling={ml.service_ceiling_m}
            label="Recommended Altitude (ML)"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Service Ceiling" value={physics.service_ceiling_m.toFixed(0)} unit="m" />
          <StatCard label="Absolute Ceiling" value={physics.absolute_ceiling_m.toFixed(0)} unit="m" />
          <StatCard label="Mean Altitude" value={physics.mean_altitude_m.toFixed(0)} unit="m" sub="midpoint, informational" />
          <StatCard label="Endurance" value={physics.endurance_hr.toFixed(2)} unit="hr" />
          <StatCard label="Range" value={physics.range_km.toFixed(1)} unit="km" />
          <StatCard label="L/D @ Recommended" value={physics.l_over_d.toFixed(2)} accent="green" />
        </div>
      </motion.div>

      {score && (
        <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.03 }} className="panel p-5 mb-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-display text-2xl font-bold text-bg"
              style={{ background: GRADE_COLOR[score.grade] || '#4FD1C5' }}
            >
              {score.grade}
            </div>
            <div>
              <div className="eyebrow">Design Score</div>
              <div className="font-mono text-2xl text-text">{score.total.toFixed(0)}<span className="text-sm text-muted">/100</span></div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-[280px]">
            {Object.entries(score.breakdown).map(([k, v]) => (
              <div key={k}>
                <div className="text-[10px] font-mono text-muted uppercase">{k.replace(/_/g, ' ')}</div>
                <div className="font-mono text-sm text-text">{v.points.toFixed(0)}/{v.max}</div>
                <div className="text-[10px] text-muted">{v.detail}</div>
              </div>
            ))}
          </div>
          <Link to="/report" className="text-cyan font-mono text-[11px] uppercase tracking-wider shrink-0">Full report →</Link>
        </motion.div>
      )}

      <motion.div {...fadeUp} transition={{ duration: 0.35, delay: 0.05 }} className="panel p-5 mb-6">
        <div className="eyebrow mb-4">Flight Profile Visualizer</div>
        <ErrorBoundary fallbackTitle="Flight profile visualization failed to load.">
          <FlightProfileVisualizer
            minAltitude={physics.min_altitude_m}
            maxAltitude={physics.max_altitude_m}
            recommendedAltitude={physics.recommended_altitude_m}
            serviceCeiling={physics.service_ceiling_m}
            cruiseSpeedMs={result.input.cruise_speed_ms}
            rateOfClimbMs={physics.rate_of_climb_ms}
            safetyStatus={physics.safety_status as any}
            numEngines={1}
          />
        </ErrorBoundary>
        <p className="text-[11px] text-muted mt-3">
          Live HUD-style readout: airspeed, heading, vertical speed, and safety status, with the
          aircraft flying a banked patrol circuit against the altitude tape on the right.
        </p>
      </motion.div>

      <div className="mb-8">
        <EngineOutPanel engineOut={physics.engine_out} numEngines={1} />
      </div>

      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-4">Rate of Climb &amp; Power vs Altitude</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={envelopeData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis dataKey="altitude" stroke={c.axis} fontSize={11} tickFormatter={(v) => `${v}`} />
            <YAxis stroke={c.axis} fontSize={11} />
            <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, fontSize: 12, color: c.tooltipText }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={Math.round(physics.recommended_altitude_m)} stroke={c.cyan} strokeDasharray="4 4" label={{ value: 'Recommended', fill: c.cyan, fontSize: 10 }} />
            <ReferenceLine x={Math.round(physics.service_ceiling_m)} stroke={c.amber} strokeDasharray="4 4" label={{ value: 'Service Ceiling', fill: c.amber, fontSize: 10 }} />
            <Line type="monotone" dataKey="roc" name="Rate of Climb (m/s)" stroke={c.cyan} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="p_req" name="Power Required (W)" stroke={c.amber} dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="p_avail" name="Power Available (W)" stroke={c.green} dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="panel p-5">
        <div className="eyebrow mb-4">Physics vs ML — Side-by-Side Comparison</div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={comparisonData} margin={{ left: 0, right: 10, top: 5, bottom: 40 }}>
            <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
            <XAxis dataKey="name" stroke={c.axis} fontSize={9} angle={-35} textAnchor="end" interval={0} />
            <YAxis stroke={c.axis} fontSize={11} />
            <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, fontSize: 12, color: c.tooltipText }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Physics" fill={c.cyan} radius={[3, 3, 0, 0]} />
            <Bar dataKey="ML" fill={c.amber} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[11px] text-muted mt-3">
          Note: percentage differences look large on quantities whose physics value is small
          (e.g. recommended altitude at low-altitude optima) — always read the absolute values
          above alongside the % difference on the Report page.
        </p>
      </div>

      <div className="mt-8 flex gap-4 flex-wrap">
        <Link to="/comparison" className="text-cyan font-mono text-xs uppercase tracking-wider">
          Full Physics vs ML Comparison →
        </Link>
        <Link to="/feature-importance" className="text-cyan font-mono text-xs uppercase tracking-wider">
          View Feature Importance →
        </Link>
        <Link to="/sensitivity" className="text-cyan font-mono text-xs uppercase tracking-wider">
          Run Sensitivity Analysis →
        </Link>
      </div>
    </div>
  );
}
