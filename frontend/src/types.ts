export interface UAVInput {
  aircraft_name: string;
  mass_kg: number;
  payload_kg: number;
  wing_area_m2: number;
  l_over_d: number;            // Lift-to-drag ratio
  cd0: number;                // Drag coefficient (zero-lift / parasite)
  cruise_speed_ms: number;
  air_density_kg_m3: number;  // ambient / reference air density
  sfc_kg_per_n_s: number;     // specific fuel consumption (kg / N / s)
  thrust_to_weight: number;   // thrust-to-weight ratio (T/W)
  propulsion_efficiency: number; // propulsive efficiency (η)
  fuel_capacity_l: number;    // fuel tank capacity in liters
  propeller_diameter_m: number;
  battery_wh: number;         // battery capacity in Wh
  battery_soc: number;        // state of charge (0-1)
  aux_power_w: number;        // auxiliary power draw (avionics, payload), W
}

export interface EngineOutInfo {
  applicable: boolean;
  engines_operating: number;
  single_engine_service_ceiling_m: number;
  single_engine_roc_at_min_alt_ms: number;
  can_maintain_min_altitude: boolean;
  power_loss_fraction: number;
}

export interface EnvelopePoint {
  altitude_m: number;
  rate_of_climb_ms: number;
  power_required_w: number;
  power_available_w: number;
  l_over_d: number;
  feasible: boolean;
}

export interface PhysicsResult {
  min_altitude_m: number;
  max_altitude_m: number;
  mean_altitude_m: number;
  recommended_altitude_m: number;
  recommended_reason: string;
  service_ceiling_m: number;
  absolute_ceiling_m: number;
  rate_of_climb_ms: number;
  range_km: number;
  endurance_hr: number;
  power_required_w: number;
  power_available_w: number;
  lift_n: number;
  drag_n: number;
  l_over_d: number;
  stall_speed_ms: number;
  wing_loading_kg_m2: number;
  power_loading_w_kg: number;
  aspect_ratio: number;
  safety_status: 'SAFE' | 'CAUTION' | 'CRITICAL';
  warnings: string[];
  engine_out: EngineOutInfo;
  envelope_profile: EnvelopePoint[];
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  rmse: number;
}

export interface MLResult {
  min_altitude_m: number;
  max_altitude_m: number;
  mean_altitude_m: number;
  recommended_altitude_m: number;
  service_ceiling_m: number;
  absolute_ceiling_m: number;
  rate_of_climb_ms: number;
  range_km: number;
  endurance_hr: number;
  power_required_w: number;
  lift_n: number;
  drag_n: number;
  l_over_d: number;
  safety_status: 'SAFE' | 'CAUTION' | 'CRITICAL';
  safety_confidence: number;
  model_used: string;
  confidence_intervals: Record<string, ConfidenceInterval>;
  reliability_score: number;
  model_r2: number;
}

export interface ComparisonEntry {
  target: string;
  physics_value: number;
  ml_value: number;
  difference_pct: number;
}

export interface PredictResponse {
  input: UAVInput;
  physics: PhysicsResult;
  ml: MLResult;
  comparison: ComparisonEntry[];
}

export interface ModelMetric {
  MAE: number;
  RMSE: number;
  R2: number;
  MAPE: number;
}

export interface ModelComparisonEntry {
  avg: ModelMetric;
  per_target: Record<string, ModelMetric>;
  train_seconds: number;
  note?: string;
}

export interface FeatureImportanceResponse {
  best_model_name: string;
  permutation_importance: Record<string, number>;
  native_feature_importance: Record<string, number>;
  model_comparison: Record<string, ModelComparisonEntry>;
  safety_classifier_accuracy: number;
}

export interface SensitivityPoint {
  parameter_value: number;
  recommended_altitude_m: number;
  max_altitude_m: number;
  rate_of_climb_ms: number;
  endurance_hr: number;
  range_km: number;
  l_over_d: number;
  power_required_w: number;
  safety_status: string;
}

export interface Sensitivity2DPoint {
  x: number;
  y: number;
  value: number;
  safety_status: string;
}

export interface TrainingBoundsResponse {
  bounds: Record<string, [number, number]>;
}

export type TrainingRangeStatus = 'within' | 'near' | 'outside';

