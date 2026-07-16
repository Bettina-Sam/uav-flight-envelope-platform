import { useMemo, useRef, useState } from 'react';
import { useAnimationFrame } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

interface Props {
  minAltitude: number;
  maxAltitude: number;
  recommendedAltitude: number;
  serviceCeiling: number;
  cruiseSpeedMs: number;
  rateOfClimbMs: number;
  safetyStatus: 'SAFE' | 'CAUTION' | 'CRITICAL';
  numEngines: number;
}

const W = 760;
const H = 420;
const CX = 300;
const CY = 210;
const RX = 190;
const RY = 78;
const TRAIL_LEN = 40;

const STATUS_COLOR: Record<string, string> = { SAFE: '#22C55E', CAUTION: '#F5A623', CRITICAL: '#EF4444' };

const PLANE_PATH =
  'M4 12 L26 10 L31 2 L35 2 L32 10 L59 10 L67 7 L69 8 L62 12 L69 16 L67 17 L59 14 L32 14 L35 22 L31 22 L26 14 L4 12 Z';

/**
 * Advanced HUD-style flight profile visualizer: an animated banked orbit
 * with a fading trail, a live altitude tape with min/recommended/ceiling
 * bands, a rotating heading ring, airspeed and vertical-speed readouts, and
 * a pulsing safety-status indicator. Built entirely from SVG + Framer
 * Motion — no heavy external 3D library, so there's no dynamic-import
 * chunk to race or fail to load.
 */
