import type { PredictResponse, DesignScoreResponse } from '../types';

export function narratePhysics(r: PredictResponse): string {
  const p = r.physics;
  return `Physics results. This aircraft has a recommended cruise altitude of ${Math.round(p.recommended_altitude_m)} meters, `
    + `with a service ceiling of ${Math.round(p.service_ceiling_m)} meters. Estimated endurance is ${p.endurance_hr.toFixed(1)} hours, `
    + `with a range of ${Math.round(p.range_km)} kilometers. The lift to drag ratio is ${p.l_over_d.toFixed(1)}. `
    + `Overall safety status is ${p.safety_status}. ${p.warnings.length ? 'Warnings: ' + p.warnings.join('. ') : 'No warnings were raised for this configuration.'}`;
}

export function narrateML(r: PredictResponse): string {
  const ml = r.ml;
  return `Machine learning prediction, using the ${ml.model_used} model. `
    + `Predicted recommended altitude is ${Math.round(ml.recommended_altitude_m)} meters, with a safety classifier confidence of `
    + `${Math.round(ml.safety_confidence * 100)} percent, and an overall reliability score of ${Math.round(ml.reliability_score * 100)} percent.`;
}

export function narrateDashboard(r: PredictResponse, score?: DesignScoreResponse | null): string {
  const p = r.physics;
  let s = `Flight envelope dashboard summary. Recommended altitude ${Math.round(p.recommended_altitude_m)} meters, `
    + `rate of climb ${p.rate_of_climb_ms.toFixed(1)} meters per second, safety status ${p.safety_status}.`;
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
  '/': 'This is the home page. It introduces the platform: a physics-informed machine learning system for predicting UAV flight envelopes, comparing a physics engine against a trained model, and planning missions.',
  '/input': 'This is the UAV Input page. Enter your aircraft\u2019s design parameters here, grouped by geometry, aerodynamics, propulsion, weight, and battery. Each field is checked against the machine learning model\u2019s training range.',
  '/physics': 'This is the Physics Results page. It shows the ground-truth calculation from first-principles aerodynamics: altitude envelope, climb rate, range, endurance, and a safety assessment.',
  '/ml': 'This is the Machine Learning Prediction page. It shows what the trained surrogate model predicts from the same inputs, along with confidence intervals and an explanation of which features drove the prediction.',
  '/dashboard': 'This is the Flight Envelope Dashboard. It combines the altitude gauge, a live flight profile visualizer, and your overall design score in one view.',
  '/comparison': 'This is the Physics versus Machine Learning comparison page. It checks every shared prediction between the two methods and flags any disagreement.',
  '/performance': 'This is the Performance Analysis page, covering altitude, range, and endurance in depth: physics, machine learning, sensitivity, and optimization suggestions for each.',
  '/uncertainty': 'This is the Uncertainty Quantification page. It separates aleatoric uncertainty, from real-world variability, and epistemic uncertainty, from model knowledge limits, and benchmarks seven machine learning algorithms.',
  '/mission': 'This is the Mission Planner. Search a location or click the map to place waypoints, then compute a terrain-aware altitude profile and energy budget for the mission.',
  '/design-studio': 'This is the Design Studio, combining the Auto Design optimizer, which searches for a configuration matching your targets, and Failure Simulation, which stress-tests your current design.',
  '/report': 'This is the Report page. Generate a full PDF or CSV engineering report, and manage your saved configurations here.',
  '/command-center': 'This is the Command Center, a single consolidated view of your aircraft\u2019s live status: flight profile, altitude, design score, and key statistics at a glance.',
  '/missions': 'This is the Global Mission Map, showing every mission you\u2019ve planned across sessions on one map.',
};
