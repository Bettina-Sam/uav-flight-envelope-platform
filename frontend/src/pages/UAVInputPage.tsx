import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Send, Ruler, Wind, Zap, Weight, BatteryCharging, Link2 } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { UAVInput } from '../types';
import { getTrainingBounds } from '../api/client';
import { decodeConfig, buildShareableUrl } from '../lib/shareLink';
import { REFERENCE_PRESETS, ReferencePreset } from '../lib/referenceAircraft';
import TrainingRangeBadge, { classifyRange } from '../components/TrainingRangeBadge';

interface FieldDef {
  key: keyof UAVInput;
  label: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  help: string;
}

interface Section {
  title: string;
  icon: any;
  fields: FieldDef[];
}

const SECTIONS: Section[] = [
  {
    title: 'Aircraft',
    icon: Ruler,
    fields: [
      { key: 'aircraft_name', label: 'Aircraft Name', unit: '', step: 1, min: 0, max: 0, help: 'Free-form aircraft identifier (for reports)' } as any,
      { key: 'mass_kg', label: 'Aircraft Weight', unit: 'kg', step: 0.5, min: 7, max: 3000, help: 'Total mass (empty + payload)' },
      { key: 'payload_kg', label: 'Payload Weight', unit: 'kg', step: 0.1, min: 0, max: 500, help: 'Payload mass' },
      { key: 'wing_area_m2', label: 'Wing Area', unit: 'm²', step: 0.01, min: 0.3, max: 25, help: 'Planform reference area S' },
    ],
  },
  {
    title: 'Aerodynamics',
    icon: Wind,
    fields: [
      { key: 'l_over_d', label: 'Lift-to-Drag Ratio', unit: '-', step: 0.1, min: 5, max: 30, help: 'Overall L/D at cruise' } as any,
      { key: 'cd0', label: 'Drag Coefficient', unit: 'Cd0', step: 0.001, min: 0.006, max: 0.08, help: 'Parasite drag coefficient' },
      { key: 'cruise_speed_ms', label: 'Cruise Airspeed', unit: 'm/s', step: 0.5, min: 8, max: 70, help: 'Design cruise true airspeed' },
      { key: 'air_density_kg_m3', label: 'Air Density', unit: 'kg/m³', step: 0.001, min: 0.2, max: 1.3, help: 'Ambient air density (override ISA if set)' },
    ],
  },
  {
    title: 'Propulsion',
    icon: Zap,
    fields: [
      { key: 'sfc_kg_per_n_s', label: 'Specific Fuel Consumption', unit: 'kg/(N·s)', step: 0.000001, min: 0.0, max: 0.00002, help: 'SFC for fuel-powered estimates' } as any,
      { key: 'thrust_to_weight', label: 'Thrust-to-Weight Ratio', unit: '-', step: 0.01, min: 0.01, max: 0.5, help: 'Design thrust-to-weight ratio' },
      { key: 'propulsion_efficiency', label: 'Propulsion Efficiency', unit: 'η', step: 0.01, min: 0.3, max: 0.95, help: 'Propulsive efficiency' },
      { key: 'fuel_capacity_l', label: 'Fuel Capacity', unit: 'L', step: 1, min: 0, max: 5000, help: 'Fuel tank volume (liters)' },
      { key: 'propeller_diameter_m', label: 'Propeller Diameter', unit: 'm', step: 0.01, min: 0.1, max: 5.0, help: 'Propeller diameter' },
    ],
  },
  {
    title: 'Electrical',
    icon: BatteryCharging,
    fields: [
      { key: 'battery_wh', label: 'Battery Capacity', unit: 'Wh', step: 1, min: 100, max: 150000, help: 'Battery energy (Wh)' },
      { key: 'battery_soc', label: 'Battery State of Charge', unit: '%', step: 0.01, min: 0.0, max: 1.0, help: 'Battery state of charge (0-1)' },
      { key: 'aux_power_w', label: 'Auxiliary Power Consumption', unit: 'W', step: 1, min: 0, max: 2000, help: 'Avionics/payload power draw' },
    ],
  },
];