export default function FlightProfileVisualizer({
  minAltitude, maxAltitude, recommendedAltitude, serviceCeiling,
  cruiseSpeedMs, rateOfClimbMs, safetyStatus, numEngines,
}: Props) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const angleRef = useRef(0);
  const trailRef = useRef<{ x: number; y: number; op: number }[]>([]);
  const [, forceRender] = useState(0);
  const frameSkip = useRef(0);

  const domainMax = Math.max(maxAltitude, serviceCeiling, recommendedAltitude, 1) * 1.05;
  const statusColor = STATUS_COLOR[safetyStatus] || '#4FD1C5';

  useAnimationFrame((_, delta) => {
    const angularSpeed = 0.55; // rad/s
    angleRef.current += angularSpeed * (delta / 1000);
    frameSkip.current += 1;
    if (frameSkip.current % 2 === 0) {
      const angle = angleRef.current;
      const x = CX + RX * Math.cos(angle);
      const y = CY + RY * Math.sin(angle);
      trailRef.current = [...trailRef.current, { x, y, op: 1 }].slice(-TRAIL_LEN);
      forceRender((n) => (n + 1) % 100000);
    }
  });

  const angle = angleRef.current;
  const planeX = CX + RX * Math.cos(angle);
  const planeY = CY + RY * Math.sin(angle);
  // pseudo-3D: bank harder and scale smaller on the "far" side of the ellipse
  const depthT = (Math.sin(angle) + 1) / 2; // 0 = near/front, 1 = far/back
  const scale = 1.15 - depthT * 0.4;
  const bank = Math.cos(angle) * 32; // degrees
  const heading = (angle * 180) / Math.PI + 90;

  const trail = trailRef.current;

  // altitude tape geometry
  const tapeX = 700, tapeTop = 30, tapeBottom = 390, tapeH = tapeBottom - tapeTop;
  const yFor = (alt: number) => tapeBottom - (Math.max(0, Math.min(alt, domainMax)) / domainMax) * tapeH;
  const climbAmplitude = Math.min(30, Math.abs(rateOfClimbMs) * 6 + 4);
  const climbOffset = Math.sin(angle * 0.6) * climbAmplitude;
  const currentAltY = yFor(recommendedAltitude) - climbOffset;

  const gridColor = isDark ? '#22304A' : '#CBD5E1';
  const bgColor = isDark ? '#0B1220' : '#F7F9FC';
  const cyan = '#4FD1C5';
  const amber = '#F5A623';

  const clouds = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({
      cx: (i * 173) % W,
      cy: 40 + ((i * 61) % 140),
      r: 18 + (i % 3) * 10,
      speed: 6 + (i % 4) * 3,
    })),
    []
  );

  return (
    <div className="w-full rounded-lg overflow-hidden relative" style={{ background: bgColor, height: 420 }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full">
        <defs>
          <radialGradient id="fpvGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cyan} stopOpacity="0.25" />
            <stop offset="100%" stopColor={cyan} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fpvTapeSafe" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#22C55E" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#22C55E" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* backdrop glow + horizon grid */}
        <circle cx={CX} cy={CY} r={220} fill="url(#fpvGlow)" />
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={0} y1={280 + i * 14} x2={W} y2={280 + i * 14} stroke={gridColor} strokeOpacity={0.15} strokeWidth={1} />
        ))}

        {/* drifting clouds (parallax) */}
        {clouds.map((cl, i) => {
          const cx = (cl.cx + (angle * cl.speed * 8)) % (W + 60) - 30;
          return <ellipse key={i} cx={cx} cy={cl.cy} rx={cl.r} ry={cl.r * 0.5} fill="#FFFFFF" opacity={0.06} />;
        })}

        {/* orbit path */}
        <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke={gridColor} strokeWidth={1.5} strokeDasharray="4 4" />

        {/* fading trail */}
        {trail.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={cyan} opacity={(i / trail.length) * 0.5} />
        ))}

        {/* waypoint markers on orbit */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => (
          <circle key={i} cx={CX + RX * Math.cos(a)} cy={CY + RY * Math.sin(a)} r={3} fill="none" stroke={amber} strokeWidth={1.5} opacity={0.6} />
        ))}

        {/* aircraft */}
        <g transform={`translate(${planeX}, ${planeY}) rotate(${heading}) scale(${scale})`}>
          <g transform={`rotate(${bank})`}>
            <path d={PLANE_PATH} fill={cyan} opacity={0.95} transform="translate(-36,-12)" />
          </g>
          {/* engine glow, pulses with safety status */}
          <circle r={4 + depthT * 2} fill={statusColor} opacity={0.5}>
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

        {/* HUD: airspeed */}
        <g transform="translate(16,16)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>AIRSPEED</text>
          <text y={18} fontSize={18} fontFamily="monospace" fill={cyan} fontWeight="bold">{cruiseSpeedMs.toFixed(1)}</text>
          <text x={62} y={18} fontSize={9} fontFamily="monospace" fill={gridColor}>m/s</text>
        </g>

        {/* HUD: vertical speed */}
        <g transform="translate(16,50)">
          <text fontSize={9} fontFamily="monospace" fill={gridColor}>VERT SPEED</text>
          <text y={18} fontSize={14} fontFamily="monospace" fill={rateOfClimbMs >= 0 ? '#22C55E' : '#EF4444'} fontWeight="bold">
            {rateOfClimbMs >= 0 ? '+' : ''}{rateOfClimbMs.toFixed(2)} m/s
          </text>
        </g>

        {/* HUD: heading ring (top right) */}
        <g transform={`translate(${W - 60}, 60)`}>
          <circle r={34} fill="none" stroke={gridColor} strokeWidth={1} opacity={0.5} />
          <g transform={`rotate(${-heading})`}>
            <text y={-24} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={amber}>N</text>
            <text x={24} y={4} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={gridColor}>E</text>
            <text y={30} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={gridColor}>S</text>
            <text x={-24} y={4} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={gridColor}>W</text>
          </g>
          <polygon points="0,-8 -5,4 5,4" fill={cyan} />
        </g>
        <text x={W - 60} y={112} textAnchor="middle" fontSize={9} fontFamily="monospace" fill={gridColor}>
          HDG {Math.round(((heading % 360) + 360) % 360)}°
        </text>

        {/* HUD: safety status */}
        <g transform={`translate(${W - 130}, ${H - 34})`}>
          <circle r={4} fill={statusColor}>
            <animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text x={12} y={4} fontSize={11} fontFamily="monospace" fill={statusColor} fontWeight="bold">{safetyStatus}</text>
        </g>

        {/* HUD: engine count */}
        <text x={16} y={H - 16} fontSize={9} fontFamily="monospace" fill={gridColor}>
          {numEngines}× ENGINE{numEngines !== 1 ? 'S' : ''} NOMINAL
        </text>
      </svg>
    </div>
  );
}
