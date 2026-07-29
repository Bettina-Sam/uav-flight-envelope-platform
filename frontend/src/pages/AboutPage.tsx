import { motion } from 'framer-motion';

const EQUATIONS = [
  { group: 'Atmosphere', name: 'ISA temperature', eq: 'T(h) = T₀ − Lh' },
  { group: 'Atmosphere', name: 'ISA pressure', eq: 'p(h) = p₀ [T(h)/T₀]^(g₀/RL)' },
  { group: 'Atmosphere', name: 'ISA density', eq: 'ρ(h) = p(h) / [R T(h)]' },
  { group: 'Aerodynamics', name: 'Dynamic pressure', eq: 'q = ½ρV²' },
  { group: 'Aerodynamics', name: 'Required lift coefficient', eq: 'Cᴸ = W / (qS)' },
  { group: 'Aerodynamics', name: 'Aspect ratio (inferred)', eq: 'AR = clamp(0.8 × input L/D, 4, 30)' },
  { group: 'Aerodynamics', name: 'Drag polar', eq: 'Cᴰ = Cᴰ₀ + Cᴸ² / (πeAR),  e = 0.85' },
  { group: 'Aerodynamics', name: 'Lift and drag', eq: 'L = CᴸqS,   D = CᴰqS' },
  { group: 'Aerodynamics', name: 'Stall speed', eq: 'Vstall = √[2W / (ρSCᴸmax)]' },
  { group: 'Propulsion', name: 'Input thrust', eq: 'Tinput = (T/W)mg' },
  { group: 'Propulsion', name: 'Inferred motor power', eq: 'Pmotor = Tinput V / ηprop' },
  { group: 'Propulsion', name: 'Altitude efficiency', eq: 'ηprop(h) = ηstatic(0.4 + 0.6ρ/ρ₀)' },
  { group: 'Performance', name: 'Power required / available', eq: 'Preq = DV,   Pavail = Pmotor ηprop(h)' },
  { group: 'Performance', name: 'Rate of climb', eq: 'ROC = (Pavail − Preq) / W' },
  { group: 'Electric', name: 'Usable battery energy', eq: 'Eb,use = Ebattery × SOC × (1 − 0.20)' },
  { group: 'Electric', name: 'Electric endurance', eq: 'E = Eb,use / [Preq / ηprop(h)]' },
  { group: 'Fuel', name: 'Fuel mass', eq: 'mfuel = Vfuel × 0.8 kg/L' },
  { group: 'Fuel', name: 'Breguet endurance', eq: 'E = [1/(SFC·g₀)] (L/D) ln(mi/mf)' },
  { group: 'Range', name: 'Configured range value', eq: 'Rvalue = Vcruise (m/s) × E (hours)' },
];

const PARAMS = [
  { name: 'Mass / payload', influence: 'Mass sets weight, required lift, induced drag, stall speed, and climb demand. Payload is reported separately but must already be included in total mass.' },
  { name: 'Wing area', influence: 'Controls wing loading and the lift coefficient required at the selected speed.' },
  { name: 'Input L/D', influence: 'Used to infer aspect ratio and Cᴸmax; the displayed operating L/D is recalculated from the drag polar.' },
  { name: 'Cᴰ₀ / cruise speed', influence: 'Set parasite drag and the operating point. True airspeed is held constant through the altitude sweep.' },
  { name: 'T/W / propulsive efficiency', influence: 'Used to infer installed power and its conversion into thrust power at altitude.' },
  { name: 'Fuel capacity / SFC', influence: 'When both are above zero, the Breguet fuel model is active. Fuel density is assumed to be 0.8 kg/L.' },
  { name: 'Battery / SOC', influence: 'When fuel mode is inactive, battery energy × SOC supplies the electric endurance calculation.' },
  { name: 'Air density input', influence: 'Retained as an input/ML feature; the physics altitude sweep itself uses ISA density at each altitude.' },
  { name: 'Propeller diameter / auxiliary power', influence: 'Stored and exposed for design/reporting, but they do not currently alter the core endurance result.' },
];