export default function UAVInputPage() {
  const { input, setInput, runPrediction, loading, error } = useUAV();
  const [local, setLocal] = useState<UAVInput>(input);
  const [bounds, setBounds] = useState<Record<string, [number, number]> | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadedFromLink, setLoadedFromLink] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    getTrainingBounds().then((r) => setBounds(r.bounds)).catch(() => setBounds(null));
  }, []);

  // Shareable-link support: if the URL carries ?config=<encoded>, decode it
  // and pre-fill the form once on load, then clean the URL.
  useEffect(() => {
    const encoded = searchParams.get('config');
    if (!encoded) return;
    const decoded = decodeConfig(encoded);
    if (decoded) {
      setLocal(decoded);
      setLoadedFromLink(true);
    }
    searchParams.delete('config');
    setSearchParams(searchParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(buildShareableUrl(local));
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1800);
  };

  const [activePreset, setActivePreset] = useState<ReferencePreset | null>(null);
  const handleLoadPreset = (preset: ReferencePreset) => {
    setLocal(preset.input);
    setActivePreset(preset.key === 'default' ? null : preset);
  };

  const aspectRatio = Math.max(4.0, Math.min(30.0, 0.8 * (local as any).l_over_d));
  const wingLoading = local.mass_kg / local.wing_area_m2;
  const thrustN = (local as any).thrust_to_weight * local.mass_kg * 9.80665;
  const totalPower = thrustN * (local as any).cruise_speed_ms / Math.max((local as any).propulsion_efficiency, 1e-3);
  const powerLoading = totalPower / local.mass_kg;
  const estimatedMTOW = local.mass_kg;

  const overallStatus = useMemo(() => {
    if (!bounds) return null;
    // Only numeric fields are checked against training bounds. Exclude aircraft_name.
    const numericFields = SECTIONS.flatMap((s) => s.fields).filter((f) => f.key !== 'aircraft_name');
    const values: [keyof UAVInput, number][] = numericFields.map((f) => [f.key, Number(local[f.key])]);
    const statuses = values.map(([k, v]) => classifyRange(v, bounds[k as string]));
    if (statuses.includes('outside')) return 'outside';
    if (statuses.includes('near')) return 'near';
    return 'within';
  }, [local, bounds]);

  const handleChange = (key: keyof UAVInput, value: number) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setInput(local);
    const res = await runPrediction(local);
    if (res) navigate('/dashboard');
  };

  return (
    <div className="max-w-5xl">
      <div className="eyebrow mb-2">Step 1</div>
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <h1 className="font-display text-3xl font-semibold">UAV Design Parameters</h1>
        {overallStatus && <TrainingRangeBadge status={overallStatus as any} />}
        <button
          onClick={handleCopyLink}
          className="ml-auto inline-flex items-center gap-1.5 border border-border text-muted hover:text-cyan hover:border-cyan/50 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-md transition"
        >
          <Link2 className="w-3.5 h-3.5" /> {linkCopied ? 'Link copied!' : 'Copy Shareable Link'}
        </button>
      </div>
      {loadedFromLink && (
        <div className="rounded-md border border-cyan/30 bg-cyan/5 text-cyan text-xs px-4 py-2.5 mb-4">
          Loaded a shared configuration from a link. Review the values below, then run the prediction.
        </div>
      )}

      {/* Reference aircraft presets */}
      <div className="panel p-4 mb-6">
        <div className="eyebrow mb-2">Reference Configurations</div>
        <div className="flex flex-wrap gap-2 mb-2">
          {REFERENCE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => handleLoadPreset(p)}
              className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
                (activePreset?.key ?? 'default') === p.key ? 'bg-cyan text-bg border-cyan' : 'border-border text-muted hover:text-text hover:border-cyan/50'
              }`}
              title={p.shortDesc}
            >
              {p.label}
            </button>
          ))}
        </div>
        {activePreset?.provenance && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-3 overflow-hidden">
            <p className="text-xs text-muted mb-3">{activePreset.shortDesc}</p>
            <div className="grid sm:grid-cols-2 gap-2 mb-3">
              {activePreset.provenance.map((p, idx) => (
                <div key={`${p.field}-${idx}`} className="text-[11px] border border-border rounded-md px-2.5 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="font-mono text-text">{String(p.field).replace(/_/g, ' ')}</span>
                    <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full ${
                      p.source === 'table' ? 'bg-green/15 text-green' : p.source === 'derived' ? 'bg-cyan/15 text-cyan' : 'bg-amber/15 text-amber'
                    }`}>{p.source}</span>
                  </div>
                  <p className="text-muted leading-relaxed">{p.note}</p>
                </div>
              ))}
            </div>
            {activePreset.caveat && (
              <div className="rounded-md border border-amber/30 bg-amber/5 text-amber text-[11px] px-3 py-2.5 leading-relaxed">
                {activePreset.caveat}
              </div>
            )}
          </motion.div>
        )}
      </div>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Enter the design parameters of your fixed-wing electric UAV, grouped by engineering
        discipline. These feed both the physics engine and the ML surrogate model identically, so
        their outputs are directly comparable. Each field is checked against the ML model's
        training sampling distribution.
      </p>


      <form onSubmit={handleSubmit} className="space-y-6">
        {SECTIONS.map((section, si) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: si * 0.05, duration: 0.3 }}
            className="panel p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <section.icon className="w-4 h-4 text-cyan" />
              <div className="eyebrow">{section.title}</div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {section.fields.map((f) => {
                const status = bounds ? (f.key === 'aircraft_name' ? null : classifyRange(Number(local[f.key]), bounds[f.key as string])) : null;
                return (
                  <div key={f.key}>
                    <label htmlFor={f.key} className="flex justify-between text-xs font-mono text-muted mb-2">
                      <span>{f.label}</span>
                      <span className="text-cyan">{f.unit}</span>
                    </label>
                    {f.key === 'aircraft_name' ? (
                      <input
                        id={String(f.key)}
                        type="text"
                        value={local.aircraft_name}
                        onChange={(e) => setLocal((prev) => ({ ...prev, aircraft_name: e.target.value }))}
                        className="w-full bg-bg border border-border rounded-md px-3 py-2 font-sans text-sm text-text focus:border-cyan outline-none"
                      />
                    ) : (
                      <input
                        id={String(f.key)}
                        type="number"
                        step={f.step}
                        min={f.min}
                        max={f.max}
                        value={local[f.key]}
                        onChange={(e) => handleChange(f.key, parseFloat(e.target.value))}
                        className="w-full bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm text-text focus:border-cyan outline-none"
                        required
                      />
                    )}
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-[11px] text-muted">{f.help}</p>
                      {status && <TrainingRangeBadge status={status} />}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* derived values preview */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="panel p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          <div>
            <div className="eyebrow">Aspect Ratio</div>
            <div className="font-mono text-lg text-text mt-1">{aspectRatio.toFixed(2)}</div>
          </div>
          <div>
            <div className="eyebrow">Wing Loading</div>
            <div className="font-mono text-lg text-text mt-1">{wingLoading.toFixed(1)} kg/m²</div>
          </div>
          <div>
            <div className="eyebrow">Total Power (est.)</div>
            <div className="font-mono text-lg text-cyan mt-1">{totalPower.toFixed(0)} W</div>
          </div>
          <div>
            <div className="eyebrow">Power Loading</div>
            <div className="font-mono text-lg text-text mt-1">{powerLoading.toFixed(1)} W/kg</div>
          </div>
          <div>
            <div className="eyebrow">Est. MTOW</div>
            <div className="font-mono text-lg text-text mt-1">{estimatedMTOW.toFixed(1)} kg</div>
          </div>
          <div>
            <div className="eyebrow">Battery Energy (usable)</div>
            <div className="font-mono text-lg text-text mt-1">{(local.battery_wh * (local.battery_soc ?? 1.0)).toFixed(0)} Wh</div>
          </div>
        </motion.div>

        {error && (
          <div className="rounded-md border border-red/30 bg-red/10 text-red text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-6 py-3 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {loading ? 'Running Physics + ML…' : 'Run Physics Engine & ML Prediction'}
          </motion.button>
        </div>
      </form>
    </div>
  );
}
