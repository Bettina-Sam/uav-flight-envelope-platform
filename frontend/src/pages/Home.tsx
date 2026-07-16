import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Gauge, Cpu, ShieldAlert, FileDown } from 'lucide-react';

const FLOW = [
  'Enter UAV Parameters', 'Run Physics Engine', 'Run ML Prediction',
  'Flight Envelope', 'Recommended Altitude', 'Safety Check', 'Export Report',
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative pt-6 pb-16 overflow-hidden">
        <motion.div
          aria-hidden
          className="absolute -top-2 right-0 w-20 text-cyan opacity-80 hidden sm:block"
          initial={{ x: 60, y: -10, opacity: 0 }}
          animate={{ x: 0, y: [0, -8, 0], opacity: 0.8 }}
          transition={{ x: { duration: 0.8 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.8 } }}
        >
          <svg viewBox="0 0 120 40" className="w-full h-auto">
            <path d="M4 20 L44 17 L52 4 L58 4 L54 17 L98 17 L112 12 L116 14 L104 20 L116 26 L112 28 L98 23 L54 23 L58 36 L52 36 L44 23 L4 20 Z" fill="currentColor" opacity="0.7" />
          </svg>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="eyebrow mb-4">Physics-Informed ML &middot; Aerospace R&amp;D Prototype</div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-3xl">
            Predicting the flight envelope <span className="text-cyan">before the aircraft leaves the ground.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-muted text-base sm:text-lg leading-relaxed">
            A physics-informed machine learning platform that predicts the feasible altitude band,
            service ceiling, and recommended cruise altitude of a fixed-wing UAV — derived from
            first-principles aerodynamics, cross-checked against an XGBoost surrogate model trained
            on synthetic flight-envelope data.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/input" className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-5 py-3 rounded-md font-semibold hover:opacity-90 transition">
              Run a Prediction <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/about" className="inline-flex items-center gap-2 border border-border text-text font-mono text-xs uppercase tracking-wider px-5 py-3 rounded-md hover:border-cyan/50 transition">
              Methodology
            </Link>
          </div>
        </motion.div>

        <div className="horizon-divider mt-14" />
      </section>

      {/* Signature element: artificial-horizon altitude strip */}
      <motion.section
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
        className="mb-16"
      >
        <svg viewBox="0 0 1000 140" className="w-full h-auto">
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4FD1C5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4FD1C5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="1000" height="70" fill="url(#skyGrad)" />
          <line x1="0" y1="70" x2="1000" y2="70" stroke="#22304A" strokeWidth="1" />
          {Array.from({ length: 21 }, (_, i) => i * 50).map((x, i) => (
            <g key={i}>
              <line x1={x} y1={i % 4 === 0 ? 55 : 62} x2={x} y2={70} stroke="#22304A" strokeWidth="1" />
              {i % 4 === 0 && (
                <text x={x} y="48" textAnchor="middle" className="fill-muted font-mono" fontSize="9">
                  {i * 500}m
                </text>
              )}
            </g>
          ))}
          <motion.path
            d="M 40 70 Q 200 20, 420 55 T 760 40 T 980 60"
            stroke="#F5A623" strokeWidth="2" fill="none" opacity="0.8"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
          <motion.circle
            cx="420" cy="55" r="4" fill="#4FD1C5"
            initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ delay: 1.5, duration: 0.5 }}
          />
          <text x="420" y="90" textAnchor="middle" className="fill-cyan font-mono" fontSize="10">recommended cruise</text>
        </svg>
      </motion.section>

      {/* Feature grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        {[
          { icon: Gauge, title: 'Flight Envelope', desc: 'Min/max altitude, service & absolute ceiling from swept steady-level-flight physics.' },
          { icon: Cpu, title: 'ML Surrogate', desc: 'XGBoost-based multi-output regression trained on 6,000 physics-generated configurations.' },
          { icon: ShieldAlert, title: 'Safety Status', desc: 'Rule-based SAFE / CAUTION / CRITICAL classification with transparent reasoning.' },
          { icon: FileDown, title: 'Exportable Reports', desc: 'One-click PDF and CSV engineering summary for your review or presentation.' },
        ].map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.35 }}
            whileHover={{ y: -4 }}
            className="panel p-5 hover:border-cyan/50 transition-colors"
          >
            <f.icon className="w-5 h-5 text-cyan mb-3" />
            <div className="font-display font-semibold text-sm mb-1.5">{f.title}</div>
            <div className="text-xs text-muted leading-relaxed">{f.desc}</div>
          </motion.div>
        ))}
      </section>

      {/* Flow */}
      <section className="mb-6">
        <div className="eyebrow mb-4">Platform Flow</div>
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((step, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <span className="font-mono text-xs px-3 py-1.5 rounded-full border border-border text-muted hover:border-cyan/50 hover:text-cyan transition">
                {step}
              </span>
              {i < FLOW.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-border" />}
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
