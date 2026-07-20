import { useEffect, useMemo, useRef, useState } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { playFlightPhaseTone } from '../lib/sound';

interface Props {
  minAltitude: number;
  maxAltitude: number;
  recommendedAltitude: number;
  serviceCeiling: number;
  cruiseSpeedMs: number;
  rateOfClimbMs: number;
  safetyStatus: 'SAFE' | 'CAUTION' | 'CRITICAL';
  numEngines: number;
  silent?: boolean;
}

const W = 760;
const H = 420;
const TRAIL_LEN = 50;

// Flight-path drawing area (separate from the altitude tape on the right)
const PATH_X_START = 60;
const PATH_X_END = 660;
const PATH_Y_TOP = 60;     // screen y for the highest altitude shown on the path
const PATH_Y_BOTTOM = 340; // screen y for minAltitude / ground

// Phase boundaries as a fraction of one full cycle (0..1). Cruise gets the
// largest share of the loop, matching a real mission profile.
const CLIMB_END = 0.30;
const CRUISE_END = 0.72;
// descend runs from CRUISE_END -> 1.0, and altitude(1.0) === altitude(0.0)
// (both are minAltitude), so the loop is continuous in altitude — only the
// horizontal position resets, which is faded out/in (see FADE_ZONE below).

const CYCLE_SECONDS = 12; // total time for one climb → cruise → descend loop
const FADE_ZONE = 0.04;   // fraction of the cycle used to fade the aircraft out/in at the reset point

const STATUS_COLOR: Record<string, string> = { SAFE: '#22C55E', CAUTION: '#F5A623', CRITICAL: '#EF4444' };

/** Smoothstep easing for natural-looking climb/descend transitions. */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/**
 * Altitude as a fraction of min..recommended, for a given point in the cycle
 * (0..1). Climb: min -> recommended (eased). Cruise: holds at recommended
 * (with a very small wave so it doesn't look frozen). Descend: recommended
 * -> min (eased). altitude(0) === altitude(1) === minAltitude, so looping
 * the cycle never produces a vertical jump — only the horizontal position
 * resets (handled by the opacity fade near the loop boundary).
 */
function altitudeFraction(phase: number): number {
  if (phase < CLIMB_END) {
    return smoothstep(phase / CLIMB_END);
  }
  if (phase < CRUISE_END) {
    const cruiseT = (phase - CLIMB_END) / (CRUISE_END - CLIMB_END);
    return 1 + Math.sin(cruiseT * Math.PI * 3) * 0.012; // subtle cruise wobble
  }
  const descendT = (phase - CRUISE_END) / (1 - CRUISE_END);
  return 1 - smoothstep(descendT);
}

function flightPhaseLabel(phase: number): 'CLIMB' | 'CRUISE' | 'DESCEND' {
  if (phase < CLIMB_END) return 'CLIMB';
  if (phase < CRUISE_END) return 'CRUISE';
  return 'DESCEND';
}

/**
 * HUD-style flight profile visualizer showing an explicit climb → cruise →
 * descend mission profile (instead of a continuously circling/orbiting
 * aircraft). The aircraft flies left-to-right across the panel once per
 * cycle: climbing from the operating floor up to the recommended altitude,
 * holding cruise, then descending back down — then fades out/in briefly to
 * reset for the next loop. Built entirely from SVG + Framer Motion — no
 * heavy external 3D library, so there's no dynamic-import chunk to race or
 * fail to load.
 */
