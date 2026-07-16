import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Sensitivity2DPoint } from '../types';

interface Props {
  points: Sensitivity2DPoint[];
  xLabel: string;
  yLabel: string;
  valueLabel: string;
  valueUnit?: string;
}

const SAFETY_DOT: Record<string, string> = { SAFE: '#22C55E', CAUTION: '#F5A623', CRITICAL: '#EF4444' };

/** Interpolates a value in [0,1] across a cyan -> amber -> deep-red heat scale. */
function heatColor(t: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.0, [30, 64, 90]],     // deep cool
    [0.35, [79, 209, 197]],  // cyan
    [0.7, [245, 166, 35]],   // amber
    [1.0, [220, 60, 50]],    // red
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const span = hi[0] - lo[0] || 1;
  const localT = (t - lo[0]) / span;
  const rgb = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * localT));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

/**
 * Grid heatmap for a 2-parameter physics sweep: each cell is one (x, y)
 * sample, shaded by its predicted value (cool -> warm), with a small
 * safety-status dot in the corner. Replaces a free-floating bubble scatter
 * with a representation where the grid structure of the sweep is legible
 * and every sampled cell is visible (bubbles can overlap/hide each other).
 */
export default function SensitivityHeatmap({ points, xLabel, yLabel, valueLabel, valueUnit = '' }: Props) {
  const [hovered, setHovered] = useState<Sensitivity2DPoint | null>(null);

  const { xs, ys, grid, min, max } = useMemo(() => {
    const xsSet = Array.from(new Set(points.map((p) => p.x))).sort((a, b) => a - b);
    const ysSet = Array.from(new Set(points.map((p) => p.y))).sort((a, b) => b - a); // top = highest y
    const map = new Map<string, Sensitivity2DPoint>();
    points.forEach((p) => map.set(`${p.x}_${p.y}`, p));
    const values = points.map((p) => p.value);
    return {
      xs: xsSet, ys: ysSet, grid: map,
      min: Math.min(...values), max: Math.max(...values),
    };
  }, [points]);

  if (points.length === 0) return null;
  const span = max - min || 1;

  return (
    <div>
      <div className="flex gap-3">
        {/* y-axis label */}
        <div className="flex items-center">
          <span className="text-[10px] font-mono text-muted whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
            {yLabel}
          </span>
        </div>

        <div className="flex-1">
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${xs.length}, 1fr)` }}
          >
            {ys.map((y) =>
              xs.map((x) => {
                const pt = grid.get(`${x}_${y}`);
                if (!pt) return <div key={`${x}_${y}`} />;
                const t = (pt.value - min) / span;
                return (
                  <motion.div
                    key={`${x}_${y}`}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    onMouseEnter={() => setHovered(pt)}
                    onMouseLeave={() => setHovered(null)}
                    className="aspect-square rounded-sm relative cursor-crosshair"
                    style={{ background: heatColor(t) }}
                  >
                    <span
                      className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full"
                      style={{ background: SAFETY_DOT[pt.safety_status] || '#8A9BB5' }}
                    />
                  </motion.div>
                );
              })
            )}
          </div>
          {/* x-axis tick labels (first, mid, last) */}
          <div className="flex justify-between text-[9px] font-mono text-muted mt-1.5">
            <span>{xs[0]?.toFixed(2)}</span>
            <span className="text-text">{xLabel}</span>
            <span>{xs[xs.length - 1]?.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted">{min.toFixed(1)}</span>
          <div className="w-32 h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(30,64,90), rgb(79,209,197), rgb(245,166,35), rgb(220,60,50))' }} />
          <span className="text-[10px] font-mono text-muted">{max.toFixed(1)}</span>
          <span className="text-[10px] font-mono text-text ml-1">{valueLabel} {valueUnit}</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-muted">
          {Object.entries(SAFETY_DOT).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: v }} /> {k}
            </span>
          ))}
        </div>
      </div>

      {hovered && (
        <div className="mt-3 text-xs font-mono panel px-3 py-2 inline-block">
          <span className="text-muted">{xLabel}:</span> <span className="text-text">{hovered.x.toFixed(2)}</span>
          <span className="text-muted ml-3">{yLabel}:</span> <span className="text-text">{hovered.y.toFixed(2)}</span>
          <span className="text-muted ml-3">{valueLabel}:</span> <span className="text-cyan">{hovered.value.toFixed(2)} {valueUnit}</span>
          <span className="text-muted ml-3">Status:</span> <span style={{ color: SAFETY_DOT[hovered.safety_status] }}>{hovered.safety_status}</span>
        </div>
      )}
    </div>
  );
}
