import { motion } from 'framer-motion';
import { Save, Library, TrendingUp, Route, BatteryCharging, ShieldCheck, Compass, LucideIcon } from 'lucide-react';
import type { Achievement } from '../lib/achievements';

const ICONS: Record<string, LucideIcon> = { Save, Library, TrendingUp, Route, BatteryCharging, ShieldCheck, Compass };

export default function AchievementBadges({ achievements }: { achievements: Achievement[] }) {
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">Milestones</div>
        <span className="text-[10px] font-mono text-muted">{unlockedCount} / {achievements.length} unlocked</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {achievements.map((a, i) => {
          const Icon = ICONS[a.icon] || Save;
          return (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              title={a.description}
              className={`rounded-lg border p-3 flex flex-col items-center text-center gap-1.5 transition ${
                a.unlocked ? 'border-cyan/40 bg-cyan/5' : 'border-border opacity-40 grayscale'
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${a.unlocked ? 'bg-cyan/15 text-cyan' : 'bg-border text-muted'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wide text-text leading-tight">{a.label}</div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
