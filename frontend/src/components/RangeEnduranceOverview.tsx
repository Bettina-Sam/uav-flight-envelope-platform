import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';
import { formatDurationHHMM } from '../lib/duration';

interface Props {
  range: number;
  enduranceHours: number;
  cruiseSpeedMs: number;
  /** Reference range used for the outer ring's 100% mark (e.g. a baseline aircraft). */
  referenceRangeKm?: number;
  /** Reference endurance used for the outer ring's 100% mark, in hours. */
  referenceEnduranceHr?: number;
  referenceLabel?: string;
}

const R = 74;
const CIRC = 2 * Math.PI * R;

/** Real, data-driven range/endurance dial pair — replaces the old decorative
 * flight-path mock. Each ring's fill fraction is the live value against a
 * reference target, so what you see always matches the numbers next to it. */
export default function RangeEnduranceOverview({
  range,
  enduranceHours,
  cruiseSpeedMs,
  referenceRangeKm = 158.21,
  referenceEnduranceHr = 4,
  referenceLabel = 'IUAS-MALE reference',
}: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const bg = dark ? '#0b1220' : '#F4F7FB';
  const track = dark ? '#22304A' : '#DCE5EE';
  const text = dark ? '#E6EDF3' : '#101827';
  const muted = dark ? '#8A9BB5' : '#64748B';
  const cyan = dark ? '#4FD1C5' : '#0D857C';
  const amber = dark ? '#F5A623' : '#B45F06';

  const rangePct = useMemo(() => Math.max(0, Math.min(1, referenceRangeKm > 0 ? range / referenceRangeKm : 0)), [range, referenceRangeKm]);
  const endurancePct = useMemo(() => Math.max(0, Math.min(1, referenceEnduranceHr > 0 ? enduranceHours / referenceEnduranceHr : 0)), [enduranceHours, referenceEnduranceHr]);

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-border p-5 min-h-[390px] flex flex-col"
      style={{ background: bg }}
      data-i18n-skip
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: muted }}>Range &amp; Endurance vs {referenceLabel}</div>
        <div className="font-mono text-[10px]" style={{ color: cyan }}>{cruiseSpeedMs.toFixed(1)} m/s cruise</div>
      </div>

      <div className="flex-1 grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4 items-center">
        <Dial pct={rangePct} color={cyan} track={track} label="RANGE VALUE" value={range.toFixed(2)} sub={`${Math.round(rangePct * 100)}% of ${referenceRangeKm.toFixed(0)}`} text={text} muted={muted} />
        <Dial pct={endurancePct} color={amber} track={track} label="ENDURANCE" value={formatDurationHHMM(enduranceHours)} sub={`${Math.round(endurancePct * 100)}% of ${referenceEnduranceHr.toFixed(1)}h`} text={text} muted={muted} />
      </div>

      <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: track }}>
        <span className="font-mono text-[10px]" style={{ color: muted }}>Rings fill relative to the reference aircraft \u2014 100% means matching it.</span>
      </div>
    </div>
  );
}

function Dial({ pct, color, track, label, value, sub, text, muted }: {
  pct: number; color: string; track: string; label: string; value: string; sub: string; text: string; muted: string;
}) {
  const offset = CIRC * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 180" className="w-full max-w-[170px]">
        <circle cx="90" cy="90" r={R} fill="none" stroke={track} strokeWidth="14" />
        <motion.circle
          cx="90" cy="90" r={R} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={CIRC}
          initial={{ strokeDashoffset: CIRC }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          transform="rotate(-90 90 90)"
        />
        <text x="90" y="86" textAnchor="middle" fontSize="22" fontFamily="monospace" fontWeight="bold" fill={text}>{value}</text>
        <text x="90" y="106" textAnchor="middle" fontSize="9" fontFamily="monospace" fill={muted}>{label}</text>
      </svg>
      <div className="font-mono text-[10px] mt-1" style={{ color: muted }}>{sub}</div>
    </div>
  );
}