export default function FlightProfileVisualizer({
  minAltitude, maxAltitude, recommendedAltitude, serviceCeiling,
  cruiseSpeedMs, rateOfClimbMs, safetyStatus, numEngines, silent = false,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const [, forceRender] = useState(0);
  const frameSkip = useRef(0);
  const lastTonePhase = useRef<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [scrubValue, setScrubValue] = useState(0);

  const domainMax = Math.max(maxAltitude, serviceCeiling, recommendedAltitude, 1) * 1.05;
  const statusColor = STATUS_COLOR[safetyStatus] || '#4FD1C5';

  // Maps a real altitude (m) to the flight-path drawing area's y coordinate.
  const pathYFor = (alt: number) =>
    PATH_Y_BOTTOM - (Math.max(0, Math.min(alt, domainMax)) / domainMax) * (PATH_Y_BOTTOM - PATH_Y_TOP);

  // Precompute a static preview of the whole climb-cruise-descend shape so
  // it can be drawn as a faint reference path behind the animated aircraft.
  const profilePath = useMemo(() => {
    const pts: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const phase = i / 60;
      const alt = minAltitude + altitudeFraction(phase) * (recommendedAltitude - minAltitude);
      const x = PATH_X_START + phase * (PATH_X_END - PATH_X_START);
      const y = pathYFor(alt);
      pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [minAltitude, recommendedAltitude, domainMax]);

  useAnimationFrame((_, delta) => {
    if (paused) return;
    tRef.current = (tRef.current + delta / 1000) % CYCLE_SECONDS;
    frameSkip.current += 1;
    if (frameSkip.current % 2 === 0) {
      const phase = tRef.current / CYCLE_SECONDS;
      setScrubValue(phase);
      const alt = minAltitude + altitudeFraction(phase) * (recommendedAltitude - minAltitude);
      const x = PATH_X_START + phase * (PATH_X_END - PATH_X_START);
      const y = pathYFor(alt);
      trailRef.current = [...trailRef.current, { x, y }].slice(-TRAIL_LEN);
      forceRender((n) => (n + 1) % 100000);
    }
  });

  const phase = tRef.current / CYCLE_SECONDS;
  const currentPhaseLabel = flightPhaseLabel(phase);
  const altNow = minAltitude + altitudeFraction(phase) * (recommendedAltitude - minAltitude);
  const planeX = PATH_X_START + phase * (PATH_X_END - PATH_X_START);
  const planeY = pathYFor(altNow);

  // Pitch angle derived from the actual local slope of the altitude profile
  // (nose up climbing, level at cruise, nose down descending) rather than a
  // banked turn — this aircraft is flying a straight profile, not orbiting.
  const eps = 0.004;
  const altAhead = minAltitude + altitudeFraction(Math.min(1, phase + eps)) * (recommendedAltitude - minAltitude);
  const gradient = (altAhead - altNow) / eps; // altitude change per unit phase
  const pitch = Math.max(-16, Math.min(16, -gradient * 0.00035));

  // Fade the aircraft out just before the loop resets and back in just after,
  // so the horizontal reset (right edge -> left edge) reads as an
  // intentional new pass rather than a jump.
  let opacity = 1;
  if (phase > 1 - FADE_ZONE) opacity = (1 - phase) / FADE_ZONE;
  else if (phase < FADE_ZONE) opacity = phase / FADE_ZONE;

  // Vertical-speed HUD reflects the real predicted climb rate while
  // climbing, an assumed descent rate while descending (the physics engine
  // does not currently model a planned descent profile), and zero at cruise.
  const verticalSpeedDisplay =
    currentPhaseLabel === 'CLIMB' ? rateOfClimbMs :
    currentPhaseLabel === 'DESCEND' ? -Math.abs(rateOfClimbMs) * 0.6 :
    0;

  const trail = trailRef.current;

  // altitude tape geometry (right-hand instrument, unchanged in concept)
  const tapeX = 700, tapeTop = 30, tapeBottom = 390, tapeH = tapeBottom - tapeTop;
  const yFor = (alt: number) => tapeBottom - (Math.max(0, Math.min(alt, domainMax)) / domainMax) * tapeH;
  const currentAltY = yFor(altNow);

  const gridColor = isDark ? '#22304A' : '#CBD5E1';
  const bgColor = isDark ? '#0B1220' : '#F7F9FC';
  const cyan = '#4FD1C5';
  const amber = '#F5A623';

  useEffect(() => {
    if (silent) return;
    if (lastTonePhase.current === currentPhaseLabel) return;
    lastTonePhase.current = currentPhaseLabel;
    playFlightPhaseTone(currentPhaseLabel);
  }, [currentPhaseLabel, silent]);

  const clouds = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({
      cx: (i * 173) % W,
      cy: 40 + ((i * 61) % 140),
      r: 18 + (i % 3) * 10,
      speed: 6 + (i % 4) * 3,
    })),
    []
  );

  const handleScrub = (value: number) => {
    const next = Math.max(0, Math.min(1, value));
    tRef.current = next * CYCLE_SECONDS;
    setScrubValue(next);
    const alt = minAltitude + altitudeFraction(next) * (recommendedAltitude - minAltitude);
    const x = PATH_X_START + next * (PATH_X_END - PATH_X_START);
    const y = pathYFor(alt);
    trailRef.current = [{ x, y }];
    forceRender((n) => (n + 1) % 100000);
  };

  return (
    <div className="w-full rounded-lg overflow-hidden relative" style={{ background: bgColor }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 420 }}>
        <defs>
          <radialGradient id="fpvGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cyan} stopOpacity="0.25" />
            <stop offset="100%" stopColor={cyan} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fpvTapeSafe" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="fpvPlaneBody" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0D9488" />
            <stop offset="55%" stopColor={cyan} />
            <stop offset="100%" stopColor="#A7F3D0" />
          </linearGradient>
          <linearGradient id="fpvWing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#DDFCF7" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.9" />
          </linearGradient>
          <filter id="fpvSoftShadow" x="-40%" y="-60%" width="180%" height="220%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity={isDark ? 0.45 : 0.22} />
          </filter>
        </defs>

        {/* backdrop glow + horizon grid */}
        <circle cx={(PATH_X_START + PATH_X_END) / 2} cy={(PATH_Y_TOP + PATH_Y_BOTTOM) / 2} r={220} fill="url(#fpvGlow)" />
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={0} y1={280 + i * 14} x2={W} y2={280 + i * 14} stroke={gridColor} strokeOpacity={0.15} strokeWidth={1} />
        ))}

        {/* drifting clouds (parallax, purely decorative, independent of flight phase) */}
        {clouds.map((cl, i) => {
          const cx = (cl.cx + (tRef.current * cl.speed * 4)) % (W + 60) - 30;
          return <ellipse key={i} cx={cx} cy={cl.cy} rx={cl.r} ry={cl.r * 0.5} fill="#FFFFFF" opacity={0.06} />;
        })}

        {/* ground line */}
        <line x1={PATH_X_START - 20} y1={PATH_Y_BOTTOM} x2={PATH_X_END + 20} y2={PATH_Y_BOTTOM} stroke={gridColor} strokeWidth={1.5} opacity={0.5} />

        {/* static preview of the full climb-cruise-descend profile */}
        <path d={profilePath} fill="none" stroke={gridColor} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />

        {/* departure / destination markers */}
        <g transform={`translate(${PATH_X_START}, ${PATH_Y_BOTTOM})`}>
          <circle r={3.5} fill={gridColor} />
          <text y={18} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={gridColor}>DEPARTURE</text>
        </g>
        <g transform={`translate(${PATH_X_END}, ${PATH_Y_BOTTOM})`}>
          <circle r={3.5} fill={gridColor} />
          <text y={18} textAnchor="middle" fontSize={8} fontFamily="monospace" fill={gridColor}>DESTINATION</text>
        </g>

        {/* fading trail behind the aircraft */}
        {trail.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={1.6} fill={cyan} opacity={(i / trail.length) * 0.5 * opacity} />
        ))}

        {/* aircraft */}
        <g transform={`translate(${planeX}, ${planeY})`} opacity={opacity}>
          <path d="M-48 0 C-34 -7 -18 -9 -2 -8" fill="none" stroke={statusColor} strokeWidth={3} strokeLinecap="round" opacity={0.22}>
            <animate attributeName="stroke-dasharray" values="2 10;10 4;2 10" dur="1.4s" repeatCount="indefinite" />
          </path>
          <g transform={`rotate(${pitch})`} filter="url(#fpvSoftShadow)">
            <path d="M-38 -4 L8 -4 L31 0 L8 4 L-38 4 L-27 0 Z" fill="url(#fpvPlaneBody)" stroke={cyan} strokeWidth={1} />
            <path d="M-8 -4 L-25 -24 L-13 -24 L14 -4 Z" fill="url(#fpvWing)" stroke={cyan} strokeWidth={0.8} />
            <path d="M-8 4 L-25 24 L-13 24 L14 4 Z" fill="url(#fpvWing)" stroke={cyan} strokeWidth={0.8} opacity={0.82} />
            <path d="M-30 -4 L-43 -15 L-35 -15 L-20 -4 Z" fill="#2DD4BF" opacity={0.8} />
            <path d="M-30 4 L-43 15 L-35 15 L-20 4 Z" fill="#14B8A6" opacity={0.72} />
            <ellipse cx="12" cy="-1.5" rx="5.5" ry="2.2" fill="#E0F2FE" opacity={0.88} />
            <circle cx="31" cy="0" r="2.2" fill="#ECFEFF" />
          </g>
          {/* engine glow, pulses with safety status */}
          <circle cx="-35" cy="0" r={5} fill={statusColor} opacity={0.5}>
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* altitude tape */}
        <g>
          <rect x={tapeX - 8} y={tapeTop} width={16} height={tapeH} rx={8} fill={gridColor} opacity={0.35} />
          <rect
            x={tapeX - 8} y={yFor(serviceCeiling)} width={16} height={Math.max(0, tapeBottom - yFor(serviceCeiling))}
            rx={8} fill="url(#fpvTapeSafe)"
          />
          {[
            { alt: minAltitude, label: 'MIN', color: gridColor },
            { alt: recommendedAltitude, label: 'REC', color: cyan },
            { alt: serviceCeiling, label: 'CEIL', color: amber },
            { alt: maxAltitude, label: 'MAX', color: '#EF4444' },
          ].map((m, i) => (
            <g key={i}>
              <line x1={tapeX - 16} y1={yFor(m.alt)} x2={tapeX + 16} y2={yFor(m.alt)} stroke={m.color} strokeWidth={1.5} />
              <text x={tapeX + 20} y={yFor(m.alt) + 3} fontSize={9} fontFamily="monospace" fill={m.color}>{m.label}</text>
            </g>
          ))}
          {/* current altitude marker */}
          <g transform={`translate(${tapeX}, ${currentAltY})`}>
            <polygon points="-14,0 -22,-6 -22,6" fill={cyan} />
            <circle r={3} fill={cyan} />
          </g>
        </g>

        {/* HUD: flight phase (new — replaces the old orbit heading readout as the primary status) */}
        <g transform="translate(16,16)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>FLIGHT PHASE</text>
          <text y={18} fontSize={16} fontFamily="monospace" fill={cyan} fontWeight="bold">{currentPhaseLabel}</text>
        </g>

        {/* HUD: airspeed */}
        <g transform="translate(16,58)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>AIRSPEED</text>
          <text y={18} fontSize={14} fontFamily="monospace" fill={cyan} fontWeight="bold">{cruiseSpeedMs.toFixed(1)} m/s</text>
        </g>

        {/* HUD: vertical speed */}
        <g transform="translate(16,92)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>VERT SPEED</text>
          <text y={18} fontSize={13} fontFamily="monospace" fill={verticalSpeedDisplay >= 0 ? '#22C55E' : '#EF4444'} fontWeight="bold">
            {verticalSpeedDisplay >= 0 ? '+' : ''}{verticalSpeedDisplay.toFixed(2)} m/s
          </text>
        </g>

        {/* HUD: altitude now */}
        <g transform="translate(16,126)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>ALTITUDE</text>
          <text y={18} fontSize={13} fontFamily="monospace" fill={gridColor}>{Math.round(altNow)} m</text>
        </g>

        {/* HUD: safety status */}
        <g transform={`translate(${W - 130}, ${H - 34})`}>
          <circle r={4} fill={statusColor}>
            <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text x={12} y={4} fontSize={11} fontFamily="monospace" fill={statusColor} fontWeight="bold">{safetyStatus}</text>
        </g>

        {/* HUD: engine count */}
        <text x={16} y={H - 16} fontSize={9} fontFamily="monospace" fill={gridColor}>
          {numEngines}\u00d7 ENGINE{numEngines !== 1 ? 'S' : ''} NOMINAL
        </text>
      </svg>
      <div className="px-4 pb-4 -mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          className="px-3 py-2 rounded-md border border-slate-300/50 text-xs font-mono text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 transition"
        >
          {paused ? 'PLAY' : 'PAUSE'}
        </button>
        <input
          aria-label="Flight replay timeline"
          type="range"
          min={0}
          max={1000}
          value={Math.round(scrubValue * 1000)}
          onChange={(event) => handleScrub(Number(event.target.value) / 1000)}
          onPointerDown={() => setPaused(true)}
          className="flex-1 accent-teal-500"
        />
        <span className="min-w-[72px] text-right text-xs font-mono font-semibold" style={{ color: cyan }}>
          {currentPhaseLabel}
        </span>
      </div>
    </div>
  );
}
