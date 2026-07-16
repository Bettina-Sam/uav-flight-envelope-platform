import type { PredictResponse } from '../types';
import type { SavedConfig } from './savedConfigs';

export interface Achievement {
  key: string;
  label: string;
  description: string;
  icon: string; // lucide icon name, resolved by the component
  unlocked: boolean;
}

/** All badge logic lives here, computed fresh from Saved Configs history +
 * the current live result — no separate "achievements" storage to keep in
 * sync, so it can never go stale relative to your actual saved designs. */
export function computeAchievements(savedConfigs: SavedConfig[], current: PredictResponse | null): Achievement[] {
  const savedCount = savedConfigs.length;

  // We only have inputs for saved configs (not their computed results),
  // so badges that need physics output use the CURRENT live result plus
  // simple input-based heuristics for saved ones where that's sufficient.
  const highLD = current ? current.physics.l_over_d > 20 : false;
  const longRange = current ? current.physics.range_km > 300 : false;
  const longEndurance = current ? current.physics.endurance_hr > 5 : false;
  const safeNow = current ? current.physics.safety_status === 'SAFE' : false;

  return [
    {
      key: 'first_save', label: 'First Design Saved',
      description: 'Save your first UAV configuration.',
      icon: 'Save', unlocked: savedCount >= 1,
    },
    {
      key: 'design_library', label: 'Design Library',
      description: 'Save 5 or more configurations.',
      icon: 'Library', unlocked: savedCount >= 5,
    },
    {
      key: 'efficiency_master', label: 'Efficiency Master',
      description: 'Achieve a lift-to-drag ratio above 20.',
      icon: 'TrendingUp', unlocked: highLD,
    },
    {
      key: 'extreme_range', label: 'Extreme Range',
      description: 'Design a configuration with range over 300 km.',
      icon: 'Route', unlocked: longRange,
    },
    {
      key: 'endurance_champion', label: 'Endurance Champion',
      description: 'Design a configuration with endurance over 5 hours.',
      icon: 'BatteryCharging', unlocked: longEndurance,
    },
    {
      key: 'safety_first', label: 'Safety First',
      description: 'Current configuration has a SAFE status.',
      icon: 'ShieldCheck', unlocked: safeNow,
    },
    {
      key: 'explorer', label: 'Design Space Explorer',
      description: 'Save 10 or more configurations.',
      icon: 'Compass', unlocked: savedCount >= 10,
    },
  ];
}
