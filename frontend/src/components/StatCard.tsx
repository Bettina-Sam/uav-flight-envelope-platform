interface Props {
  label: string;
  value: string | number;
  unit?: string;
  accent?: 'cyan' | 'amber' | 'green' | 'red' | 'text';
  sub?: string;
}

const ACCENTS: Record<string, string> = {
  cyan: 'text-cyan', amber: 'text-amber', green: 'text-green', red: 'text-red', text: 'text-text',
};

export default function StatCard({ label, value, unit, accent = 'text', sub }: Props) {
  return (
    <div className="panel px-4 py-3.5">
      <div className="eyebrow">{label}</div>
      <div className={`font-mono font-semibold text-2xl mt-1 ${ACCENTS[accent]}`}>
        {value}
        {unit && <span className="text-sm text-muted ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-muted mt-1">{sub}</div>}
    </div>
  );
}
