from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional


class UAVInput(BaseModel):
    aircraft_name: str = Field('TAPAS BH-201', description='Aircraft name')
    mass_kg: float = Field(..., gt=0, le=30000, description='Total mass (empty + payload), kg')
    payload_kg: float = Field(..., ge=0, le=5000, description='Payload mass, kg')
    wing_area_m2: float = Field(..., gt=0.05, le=500.0, description='Wing planform area, m^2')
    l_over_d: float = Field(..., gt=1.0, le=60.0, description='Lift-to-drag ratio (L/D)')
    cd0: float = Field(..., gt=0.0001, le=0.2, description='Drag coefficient (parasite Cd0)')
    cruise_speed_ms: float = Field(..., gt=1.0, le=200.0, description='Design cruise true airspeed, m/s')
    air_density_kg_m3: float = Field(1.225, gt=0.05, le=1.5, description='Ambient / reference air density, kg/m^3')
    sfc_kg_per_n_s: float = Field(0.000007, ge=0.0, le=0.00005, description='Specific fuel consumption, kg/(N·s)')
    thrust_to_weight: float = Field(0.32, gt=0.0, le=5.0, description='Thrust-to-weight ratio (T/W)')
    propulsion_efficiency: float = Field(0.8, gt=0.1, le=0.99, description='Propulsive efficiency (η)')
    fuel_capacity_l: float = Field(500.0, ge=0.0, le=10000.0, description='Fuel capacity, liters')
    propeller_diameter_m: float = Field(3.0, gt=0.01, le=10.0, description='Propeller diameter, m')
    battery_wh: float = Field(106875.0, gt=0.0, le=1000000.0, description='Battery capacity, Wh')
    battery_soc: float = Field(0.9, ge=0.0, le=1.0, description='Battery State of Charge (fraction 0-1)')
    aux_power_w: float = Field(480.0, ge=0.0, le=10000.0, description='Auxiliary power consumption (avionics/payload), W')

    class Config:
        json_schema_extra = {
            "example": {
                "aircraft_name": "TAPAS BH-201",
                "mass_kg": 2850, "payload_kg": 350, "wing_area_m2": 21.2,
                "l_over_d": 26.0, "cd0": 0.03, "cruise_speed_ms": 45,
                "air_density_kg_m3": 1.225, "sfc_kg_per_n_s": 0.000007, "thrust_to_weight": 0.32,
                "propulsion_efficiency": 0.8, "fuel_capacity_l": 500, "propeller_diameter_m": 3.0,
                "battery_wh": 106875, "battery_soc": 0.9, "aux_power_w": 480
            }
        }


class EngineOutInfo(BaseModel):
    applicable: bool
    engines_operating: int
    single_engine_service_ceiling_m: float
    single_engine_roc_at_min_alt_ms: float
    can_maintain_min_altitude: bool
    power_loss_fraction: float


class EnvelopePoint(BaseModel):
    altitude_m: float
    rate_of_climb_ms: float
    power_required_w: float
    power_available_w: float
    l_over_d: float
    feasible: bool


class PhysicsResult(BaseModel):
    min_altitude_m: float
    max_altitude_m: float
    mean_altitude_m: float
    recommended_altitude_m: float
    recommended_reason: str
    service_ceiling_m: float
    absolute_ceiling_m: float
    rate_of_climb_ms: float
    range_km: float
    endurance_hr: float
    power_required_w: float
    power_available_w: float
    lift_n: float
    drag_n: float
    l_over_d: float
    stall_speed_ms: float
    wing_loading_kg_m2: float
    power_loading_w_kg: float
    aspect_ratio: float
    safety_status: str
    warnings: List[str]
    engine_out: EngineOutInfo
    envelope_profile: List[EnvelopePoint]


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float
    rmse: float


class MLResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    min_altitude_m: float
    max_altitude_m: float
    mean_altitude_m: float
    recommended_altitude_m: float
    service_ceiling_m: float
    absolute_ceiling_m: float
    rate_of_climb_ms: float
    range_km: float
    endurance_hr: float
    power_required_w: float
    lift_n: float
    drag_n: float
    l_over_d: float
    safety_status: str
    safety_confidence: float
    model_used: str
    confidence_intervals: dict = Field(default_factory=dict)
    reliability_score: float = 0.0
    model_r2: float = 0.0


class ComparisonEntry(BaseModel):
    target: str
    physics_value: float
    ml_value: float
    difference_pct: float


class PredictResponse(BaseModel):
    input: UAVInput
    physics: PhysicsResult
    ml: MLResult
    comparison: List[ComparisonEntry]


class FeatureImportanceResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    best_model_name: str
    permutation_importance: dict
    native_feature_importance: dict
    model_comparison: dict
    safety_classifier_accuracy: float


class AutoDesignRequest(BaseModel):
    target_endurance_hr: Optional[float] = None
    target_range_km: Optional[float] = None
    payload_kg: float = Field(2.0, ge=0, le=15)
    seed_input: Optional[UAVInput] = None
    iterations: int = Field(400, ge=50, le=1500)


class AutoDesignCandidate(BaseModel):
    input: UAVInput
    achieved_endurance_hr: float
    achieved_range_km: float
    achieved_recommended_altitude_m: float
    safety_status: str
    score: float


class AutoDesignResponse(BaseModel):
    target_endurance_hr: Optional[float]
    target_range_km: Optional[float]
    best: AutoDesignCandidate
    alternatives: List[AutoDesignCandidate]
    iterations_run: int
    method: str


