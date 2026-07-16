import { motion } from 'framer-motion';

interface Props {
  label: string;
  min: number;
  max: number;
  recommended: number;
  serviceCeiling: number;
  ghost?: { min: number; max: number; recommended: number; serviceCeiling: number; label: string };
}

const TAPE_HEIGHT = 260;
const TAPE_TOP_PAD = 14;
const TAPE_BOTTOM_PAD = 14;
const USABLE = TAPE_HEIGHT - TAPE_TOP_PAD - TAPE_BOTTOM_PAD;

/**
 * Vertical altimeter-tape style gauge. Replaces the previous semicircular
 * dial, which mis-mirrored its angle-to-coordinate mapping (tick labels
 * rendered in reverse order) and looked visually "flat" for altitude
 * ranges that skew heavily toward the low end (a very common case here,
 * since recommended altitude is frequently much closer to the minimum than
 * the ceiling). A vertical tape reads correctly at any skew and is also
 * the idiomatic instrument shape for altitude specifically.
 */
export default function AltitudeGauge({
  label, min: minAltitude, max: maxAltitude, recommended: recommendedAltitude, serviceCeiling, ghost,
}: Props) {
  const domainMax = Math.max(maxAltitude, serviceCeiling, recommendedAltitude, ghost?.max ?? 0, ghost?.serviceCeiling ?? 0, 1) * 1.04;
  const domainMin = 0;

  const yFor = (alt: number) => {
    const frac = (alt - domainMin) / (domainMax - domainMin || 1);
    return TAPE_TOP_PAD + USABLE * (1 - Math.max(0, Math.min(1, frac)));
  };

  const yMin = yFor(minAltitude);
  const yMax = yFor(maxAltitude);
  const yRec = yFor(recommendedAltitude);
  const yCeiling = yFor(serviceCeiling);

  const ticks = Array.from({ length: 6 }, (_, i) => (domainMax / 5) * i);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="eyebrow mb-3">{label}</div>
      <div className="flex items-end gap-4">
        {/* readout */}
        <div className="text-right pb-1">
          <motion.div
            key={recommendedAltitude}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-mono font-semibold text-3xl text-cyan"
          >
            {Math.round(recommendedAltitude)}
            <span className="text-sm text-muted ml-1">m</span>
          </motion.div>
          <div className="text-[10px] text-muted font-mono mt-1">recommended</div>
        </div>

        <svg viewBox={`0 0 150 ${TAPE_HEIGHT}`} width="150" height={TAPE_HEIGHT}>
          {/* tick lines + labels */}
          {ticks.map((t, i) => {
            const y = yFor(t);
            return (
              <g key={i}>
                <line x1="46" y1={y} x2="54" y2={y} stroke="var(--tick-color, #8A9BB5)" strokeWidth="1" />
                <text x="42" y={y + 3} textAnchor="end" fontSize="8" fontFamily="monospace" fill="#8A9BB5">
                  {Math.round(t)}
                </text>
              </g>
            );
          })}

          {/* main tape track */}
          <rect x="56" y={TAPE_TOP_PAD} width="14" height={USABLE} rx="7" fill="currentColor" className="text-border" opacity="0.5" />

          {/* safe band: from bottom (0) up to service ceiling */}
          <motion.rect
            x="56" width="14" rx="7"
            fill="#22C55E" opacity="0.35"
            initial={{ y: TAPE_TOP_PAD + USABLE, height: 0 }}
            animate={{ y: Math.min(yCeiling, TAPE_TOP_PAD + USABLE), height: Math.max(0, TAPE_TOP_PAD + USABLE - yCeiling) }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          {/* caution band: service ceiling to absolute domain top */}
          <rect
            x="56" y={TAPE_TOP_PAD} width="14" height={Math.max(0, yCeiling - TAPE_TOP_PAD)} rx="7"
            fill="#F5A623" opacity="0.28"
          />

          {/* min/max range indicator (feasible operating band) */}
          <motion.rect
            x="59" width="8"
            fill="none" stroke="#4FD1C5" strokeWidth="1.5"
            initial={{ y: yMin, height: 0 }}
            animate={{ y: yMax, height: Math.max(0, yMin - yMax) }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
          />

          {/* min marker */}
          <g>
            <line x1="70" y1={yMin} x2="88" y2={yMin} stroke="#8A9BB5" strokeWidth="1" strokeDasharray="2 2" />
            <text x="90" y={yMin + 3} fontSize="8" fontFamily="monospace" fill="#8A9BB5">MIN</text>
          </g>
          {/* max marker */}
          <g>
            <line x1="70" y1={yMax} x2="88" y2={yMax} stroke="#EF4444" strokeWidth="1" strokeDasharray="2 2" />
            <text x="90" y={yMax + 3} fontSize="8" fontFamily="monospace" fill="#EF4444">MAX</text>
          </g>
          {/* service ceiling marker */}
          <g>
            <line x1="70" y1={yCeiling} x2="88" y2={yCeiling} stroke="#F5A623" strokeWidth="1" strokeDasharray="2 2" />
            <text x="90" y={yCeiling + 3} fontSize="8" fontFamily="monospace" fill="#F5A623">CEIL</text>
          </g>

          {/* ghost comparison marker */}
          {ghost && (
            <g opacity={0.55}>
              <line x1="52" y1={yFor(ghost.recommended)} x2="106" y2={yFor(ghost.recommended)} stroke="#F5A623" strokeWidth="2" strokeDasharray="3 2" />
              <circle cx="63" cy={yFor(ghost.recommended)} r="4" fill="none" stroke="#F5A623" strokeWidth="1.5" />
              <text x="110" y={yFor(ghost.recommended) + 3} fontSize="7" fontFamily="monospace" fill="#F5A623">{ghost.label}</text>
            </g>
          )}

          {/* recommended marker - the headline indicator */}
          <motion.g
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          >
            <line x1="52" y1={yRec} x2="106" y2={yRec} stroke="#4FD1C5" strokeWidth="2" />
            <circle cx="63" cy={yRec} r="4.5" fill="#4FD1C5" stroke="#0B1220" strokeWidth="1.5" />
          </motion.g>
        </svg>
      </div>

      <div className="flex gap-4 mt-2 text-[10px] font-mono text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green/60 inline-block" />safe band</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber/60 inline-block" />above ceiling</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan inline-block" />recommended</span>
      </div>
    </div>
  );
}
