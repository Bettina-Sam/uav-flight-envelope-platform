import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  SAFE: { color: 'text-green', bg: 'bg-green/10 border-green/30', icon: ShieldCheck, label: 'Safe' },
  CAUTION: { color: 'text-amber', bg: 'bg-amber/10 border-amber/30', icon: ShieldAlert, label: 'Caution' },
  CRITICAL: { color: 'text-red', bg: 'bg-red/10 border-red/30', icon: ShieldX, label: 'Critical' },
};

export default function SafetyBadge({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' | 'lg' }) {
  const cfg = CONFIG[status] || CONFIG.CAUTION;
  const Icon = cfg.icon;
  const sizeCls = size === 'lg' ? 'px-4 py-2 text-sm' : size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider ${cfg.bg} ${cfg.color} ${sizeCls}`}>
      <Icon className={size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
      {cfg.label}
    </span>
  );
}
