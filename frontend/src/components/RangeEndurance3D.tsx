import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Props {
  range: number;
  enduranceHours: number;
  cruiseSpeedMs: number;
}

export default function RangeEndurance3D({ range, enduranceHours, cruiseSpeedMs }: Props) {
  const points = useMemo(() => {
    const count = 44;
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const x = 70 + t * 590;
      const depth = Math.sin(t * Math.PI) * 74;
      const y = 278 - depth - Math.sin(t * Math.PI * 4) * 8;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-[#07111f] min-h-[390px]">
      <svg viewBox="0 0 760 390" className="w-full h-full min-h-[390px]" role="img" aria-label="Animated three-dimensional range and endurance mission visualization">
        <defs>
          <linearGradient id="re3dSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b2038" />
            <stop offset="100%" stopColor="#07111f" />
          </linearGradient>
          <linearGradient id="re3dTrail" x1="0" x2="1">
            <stop offset="0%" stopColor="#4FD1C5" stopOpacity=".15" />
            <stop offset="100%" stopColor="#4FD1C5" />
          </linearGradient>
          <filter id="re3dGlow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect width="760" height="390" fill="url(#re3dSky)" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1={40 + i * 43} y1={350} x2={380 + (i - 4) * 22} y2={205} stroke="#294158" strokeOpacity=".55" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <polyline key={`v${i}`} points={`40,${350 - i * 24} 380,${205 - i * 4} 720,${350 - i * 24}`} fill="none" stroke="#294158" strokeOpacity=".45" />
        ))}
        <polyline points={points} fill="none" stroke="url(#re3dTrail)" strokeWidth="3" strokeDasharray="7 7" />
        <circle cx="70" cy="278" r="6" fill="#F5A623" />
        <circle cx="660" cy="278" r="6" fill="#22C55E" />
        <text x="70" y="302" textAnchor="middle" fill="#8A9BB5" fontSize="10" fontFamily="monospace">MISSION START</text>
        <text x="660" y="302" textAnchor="middle" fill="#8A9BB5" fontSize="10" fontFamily="monospace">RANGE LIMIT</text>
        <motion.g
          initial={{ x: 70, y: 278, rotate: -18 }}
          animate={{
            x: [70, 160, 280, 400, 520, 660],
            y: [278, 218, 183, 178, 214, 278],
            rotate: [-18, -12, -3, 4, 12, 18],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear', times: [0, 0.18, 0.4, 0.6, 0.82, 1] }}
          filter="url(#re3dGlow)"
        >
          <path d="M-20 0 L-5 -4 L3 -18 L8 -18 L6 -3 L22 1 L22 5 L6 5 L9 17 L4 17 L-5 6 L-20 4 Z" fill="#E8FFFC" stroke="#4FD1C5" strokeWidth="1.5" />
        </motion.g>
        <g fontFamily="monospace">
          <text x="42" y="42" fill="#8A9BB5" fontSize="10">MISSION PERFORMANCE SPACE</text>
          <text x="42" y="70" fill="#4FD1C5" fontSize="24">{range.toFixed(2)}</text>
          <text x="42" y="88" fill="#8A9BB5" fontSize="10">RANGE VALUE</text>
          <text x="250" y="70" fill="#F5A623" fontSize="24">{Math.floor(enduranceHours)}:{String(Math.round((enduranceHours % 1) * 60)).padStart(2, '0')}</text>
          <text x="250" y="88" fill="#8A9BB5" fontSize="10">ENDURANCE HH:MM</text>
          <text x="493" y="70" fill="#E8FFFC" fontSize="24">{cruiseSpeedMs.toFixed(1)}</text>
          <text x="493" y="88" fill="#8A9BB5" fontSize="10">CRUISE SPEED m/s</text>
        </g>
      </svg>
    </div>
  );
}
