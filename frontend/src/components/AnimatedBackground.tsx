import { useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * Fixed, full-viewport decorative background: animated gradient sky, drifting
 * particles with faint connecting lines, a dual radar sweep, a moving scan
 * beam, a grid horizon, and a UAV silhouette that crosses the screen on a
 * loop. Purely decorative (aria-hidden, pointer-events disabled) and
 * respects prefers-reduced-motion via the global CSS rule in index.css,
 * which collapses all animation durations to ~0.
 */
export default function AnimatedBackground() {
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 14,
        duration: 14 + Math.random() * 16,
        size: 1 + Math.random() * 2.4,
      })),
    []
  );

  // A handful of static faint "constellation" links between fixed points,
  // purely decorative, evoking a sensor/telemetry network.
  const links = useMemo(
    () =>
      Array.from({ length: 7 }, () => ({
        x1: Math.random() * 100, y1: Math.random() * 60,
        x2: Math.random() * 100, y2: Math.random() * 60,
      })),
    []
  );

  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* animated gradient sky */}
      <div className="absolute inset-0 bg-sky-anim" />

      {/* faint telemetry constellation lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.35]" preserveAspectRatio="none">
        {links.map((l, i) => (
          <line
            key={i}
            x1={`${l.x1}%`} y1={`${l.y1}%`} x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke="rgb(var(--color-cyan) / 0.18)" strokeWidth="1"
          />
        ))}
      </svg>

      {/* horizon grid */}
      <div className="absolute inset-x-0 bottom-0 h-[55%] grid-horizon" />

      {/* vertical scan beam, sweeps left to right slowly */}
      <div className="absolute inset-y-0 w-40 scan-beam" />

      {/* dual radar sweeps, anchored top-right and bottom-left */}
      <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full radar-sweep opacity-[0.5]" />
      <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] rounded-full radar-sweep-reverse opacity-[0.3]" />

      {/* drifting particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute rounded-full bg-cyan/40 particle-drift"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* UAV silhouette flying across */}
      <motion.svg
        viewBox="0 0 120 40"
        className="absolute w-24 h-auto opacity-70 text-cyan"
        style={{ top: '18%' }}
        initial={{ x: '-10vw' }}
        animate={{ x: '110vw', y: [0, -14, 0, 10, 0] }}
        transition={{
          x: { duration: 38, repeat: Infinity, ease: 'linear', delay: 2 },
          y: { duration: 9, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <path
          d="M4 20 L44 17 L52 4 L58 4 L54 17 L98 17 L112 12 L116 14 L104 20 L116 26 L112 28 L98 23 L54 23 L58 36 L52 36 L44 23 L4 20 Z"
          fill="currentColor"
          opacity="0.55"
        />
      </motion.svg>

      {/* second, smaller UAV silhouette on a slower, offset loop */}
      <motion.svg
        viewBox="0 0 120 40"
        className="absolute w-14 h-auto opacity-40 text-amber"
        style={{ top: '58%' }}
        initial={{ x: '120vw' }}
        animate={{ x: '-15vw', y: [0, 8, 0, -6, 0] }}
        transition={{
          x: { duration: 52, repeat: Infinity, ease: 'linear', delay: 8 },
          y: { duration: 11, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        <path
          d="M4 20 L44 17 L52 4 L58 4 L54 17 L98 17 L112 12 L116 14 L104 20 L116 26 L112 28 L98 23 L54 23 L58 36 L52 36 L44 23 L4 20 Z"
          fill="currentColor"
          opacity="0.5"
          transform="scale(-1,1) translate(-120,0)"
        />
      </motion.svg>

      {/* soft vignette so foreground text stays legible */}
      <div className="absolute inset-0 bg-vignette" />
    </div>
  );
}
