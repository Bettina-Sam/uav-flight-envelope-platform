import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, PlayCircle, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { runSensitivity, runSensitivity2D } from '../api/client';
import { SensitivityPoint, Sensitivity2DPoint, UAVInput } from '../types';
import SensitivityHeatmap from '../components/SensitivityHeatmap';

const PARAMS: { key: keyof UAVInput; label: string; min: number; max: number }[] = [
  { key: 'mass_kg', label: 'Mass (kg)', min: 7, max: 3000 },
  { key: 'payload_kg', label: 'Payload (kg)', min: 0, max: 500 },
  { key: 'wing_area_m2', label: 'Wing Area (m²)', min: 0.3, max: 25 },
  { key: 'l_over_d', label: 'L/D Ratio', min: 5, max: 30 },
  { key: 'cd0', label: 'CD0', min: 0.006, max: 0.08 },
  { key: 'cruise_speed_ms', label: 'Cruise Speed (m/s)', min: 8, max: 70 },
  { key: 'thrust_to_weight', label: 'Thrust-to-Weight', min: 0.01, max: 0.5 },
  { key: 'propulsion_efficiency', label: 'Propulsion Efficiency', min: 0.3, max: 0.95 },
  { key: 'battery_wh', label: 'Battery Capacity (Wh)', min: 100, max: 150000 },
  { key: 'fuel_capacity_l', label: 'Fuel Capacity (L)', min: 0, max: 5000 },
  { key: 'air_density_kg_m3', label: 'Air Density (kg/m³)', min: 0.2, max: 1.3 },
  { key: 'sfc_kg_per_n_s', label: 'SFC (kg/N·s)', min: 0.0, max: 0.00002 },
  { key: 'aux_power_w', label: 'Aux Power (W)', min: 0, max: 2000 },
];

// Aspect ratio is a derived quantity (wingspan^2 / wing_area) -- exposed here
// as a convenience sweep over wingspan at fixed wing area (see note below).
const UNMODELED = ['Temperature', 'Pressure Altitude', 'Wind Speed', 'Wind Direction'];

const RESPONSE_OPTIONS: { key: 'Recommended Altitude (m)' | 'Max Altitude (m)' | 'Rate of Climb (m/s)' | 'Endurance (hr)' | 'Range (km)' | 'L/D Ratio'; }[] = [
  { key: 'Recommended Altitude (m)' }, { key: 'Max Altitude (m)' }, { key: 'Rate of Climb (m/s)' },
  { key: 'Endurance (hr)' }, { key: 'Range (km)' }, { key: 'L/D Ratio' },
];

const PAIR_PRESETS: { label: string; x: keyof UAVInput; y: keyof UAVInput; target: string }[] = [
  { label: 'Mass vs Thrust-to-Weight → Altitude', x: 'mass_kg', y: 'thrust_to_weight', target: 'recommended_altitude_m' },
  { label: 'Wing Area vs Cruise Speed → Altitude', x: 'wing_area_m2', y: 'cruise_speed_ms', target: 'recommended_altitude_m' },
  { label: 'Battery Capacity vs Payload → Endurance', x: 'battery_wh', y: 'payload_kg', target: 'endurance_hr' },
  { label: 'L/D vs CD0 → L/D Ratio', x: 'l_over_d', y: 'cd0', target: 'l_over_d' },
  { label: 'Propulsion Efficiency vs Thrust-to-Weight → Range', x: 'propulsion_efficiency', y: 'thrust_to_weight', target: 'range_km' },
  { label: 'Mass vs Battery Capacity → Range', x: 'mass_kg', y: 'battery_wh', target: 'range_km' },
  { label: 'Wing Area vs Payload → Endurance', x: 'wing_area_m2', y: 'payload_kg', target: 'endurance_hr' },
];

PAIR_PRESETS.push(
  { label: 'Fuel Capacity vs Cruise Speed -> Range', x: 'fuel_capacity_l', y: 'cruise_speed_ms', target: 'range_km' },
  { label: 'SFC vs Thrust-to-Weight -> Endurance', x: 'sfc_kg_per_n_s', y: 'thrust_to_weight', target: 'endurance_hr' },
  { label: 'Payload vs Fuel Capacity -> Endurance', x: 'payload_kg', y: 'fuel_capacity_l', target: 'endurance_hr' },
);

