import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { TrainingRangeStatus } from '../types';

/** Classify a value against the ML model's training sampling bounds.
 * "near" = within 10% of the range from either edge. */
export function classifyRange(value: number, bounds?: [number, number]): TrainingRangeStatus {
  if (!bounds) return 'within';
  const [lo, hi] = bounds;
  const span = hi - lo;
  if (span <= 0) return 'within';
  const margin = span * 0.10;
  if (value < lo || value > hi) return 'outside';
  if (value < lo + margin || value > hi - margin) return 'near';
  return 'within';
}

const CONFIG: Record<TrainingRangeStatus, { icon: any; color: string; label: string }> = {
  within: { icon: CheckCircle2, color: 'text-green', label: 'Within ML Range' },
  near: { icon: AlertTriangle, color: 'text-amber', label: 'Near Boundary' },
  outside: { icon: XCircle, color: 'text-red', label: 'Outside Training Distribution' },
};

export default function TrainingRangeBadge({ status }: { status: TrainingRangeStatus }) {
  const cfg = CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}