class FailureScenarioResult(BaseModel):
    key: str
    label: str
    applicable: bool
    description: str
    baseline_value: dict
    scenario_value: dict
    deltas: dict
    new_safety_status: str
    explanation: str


class FailureSimulationRequest(BaseModel):
    input: UAVInput
    scenarios: Optional[List[str]] = None


class FailureSimulationResponse(BaseModel):
    baseline_safety_status: str
    results: List[FailureScenarioResult]


class SensitivityRequest(BaseModel):
    base_input: UAVInput
    parameter: str
    min_value: float
    max_value: float
    steps: int = 15


class MonteCarloRequest(BaseModel):
    base_input: UAVInput
    n_samples: int = Field(2000, ge=200, le=5000)
    mass_std_pct: float = Field(5.0, ge=0, le=30)
    cd0_std_pct: float = Field(8.0, ge=0, le=30)
    battery_std_pct: float = Field(6.0, ge=0, le=30)
    prop_eff_std_pct: float = Field(5.0, ge=0, le=30)


class MonteCarloSummary(BaseModel):
    mean: float
    std: float
    ci_95_low: float
    ci_95_high: float
    samples: List[float]


class MonteCarloResponse(BaseModel):
    n_samples: int
    endurance_hr: MonteCarloSummary
    range_km: MonteCarloSummary
    recommended_altitude_m: MonteCarloSummary
    method: str
    perturbed_parameters: dict


class EpistemicRequest(BaseModel):
    input: UAVInput
    target: str = "endurance_hr"


class EpistemicModelPrediction(BaseModel):
    model: str
    value: float
    test_r2: float


class EpistemicResponse(BaseModel):
    target: str
    predictions: List[EpistemicModelPrediction]
    mean: float
    std: float
    spread_pct: float
    method: str


class ScatterResponse(BaseModel):
    data: dict


class OptimizeSuggestionRequest(BaseModel):
    base_input: UAVInput
    target: str = "range_km"


class OptimizeSuggestion(BaseModel):
    parameter: str
    label: str
    current_value: float
    suggested_value: float
    change_pct: float
    projected_target_value: float
    projected_change_pct: float
    rationale: str


class OptimizeSuggestionResponse(BaseModel):
    target: str
    baseline_value: float
    suggestions: List[OptimizeSuggestion]


class MissionWaypoint(BaseModel):
    lat: float
    lon: float


class MissionElevationRequest(BaseModel):
    points: List[MissionWaypoint]


class MissionElevationResponse(BaseModel):
    elevations_m: List[float]
    source: str
    available: bool


class GeocodeRequest(BaseModel):
    query: str
    limit: int = Field(5, ge=1, le=10)


class GeocodeResult(BaseModel):
    display_name: str
    lat: float
    lon: float


class GeocodeResponse(BaseModel):
    results: List[GeocodeResult]
    available: bool


class MissionWeatherRequest(BaseModel):
    lat: float
    lon: float


class MissionWeatherResponse(BaseModel):
    temperature_c: Optional[float] = None
    pressure_hpa: Optional[float] = None
    humidity_pct: Optional[float] = None
    wind_speed_ms: Optional[float] = None
    wind_direction_deg: Optional[float] = None
    source: str
    available: bool


class MissionComputeRequest(BaseModel):
    waypoints: List[MissionWaypoint]
    input: UAVInput
    mission_type: str = "Surveillance"
    altitude_buffer_m: float = 100.0


class MissionLeg(BaseModel):
    from_index: int
    to_index: int
    distance_km: float
    time_hr: float
    energy_wh: float


class MissionWaypointResult(BaseModel):
    index: int
    lat: float
    lon: float
    terrain_elevation_m: float
    min_safe_altitude_m: float


class MissionComputeResponse(BaseModel):
    mission_type: str
    waypoints: List[MissionWaypointResult]
    legs: List[MissionLeg]
    total_distance_km: float
    mission_duration_hr: float
    total_energy_wh: float
    battery_capacity_wh: float
    battery_usable_wh: float
    battery_margin_pct: float
    cruise_altitude_m: float
    mission_floor_m: float
    terrain_conflict: bool
    warnings: List[str]
    elevation_source: str
    weather: Optional[MissionWeatherResponse] = None


class ReportRequest(BaseModel):
    input: UAVInput
    mission: Optional[MissionComputeResponse] = None
    include_failure_analysis: bool = True
    include_optimization: bool = True


class DesignScoreResponse(BaseModel):
    total: float
    breakdown: dict
    grade: str


class SensitivityPoint(BaseModel):
    parameter_value: float
    recommended_altitude_m: float
    max_altitude_m: float
    rate_of_climb_ms: float
    endurance_hr: float
    range_km: float
    l_over_d: float
    power_required_w: float
    safety_status: str


class Sensitivity2DRequest(BaseModel):
    base_input: UAVInput
    parameter_x: str
    min_x: float
    max_x: float
    parameter_y: str
    min_y: float
    max_y: float
    target: str = "recommended_altitude_m"
    steps: int = 8


class Sensitivity2DPoint(BaseModel):
    x: float
    y: float
    value: float
    safety_status: str


class TrainingBoundsResponse(BaseModel):
    bounds: dict


class FeatureContribution(BaseModel):
    feature: str
    value: float
    training_mean: float
    contribution: float
    direction: str


class LocalExplanationRequest(BaseModel):
    input: UAVInput
    target: str = "recommended_altitude_m"


class LocalExplanationResponse(BaseModel):
    target: str
    baseline_prediction: float
    dataset_mean_prediction: float
    contributions: List[FeatureContribution]
    method: str
