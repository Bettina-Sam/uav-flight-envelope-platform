import type { MissionComputeResponse, MissionWaypoint } from '../types';

const STORAGE_KEY = 'uav-envelope-mission-history';

export interface HistoricalMission {
  id: string;
  savedAt: string;
  missionType: string;
  waypoints: MissionWaypoint[];
  result: MissionComputeResponse;
}

/** Every computed mission auto-saves here (client-side only, same pattern
 * as Saved Configurations) so the Global Mission Map has something to show
 * across sessions without any backend changes. */
export function listMissionHistory(): HistoricalMission[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMissionToHistory(waypoints: MissionWaypoint[], result: MissionComputeResponse): HistoricalMission {
  const entry: HistoricalMission = {
    id: `mission_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    missionType: result.mission_type,
    waypoints,
    result,
  };
  const next = [entry, ...listMissionHistory()].slice(0, 100);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return entry;
}

export function deleteMissionFromHistory(id: string): void {
  const next = listMissionHistory().filter((m) => m.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const MISSION_TYPE_COLORS: Record<string, string> = {
  Surveillance: '#4FD1C5', Mapping: '#F5A623', Delivery: '#22C55E',
  Reconnaissance: '#9B59B6', 'Border Patrol': '#E07A5F', 'Disaster Relief': '#EF4444',
};