export default function SensitivityAnalysisPage() {
  const { input, result } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);
  const [param, setParam] = useState<keyof UAVInput>('mass_kg');
  const [data, setData] = useState<SensitivityPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState(0);
  const [grid2d, setGrid2d] = useState<Sensitivity2DPoint[] | null>(null);
  const [loading2d, setLoading2d] = useState(false);

  const paramCfg = PARAMS.find((p) => p.key === param)!;

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const points = await runSensitivity(input, param, paramCfg.min, paramCfg.max, 18);
      setData(points);
    } catch (e: any) {
      setError(e?.message || 'Sensitivity sweep failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRun2D = async () => {
    const p = PAIR_PRESETS[preset];
    const xCfg = PARAMS.find((pp) => pp.key === p.x)!;
    const yCfg = PARAMS.find((pp) => pp.key === p.y)!;
    setLoading2d(true);
    try {
      const pts = await runSensitivity2D(input, p.x, xCfg.min, xCfg.max, p.y, yCfg.min, yCfg.max, p.target, 8);
      setGrid2d(pts);
    } catch {
      setGrid2d(null);
    } finally {
      setLoading2d(false);
    }
  };

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">Run a prediction first so we have a baseline configuration to sweep from.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const chartData = (data || []).map((p) => ({
    value: Number(p.parameter_value.toFixed(2)),
    'Recommended Altitude (m)': Math.round(p.recommended_altitude_m),
    'Max Altitude (m)': Math.round(p.max_altitude_m),
    'Rate of Climb (m/s)': Number(p.rate_of_climb_ms.toFixed(2)),
    'Endurance (hr)': Number(p.endurance_hr.toFixed(2)),
    'Range (km)': Number(p.range_km.toFixed(1)),
    'L/D Ratio': Number(p.l_over_d.toFixed(2)),
    'Power Required (W)': Math.round(p.power_required_w),
  }));

  const preset2d = PAIR_PRESETS[preset];
  const xCfg2d = PARAMS.find((p) => p.key === preset2d.x)!;
  const yCfg2d = PARAMS.find((p) => p.key === preset2d.y)!;

  return (
    <div>
      <div className="eyebrow mb-2">Step 6 &middot; What-If Simulation</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Sensitivity Analysis</h1>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Sweep one or two design parameters while holding all others fixed at your current UAV
        configuration, and see how the flight envelope, range, and endurance respond.
      </p>

      {/* Single-parameter sweep */}
      <div className="panel p-5 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="eyebrow block mb-2">Parameter to sweep</label>
          <select
            value={param}
            onChange={(e) => { setParam(e.target.value as keyof UAVInput); setData(null); }}
            className="bg-bg border border-border rounded-md px-3 py-2.5 font-mono text-sm text-text"
          >
            {PARAMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <div className="text-xs text-muted font-mono">
          Range: {paramCfg.min} – {paramCfg.max}
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {loading ? 'Sweeping…' : 'Run Sweep'}
        </motion.button>
      </div>

      {error && <div className="panel p-4 border-red/30 text-red text-sm mb-6">{error}</div>}

      {chartData.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-4 mb-10">
          <div className="panel p-5">
            <div className="eyebrow mb-4">Altitude Response</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                <XAxis dataKey="value" stroke={c.axis} fontSize={10} label={{ value: paramCfg.label, position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
                <YAxis stroke={c.axis} fontSize={10} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Recommended Altitude (m)" stroke={c.cyan} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Max Altitude (m)" stroke={c.amber} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-5">
            <div className="eyebrow mb-4">Climb &amp; Endurance Response</div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                <XAxis dataKey="value" stroke={c.axis} fontSize={10} label={{ value: paramCfg.label, position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
                <YAxis stroke={c.axis} fontSize={10} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Rate of Climb (m/s)" stroke={c.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Endurance (hr)" stroke={c.axis} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-5">
            <div className="eyebrow mb-4">Range Response</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                <XAxis dataKey="value" stroke={c.axis} fontSize={10} label={{ value: paramCfg.label, position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
                <YAxis stroke={c.axis} fontSize={10} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Line type="monotone" dataKey="Range (km)" stroke={c.cyan} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-5">
            <div className="eyebrow mb-4">Efficiency &amp; Power Response</div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                <XAxis dataKey="value" stroke={c.axis} fontSize={10} label={{ value: paramCfg.label, position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
                <YAxis stroke={c.axis} fontSize={10} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="L/D Ratio" stroke={c.green} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Power Required (W)" stroke={c.amber} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Multi-parameter 2D sensitivity */}
      <div className="eyebrow mb-3">Multi-Parameter Sensitivity (2D Grid)</div>
      <div className="panel p-5 mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="eyebrow block mb-2">Parameter pair</label>
          <select
            value={preset}
            onChange={(e) => { setPreset(Number(e.target.value)); setGrid2d(null); }}
            className="bg-bg border border-border rounded-md px-3 py-2.5 font-mono text-sm text-text"
          >
            {PAIR_PRESETS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
          </select>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleRun2D}
          disabled={loading2d}
          className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-5 py-2.5 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {loading2d ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {loading2d ? 'Computing grid…' : 'Run 2D Sweep'}
        </motion.button>
      </div>

      {grid2d && grid2d.length > 0 && (
        <div className="panel p-5 mb-10">
          <div className="eyebrow mb-4">{preset2d.label}</div>
          <SensitivityHeatmap
            points={grid2d}
            xLabel={xCfg2d.label}
            yLabel={yCfg2d.label}
            valueLabel={preset2d.target.replace(/_/g, ' ')}
          />
          <p className="text-[11px] text-muted mt-3">
            Physics-engine grid sweep of {preset2d.target.replace(/_/g, ' ')} over {xCfg2d.label} × {yCfg2d.label}.
            Cell color = predicted value, corner dot = safety status at that combination.
          </p>
        </div>
      )}

      <div className="panel p-4 flex gap-3 text-xs text-muted border-amber/20 bg-amber/5">
        <Info className="w-4 h-4 text-amber shrink-0 mt-0.5" />
        <div>
          <strong className="text-text">Not modeled yet:</strong> {UNMODELED.join(', ')}. The physics
          engine currently assumes a fixed ISA atmosphere column and a fixed design cruise speed — it
          doesn't yet take live atmospheric conditions or wind as inputs. See the platform roadmap
          (Mission Planner / Live Weather phase) for real atmospheric integration.
        </div>
      </div>
    </div>
  );
}
