import axios from 'axios';
import type {
  UAVInput, PredictResponse, FeatureImportanceResponse, SensitivityPoint,
  Sensitivity2DPoint, TrainingBoundsResponse, LocalExplanationResponse,
  OptimizeSuggestionResponse, MissionWaypoint, MissionComputeResponse, MissionWeather,
  AutoDesignResponse, FailureSimulationResponse, DesignScoreResponse, GeocodeResult,
  MonteCarloResponse, EpistemicResponse, ScatterResponse,
} from '../types';

// Reads from Vite env var at build time; falls back to local dev backend.
// Set VITE_API_URL in frontend/.env (see docs/DEPLOYMENT.md) for production.
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

export async function predict(input: UAVInput): Promise<PredictResponse> {
  const res = await client.post<PredictResponse>('/predict', input);
  return res.data;
}

let _featureImportanceCache: FeatureImportanceResponse | null = null;
export async function getFeatureImportance(): Promise<FeatureImportanceResponse> {
  if (_featureImportanceCache) return _featureImportanceCache;
  const res = await client.get<FeatureImportanceResponse>('/feature-importance');
  _featureImportanceCache = res.data;
  return res.data;
}

export async function runSensitivity(
  base_input: UAVInput, parameter: string, min_value: number, max_value: number, steps = 15
): Promise<SensitivityPoint[]> {
  const res = await client.post<SensitivityPoint[]>('/sensitivity', {
    base_input, parameter, min_value, max_value, steps,
  });
  return res.data;
}

export async function runSensitivity2D(
  base_input: UAVInput, parameter_x: string, min_x: number, max_x: number,
  parameter_y: string, min_y: number, max_y: number, target: string, steps = 8
): Promise<Sensitivity2DPoint[]> {
  const res = await client.post<Sensitivity2DPoint[]>('/sensitivity-2d', {
    base_input, parameter_x, min_x, max_x, parameter_y, min_y, max_y, target, steps,
  });
  return res.data;
}

let _boundsCache: TrainingBoundsResponse | null = null;
export async function getTrainingBounds(): Promise<TrainingBoundsResponse> {
  if (_boundsCache) return _boundsCache;
  const res = await client.get<TrainingBoundsResponse>('/training-bounds');
  _boundsCache = res.data;
  return res.data;
}

export async function explainPrediction(input: UAVInput, target: string): Promise<LocalExplanationResponse> {
  const res = await client.post<LocalExplanationResponse>('/explain', { input, target });
  return res.data;
}

export async function getOptimizeSuggestions(base_input: UAVInput, target: string): Promise<OptimizeSuggestionResponse> {
  const res = await client.post<OptimizeSuggestionResponse>('/optimize-suggestions', { base_input, target });
  return res.data;
}

export async function computeMission(
  waypoints: MissionWaypoint[], input: UAVInput, mission_type: string, altitude_buffer_m = 100
): Promise<MissionComputeResponse> {
  const res = await client.post<MissionComputeResponse>('/mission/compute', {
    waypoints, input, mission_type, altitude_buffer_m,
  });
  return res.data;
}

export async function getMissionWeather(lat: number, lon: number): Promise<MissionWeather> {
  const res = await client.post<MissionWeather>('/mission/weather', { lat, lon });
  return res.data;
}

export async function geocodeSearch(query: string, limit = 5): Promise<GeocodeResult[]> {
  const res = await client.post<{ results: GeocodeResult[]; available: boolean }>('/mission/geocode', { query, limit });
  return res.data.results;
}

export async function runMonteCarloUncertainty(
  base_input: UAVInput, n_samples: number, mass_std_pct: number, cd0_std_pct: number,
  battery_std_pct: number, prop_eff_std_pct: number
): Promise<MonteCarloResponse> {
  const res = await client.post<MonteCarloResponse>('/uncertainty/monte-carlo', {
    base_input, n_samples, mass_std_pct, cd0_std_pct, battery_std_pct, prop_eff_std_pct,
  });
  return res.data;
}

export async function getEpistemicUncertainty(input: UAVInput, target: string): Promise<EpistemicResponse> {
  const res = await client.post<EpistemicResponse>('/uncertainty/epistemic', { input, target });
  return res.data;
}

let _scatterCache: ScatterResponse | null = null;
export async function getScatterData(): Promise<ScatterResponse> {
  if (_scatterCache) return _scatterCache;
  const res = await client.get<ScatterResponse>('/uncertainty/scatter');
  _scatterCache = res.data;
  return res.data;
}

export async function autoDesign(
  target_endurance_hr: number | null, target_range_km: number | null, payload_kg: number, iterations = 400
): Promise<AutoDesignResponse> {
  const res = await client.post<AutoDesignResponse>('/auto-design', {
    target_endurance_hr, target_range_km, payload_kg, iterations,
  });
  return res.data;
}

export async function simulateFailures(input: UAVInput): Promise<FailureSimulationResponse> {
  const res = await client.post<FailureSimulationResponse>('/failure-simulation', { input });
  return res.data;
}

export async function getDesignScore(input: UAVInput): Promise<DesignScoreResponse> {
  const res = await client.post<DesignScoreResponse>('/design-score', input);
  return res.data;
}

export async function batchPredict(file: File): Promise<any> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post('/batch-predict', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function downloadReport(
  input: UAVInput, format: 'pdf' | 'csv', mission?: MissionComputeResponse | null
): Promise<void> {
  const body = format === 'pdf'
    ? { input, mission: mission || null, include_failure_analysis: true, include_optimization: true }
    : input;
  const res = await client.post(`/report/${format}`, body, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `uav_flight_envelope_report.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function checkHealth(): Promise<boolean> {
  try {
    await client.get('/');
    return true;
  } catch {
    return false;
  }
}
