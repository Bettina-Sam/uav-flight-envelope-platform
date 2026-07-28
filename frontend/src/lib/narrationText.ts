import type { PredictResponse, DesignScoreResponse } from '../types';
import { formatDurationLong } from './duration';

export function narratePhysics(r: PredictResponse): string {
  const p = r.physics;
  return `Physics results. Estimated endurance is ${formatDurationLong(p.endurance_hr)}. `
    + `The project range value is ${p.range_km.toFixed(2)}, calculated from cruise speed multiplied by endurance. `
    + `The lift to drag ratio is ${p.l_over_d.toFixed(1)}.`;
}

export function narrateML(r: PredictResponse): string {
  const ml = r.ml;
  return `Machine learning prediction, using the ${ml.model_used} model. `
    + `Predicted endurance is ${formatDurationLong(ml.endurance_hr)} and the predicted range value is ${ml.range_km.toFixed(2)}. `
    + `Overall reliability is ${Math.round(ml.reliability_score * 100)} percent.`;
}

export function narrateDashboard(r: PredictResponse, score?: DesignScoreResponse | null): string {
  const p = r.physics;
  let s = `Range and endurance summary. Endurance ${formatDurationLong(p.endurance_hr)}, range value ${p.range_km.toFixed(2)}.`;
  if (score) s += ` Overall design score is ${Math.round(score.total)} out of 100, grade ${score.grade}.`;
  return s;
}

export function narrateMissionSummary(missionType: string, waypointCount: number, durationMin: number, distanceKm: number, batteryMarginPct: number): string {
  return `Mission summary for a ${missionType} mission with ${waypointCount} waypoints. `
    + `Estimated duration is ${Math.round(durationMin)} minutes, covering ${distanceKm.toFixed(1)} kilometers, `
    + `with a battery margin of ${Math.round(batteryMarginPct)} percent. `
    + `${batteryMarginPct < 0 ? 'Warning: this mission exceeds the available battery capacity as planned.' : 'This mission is within the aircraft\u2019s energy budget.'}`;
}

export const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/': 'This is the home page. It introduces the physics-informed machine learning platform for UAV range and endurance.',
  '/input': 'This is the UAV Input page. Enter your aircraft\u2019s design parameters here, grouped by geometry, aerodynamics, propulsion, weight, and battery. Each field is checked against the machine learning model\u2019s training range.',
  '/physics': 'This is the Physics Results page. It shows the range and endurance calculated from the aircraft and energy inputs.',
  '/ml': 'This is the Machine Learning Prediction page. It cross-checks range and endurance with the trained surrogate.',
  '/comparison': 'This page compares physics and machine learning range and endurance.',
  '/performance': 'This page provides detailed range and endurance analysis.',
  '/uncertainty': 'This is the Uncertainty Quantification page. It separates aleatoric uncertainty, from real-world variability, and epistemic uncertainty, from model knowledge limits, and benchmarks seven machine learning algorithms.',
  '/batch': 'This page runs range and endurance predictions for multiple UAV configurations from a CSV file.',
};
