import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Route, BatteryCharging, Cpu, SlidersHorizontal } from 'lucide-react';

const FLOW = [
  'Enter UAV Parameters',
  'Calculate Endurance',
  'Calculate Range',
  'Compare Physics and ML',
  'Analyze Uncertainty',
];

export default function Home() {
  const features = [
    { icon: BatteryCharging, title: 'Endurance', desc: 'Fuel or electric endurance with an explicit usable-energy reserve.' },
    { icon: Route, title: 'Range', desc: 'Project range convention calculated from cruise speed and endurance.' },
    { icon: Cpu, title: 'Physics + ML', desc: 'Auditable engineering calculations cross-checked against a trained surrogate.' },
    { icon: SlidersHorizontal, title: 'What-if Analysis', desc: 'Explore how fuel, SFC, battery, drag, mass, and efficiency affect results.' },
  ];

  return (
    <div>
      <section className="relative pt-8 pb-16">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <div className="eyebrow mb-4">Physics-Informed ML · UAV Performance</div>
          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl">
            Predict UAV <span className="text-cyan">range and endurance.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-muted text-base sm:text-lg leading-relaxed">
            A focused engineering platform for estimating how long a fixed-wing UAV can remain
            airborne and how far it can travel, using both transparent physics and machine learning.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/input" className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-5 py-3 rounded-md font-semibold">
              Run a Prediction <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/performance" className="inline-flex items-center gap-2 border border-border text-text font-mono text-xs uppercase tracking-wider px-5 py-3 rounded-md">
              Performance Analysis
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
            className="panel p-5"
          >
            <feature.icon className="w-5 h-5 text-cyan mb-3" />
            <div className="font-display font-semibold text-sm mb-1.5">{feature.title}</div>
            <div className="text-xs text-muted leading-relaxed">{feature.desc}</div>
          </motion.div>
        ))}
      </section>

      <section>
        <div className="eyebrow mb-4">Platform Flow</div>
        <div className="flex flex-wrap items-center gap-2">
          {FLOW.map((step, index) => (
            <div key={step} className="flex items-center gap-2">
              <span className="font-mono text-xs px-3 py-1.5 rounded-full border border-border text-muted">{step}</span>
              {index < FLOW.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-border" />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