export interface AutoDesignCandidate {
  input: UAVInput;
  achieved_endurance_hr: number;
  achieved_range_km: number;
  achieved_recommended_altitude_m: number;
  safety_status: string;
  score: number;
}

export interface AutoDesignResponse {
  target_endurance_hr: number | null;
  target_range_km: number | null;
  best: AutoDesignCandidate;
  alternatives: AutoDesignCandidate[];
  iterations_run: number;
  method: string;
}

export interface FailureScenarioResult {
  key: string;
  label: string;
  applicable: boolean;
  description: string;
  baseline_value: Record<string, number>;
  scenario_value: Record<string, number>;
  deltas: Record<string, { before: number; after: number; delta: number; delta_pct: number }>;
  new_safety_status: string;
  explanation: string;
}

export interface FailureSimulationResponse {
  baseline_safety_status: string;
  results: FailureScenarioResult[];
}

export interface DesignScoreResponse {
  total: number;
  breakdown: Record<string, { points: number; max: number; detail: string }>;
  grade: string;
}

export interface MonteCarloSummary {
  mean: number;
  std: number;
  ci_95_low: number;
  ci_95_high: number;
  samples: number[];
}

export interface MonteCarloResponse {
  n_samples: number;
  endurance_hr: MonteCarloSummary;
  range_km: MonteCarloSummary;
  recommended_altitude_m: MonteCarloSummary;
  method: string;
  perturbed_parameters: Record<string, number>;
}

export interface EpistemicModelPrediction {
  model: string;
  value: number;
  test_r2: number;
}

export interface EpistemicResponse {
  target: string;
  predictions: EpistemicModelPrediction[];
  mean: number;
  std: number;
  spread_pct: number;
  method: string;
}

export interface ScatterModelData {
  y_true: number[];
  y_pred: number[];
}

export interface ScatterResponse {
  data: Record<string, Record<string, ScatterModelData>>;
}

export interface OptimizeSuggestion {
  parameter: string;
  label: string;
  current_value: number;
  suggested_value: number;
  change_pct: number;
  projected_target_value: number;
  projected_change_pct: number;
  rationale: string;
}

export interface OptimizeSuggestionResponse {
  target: string;
  baseline_value: number;
  suggestions: OptimizeSuggestion[];
}

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
}

export interface MissionWaypoint {
  lat: number;
  lon: number;
}

export interface MissionLeg {
  from_index: number;
  to_index: number;
  distance_km: number;
  time_hr: number;
  energy_wh: number;
}

export interface MissionWaypointResult {
  index: number;
  lat: number;
  lon: number;
  terrain_elevation_m: number;
  min_safe_altitude_m: number;
}

export interface MissionWeather {
  temperature_c: number | null;
  pressure_hpa: number | null;
  humidity_pct: number | null;
  wind_speed_ms: number | null;
  wind_direction_deg: number | null;
  source: string;
  available: boolean;
}

export interface MissionComputeResponse {
  mission_type: string;
  waypoints: MissionWaypointResult[];
  legs: MissionLeg[];
  total_distance_km: number;
  mission_duration_hr: number;
  total_energy_wh: number;
  battery_capacity_wh: number;
  battery_usable_wh: number;
  battery_margin_pct: number;
  cruise_altitude_m: number;
  mission_floor_m: number;
  terrain_conflict: boolean;
  warnings: string[];
  elevation_source: string;
  weather: MissionWeather | null;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  training_mean: number;
  contribution: number;
  direction: 'increases' | 'decreases' | 'neutral';
}

export interface LocalExplanationResponse {
  target: string;
  baseline_prediction: number;
  dataset_mean_prediction: number;
  contributions: FeatureContribution[];
  method: string;
}

export const DEFAULT_UAV_INPUT: UAVInput = {
  aircraft_name: 'TAPAS BH-201',
  mass_kg: 2850,
  payload_kg: 350,
  wing_area_m2: 21.2,
  l_over_d: 26.0,
  cd0: 0.03,
  cruise_speed_ms: 45,
  air_density_kg_m3: 1.225,
  sfc_kg_per_n_s: 0.000007,
  thrust_to_weight: 0.32,
  propulsion_efficiency: 0.80,
  fuel_capacity_l: 500,
  propeller_diameter_m: 3.0,
  battery_wh: 106875,
  battery_soc: 0.9,
  aux_power_w: 480,
};