export default function AboutPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-4xl">
      <div className="eyebrow mb-2">Methodology</div>
      <h1 className="font-display text-3xl font-semibold mb-3">Range, Endurance &amp; Formula Reference</h1>
      <p className="text-sm text-muted leading-relaxed mb-10 max-w-3xl">
        This page documents the equations behind the platform's two headline outputs — range and
        endurance — plus the flight envelope and safety checks built on top of them. The platform
        compares physics and machine-learning estimates side by side. Results are preliminary
        engineering estimates, not certified limits.
      </p>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold mb-3 text-cyan">How the current model works</h2>
        <div className="grid md:grid-cols-3 gap-3 text-xs">
          {[
            ['1 · Translate inputs', 'L/D is used to estimate aspect ratio and Cᴸmax. T/W, mass, speed, and efficiency estimate installed motor power.'],
            ['2 · Evaluate performance', 'The physics engine evaluates lift, drag, power demand, climb capability, and endurance from the configured operating point.'],
            ['3 · Compare and report', 'The same non-altitude outputs are compared with the ML surrogate and included in charts and reports.'],
          ].map(([title, text]) => (
            <div key={title} className="panel p-4">
              <div className="font-mono text-cyan mb-2">{title}</div>
              <p className="text-muted leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold mb-3 text-cyan">Endurance model switch</h2>
        <div className="panel p-5 grid md:grid-cols-2 gap-5 text-sm">
          <div>
            <div className="eyebrow text-amber mb-2">Fuel mode</div>
            <p className="text-muted leading-relaxed">
              Activated only when both fuel capacity and SFC are greater than zero. It uses
              Breguet endurance, 0.8 kg/L fuel density, and a 20% fuel reserve.
            </p>
          </div>
          <div>
            <div className="eyebrow text-cyan mb-2">Electric mode</div>
            <p className="text-muted leading-relaxed">
              Used otherwise. Available energy is battery Wh × state of charge, followed by a
              further 20% reserve. Aerodynamic power is divided by propulsive efficiency.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold mb-3 text-cyan">Inputs and actual influence</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs min-w-[620px]">
            <thead><tr className="text-muted uppercase border-b border-border">
              <th className="text-left py-2.5 px-3">Input</th>
              <th className="text-left py-2.5 px-3">How it affects the current calculation</th>
            </tr></thead>
            <tbody>{PARAMS.map((p) => (
              <tr key={p.name} className="border-b border-border/50">
                <td className="py-2.5 px-3 font-mono text-text whitespace-nowrap">{p.name}</td>
                <td className="py-2.5 px-3 text-muted">{p.influence}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold mb-3 text-cyan">Formula sheet</h2>
        <div className="panel overflow-x-auto">
          <table className="w-full text-xs font-mono min-w-[620px]">
            <thead><tr className="text-muted uppercase border-b border-border">
              <th className="text-left py-2.5 px-3">Group</th><th className="text-left py-2.5 px-3">Quantity</th><th className="text-left py-2.5 px-3">Implemented equation</th>
            </tr></thead>
            <tbody>{EQUATIONS.map((e) => (
              <tr key={`${e.group}-${e.name}`} className="border-b border-border/50">
                <td className="py-2 px-3 text-muted">{e.group}</td>
                <td className="py-2 px-3 text-text">{e.name}</td>
                <td className="py-2 px-3 text-cyan whitespace-nowrap">{e.eq}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-lg font-semibold mb-3 text-amber">Important limitations</h2>
        <div className="panel p-5 text-xs text-muted leading-relaxed">
          <ul className="list-disc list-inside space-y-2">
            <li>No calibration against the guide’s flight-test log has been performed yet.</li>
            <li>Wind and live mission weather are informational and are not fed into endurance.</li>
            <li>Climb, loiter, descent, taxi, reserve policy variations, battery voltage sag, and engine-specific fuel maps are not modeled.</li>
            <li>Propeller efficiency uses a synthetic altitude correction rather than a measured propeller map.</li>
            <li>Auxiliary power and propeller diameter currently do not change the core endurance result.</li>
          </ul>
        </div>
      </section>
    </motion.div>
  );
}
