"""
main.py
--------
FastAPI backend for the UAV Flight Envelope Prediction & Altitude
Optimization Platform.

Endpoints
---------
GET  /                          health check
POST /predict                   physics + ML prediction for one UAV config
POST /batch-predict              CSV upload -> predictions for many configs
GET  /feature-importance         model comparison + feature importance data
POST /sensitivity                sweep one parameter, return response curve
POST /report/pdf                 downloadable PDF report for one config
POST /report/csv                 downloadable CSV report for one config

Run with:  uvicorn app.main:app --reload --port 8000   (from backend/)
"""

import os
import io
import csv
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import random
import math
from app import physics, mission
from app.schemas import (
    UAVInput, PredictResponse, PhysicsResult, MLResult, ComparisonEntry,
    EnvelopePoint, FeatureImportanceResponse, SensitivityRequest, SensitivityPoint,
    Sensitivity2DRequest, Sensitivity2DPoint, TrainingBoundsResponse,
    LocalExplanationRequest, LocalExplanationResponse, FeatureContribution,
    OptimizeSuggestionRequest, OptimizeSuggestionResponse, OptimizeSuggestion,
    MissionElevationRequest, MissionElevationResponse, MissionWeatherRequest,
    MissionWeatherResponse, MissionComputeRequest, MissionComputeResponse,
    MissionWaypointResult, MissionLeg,
    AutoDesignRequest, AutoDesignResponse, AutoDesignCandidate,
    FailureScenarioResult, FailureSimulationRequest, FailureSimulationResponse,
    ReportRequest, DesignScoreResponse,
    GeocodeRequest, GeocodeResponse, GeocodeResult,
    MonteCarloRequest, MonteCarloResponse, MonteCarloSummary,
    EpistemicRequest, EpistemicResponse, EpistemicModelPrediction,
    ScatterResponse,
)
from app.dataset_generator import FEATURE_COLUMNS, TARGET_COLUMNS, BOUNDS
from app.report_generator import build_pdf_report, build_csv_report

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

app = FastAPI(
    title="UAV Flight Envelope Prediction & Altitude Optimization API",
    description="Physics-informed ML platform for fixed-wing UAV flight envelope & altitude optimization.",
    version="1.0.0",
)

# CORS - wide open by default for the internship demo; tighten allow_origins
# to your deployed frontend URL before/at deployment (see docs/DEPLOYMENT.md).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load ML artifacts once at startup
# ---------------------------------------------------------------------------
_model = None
_scaler = None
_clf = None
_manifest = None
_model_comparison = None
_feature_means = None
_feature_stds = None
_all_models = None
_scatter_data = None
REG_TARGETS = [t for t in TARGET_COLUMNS if t != "safety_status"]
STATUS_NAMES = {0: "SAFE", 1: "CAUTION", 2: "CRITICAL"}


def _load_artifacts():
    global _model, _scaler, _clf, _manifest, _model_comparison, _feature_means, _feature_stds
    global _all_models, _scatter_data
    import json
    model_path = os.path.join(MODELS_DIR, "best_model.joblib")
    scaler_path = os.path.join(MODELS_DIR, "scaler.joblib")
    clf_path = os.path.join(MODELS_DIR, "safety_classifier.joblib")
    manifest_path = os.path.join(MODELS_DIR, "model_manifest.json")
    comparison_path = os.path.join(MODELS_DIR, "model_comparison.json")
    if not all(os.path.exists(p) for p in [model_path, scaler_path, clf_path, manifest_path]):
        raise RuntimeError(
            "ML model artifacts not found. Run `python -m app.dataset_generator` then "
            "`python -m app.train_model` from the backend/ directory before starting the API."
        )
    _model = joblib.load(model_path)
    _scaler = joblib.load(scaler_path)
    _clf = joblib.load(clf_path)
    with open(manifest_path) as f:
        _manifest = json.load(f)
    if os.path.exists(comparison_path):
        with open(comparison_path) as f:
            _model_comparison = json.load(f)

    # Optional artifacts (only present after a retrain with the current
    # train_model.py) - the API degrades gracefully without them rather
    # than failing to start on an older model directory.
    all_models_path = os.path.join(MODELS_DIR, "all_models.joblib")
    scatter_path = os.path.join(MODELS_DIR, "scatter_data.json")

    # Lazy loading (do NOT load at startup)
    _all_models = None

    if os.path.exists(scatter_path):
        with open(scatter_path) as f:
            _scatter_data = json.load(f)

    # Feature means/stds for local explanation & training-range badges.
    # Prefer computing from the actual training CSV; fall back to the
    # midpoint/quarter-range of the declared sampling BOUNDS if the raw
    # dataset file isn't shipped (e.g. slim deployment).
    # Memory-efficient deployment:
    # Do not load the complete training CSV during API startup.
    _feature_means, _feature_stds = {}, {}

    for c in FEATURE_COLUMNS:
        if c in BOUNDS:
            lo, hi = BOUNDS[c]
            _feature_means[c] = (lo + hi) / 2.0
            _feature_stds[c] = max((hi - lo) / 4.0, 1e-6)
        else:
            _feature_means[c] = 0.0
            _feature_stds[c] = 1.0

@app.on_event("startup")
def startup_event():
    _load_artifacts()


@app.get("/")
def health():
    return {"status": "ok", "service": "uav-flight-envelope-api",
            "model_loaded": _model is not None, "best_model": _manifest["best_model_name"] if _manifest else None}


# ---------------------------------------------------------------------------
# Core computation helpers (shared by /predict, /batch-predict, /sensitivity)
# ---------------------------------------------------------------------------

def _uav_config_from_input(inp: UAVInput) -> physics.UAVConfig:
    # Map the new input schema into the physics engine's expected UAVConfig.
    # Derive missing legacy fields using engineering assumptions so the physics
    # engine can operate unchanged while the external schema uses the new
    # document-specified inputs.
    # Estimate aspect ratio from L/D: simple empirical mapping AR ≈ max(4, min(30, 0.8 * L/D))
    ar_est = max(4.0, min(30.0, 0.8 * inp.l_over_d))
    wingspan = (ar_est * inp.wing_area_m2) ** 0.5
    
    # Solve for cl_max from L/D relation: L/D = Cl / (cd0 + Cl^2/(pi*e*AR))
    e = 0.85
    a = (inp.l_over_d) / (math.pi * e * ar_est)
    b = -1.0
    c = inp.l_over_d * inp.cd0
    cl_max = 1.4
    disc = b * b - 4 * a * c
    if disc >= 0 and abs(a) > 1e-12:
        r1 = (-b + math.sqrt(disc)) / (2 * a)
        r2 = (-b - math.sqrt(disc)) / (2 * a)
        cl_cand = [r for r in (r1, r2) if r > 0]
        if cl_cand:
            cl_max = max(cl_cand)
    
    # Estimate motor power from T/W: Thrust = (T/W)*m*g; Power = Thrust * V / eta
    # For efficiency, clip to physically reasonable range (100 W to 600 kW for diverse scales)
    thrust_n = inp.thrust_to_weight * inp.mass_kg * physics.G0
    motor_power = thrust_n * inp.cruise_speed_ms / max(inp.propulsion_efficiency, 1e-3)
    motor_power = max(100.0, min(600000.0, motor_power))  # clip to sane range

    uav = physics.UAVConfig(
        mass_kg=inp.mass_kg,
        payload_kg=inp.payload_kg,
        wing_area_m2=inp.wing_area_m2,
        wingspan_m=wingspan,
        cl_max=cl_max,
        cd0=inp.cd0,
        oswald_efficiency=e,
        battery_energy_wh=inp.battery_wh * inp.battery_soc,
        motor_max_power_w=motor_power,
        num_engines=1,
        prop_efficiency_static=inp.propulsion_efficiency,
        cruise_speed_ms=inp.cruise_speed_ms,
    )
    # Attach additional sampled inputs for downstream use (reporting, dataset consistency)
    setattr(uav, 'sampled_air_density', inp.air_density_kg_m3)
    setattr(uav, 'sampled_sfc', inp.sfc_kg_per_n_s)
    setattr(uav, 'sampled_fuel_capacity_l', inp.fuel_capacity_l)
    setattr(uav, 'sampled_propeller_diameter_m', inp.propeller_diameter_m)
    setattr(uav, 'sampled_aux_power_w', inp.aux_power_w)
    setattr(uav, 'sampled_thrust_to_weight', inp.thrust_to_weight)
    # Preserve input-facing values for downstream reporting / ML feature row
    setattr(uav, 'sampled_battery_soc', inp.battery_soc)
    setattr(uav, 'sampled_l_over_d', inp.l_over_d)
    return uav



def _run_physics(inp: UAVInput) -> dict:
    uav = _uav_config_from_input(inp)
    envelope = physics.compute_flight_envelope(uav)
    rec_perf = physics.evaluate_altitude(uav, envelope.recommended_altitude_m)
    endurance = physics.endurance_hours(uav, rec_perf)
    rng_km = physics.range_km(rec_perf, endurance)
    engine_out = physics.engine_out_analysis(uav)
    status = physics.classify_status(uav, envelope, engine_out)
    mean_alt = (envelope.min_altitude_m + envelope.max_altitude_m) / 2.0

    profile_sample = envelope.profile[::max(1, len(envelope.profile) // 60)]
    envelope_points = [
        EnvelopePoint(altitude_m=p.altitude_m, rate_of_climb_ms=p.rate_of_climb_ms,
                      power_required_w=p.power_required_w, power_available_w=p.power_available_w,
                      l_over_d=p.l_over_d, feasible=p.feasible)
        for p in profile_sample
    ]

    result = dict(
        min_altitude_m=envelope.min_altitude_m,
        max_altitude_m=envelope.max_altitude_m,
        mean_altitude_m=mean_alt,
        recommended_altitude_m=envelope.recommended_altitude_m,
        recommended_reason=envelope.recommended_reason,
        service_ceiling_m=envelope.service_ceiling_m,
        absolute_ceiling_m=envelope.absolute_ceiling_m,
        rate_of_climb_ms=rec_perf.rate_of_climb_ms,
        range_km=rng_km,
        endurance_hr=endurance,
        power_required_w=rec_perf.power_required_w,
        power_available_w=rec_perf.power_available_w,
        lift_n=rec_perf.lift_n,
        drag_n=rec_perf.drag_n,
        l_over_d=rec_perf.l_over_d,
        stall_speed_ms=rec_perf.stall_speed_ms,
        wing_loading_kg_m2=uav.wing_loading_n_m2 / physics.G0,
        power_loading_w_kg=uav.power_loading_w_kg,
        aspect_ratio=uav.aspect_ratio,
        safety_status=status["status"],
        warnings=status["warnings"],
        engine_out=dict(
            applicable=engine_out.applicable,
            engines_operating=engine_out.engines_operating,
            single_engine_service_ceiling_m=engine_out.single_engine_service_ceiling_m,
            single_engine_roc_at_min_alt_ms=engine_out.single_engine_roc_at_min_alt_ms,
            can_maintain_min_altitude=engine_out.can_maintain_min_altitude,
            power_loss_fraction=engine_out.power_loss_fraction,
        ),
    )
    return result, envelope_points, uav


def _feature_row(uav: physics.UAVConfig) -> pd.DataFrame:
    # Build a feature row matching FEATURE_COLUMNS (the new parameter set)
    # The shipped model artifacts were trained from dataset_generator rows where
    # l_over_d and air_density_kg_m3 came from the physics state at the
    # recommended altitude, not directly from the raw form input. Keep inference
    # aligned with that training contract until the dataset/model are retrained.
    try:
        envelope = physics.compute_flight_envelope(uav)
        rec_perf = physics.evaluate_altitude(uav, envelope.recommended_altitude_m)
        feature_l_over_d = rec_perf.l_over_d
        feature_air_density = rec_perf.rho
    except Exception:
        feature_l_over_d = getattr(uav, 'sampled_l_over_d', max(1.0, getattr(uav, 'power_loading_w_kg', 0.0)))
        feature_air_density = getattr(uav, 'sampled_air_density', physics.RHO0)

    row = {
        "mass_kg": uav.mass_kg,
        "payload_kg": uav.payload_kg,
        "wing_area_m2": uav.wing_area_m2,
        "l_over_d": feature_l_over_d,
        "cd0": uav.cd0,
        "cruise_speed_ms": uav.cruise_speed_ms,
        "air_density_kg_m3": feature_air_density,
        "sfc_kg_per_n_s": getattr(uav, 'sampled_sfc', 0.0),
        "thrust_to_weight": getattr(uav, 'sampled_thrust_to_weight', 0.0),
        "propulsion_efficiency": getattr(uav, 'prop_efficiency_static', 0.75),
        "fuel_capacity_l": getattr(uav, 'sampled_fuel_capacity_l', 0.0),
        "propeller_diameter_m": getattr(uav, 'sampled_propeller_diameter_m', 0.0),
        "battery_wh": getattr(uav, 'battery_energy_wh', 0.0),
        "battery_soc": getattr(uav, 'sampled_battery_soc', 1.0),
        "aux_power_w": getattr(uav, 'sampled_aux_power_w', 0.0),
    }
    # Ensure column order matches FEATURE_COLUMNS
    df = pd.DataFrame([row])
    return df[FEATURE_COLUMNS]


def _run_ml(uav: physics.UAVConfig) -> dict:
    X = _feature_row(uav)
    Xs = _scaler.transform(X)
    pred = _model.predict(Xs)[0]
    reg_vals = dict(zip(REG_TARGETS, [float(v) for v in pred]))

    # Clamp to physically valid ranges. The regressor has no hard physical
    # constraints baked in, so out-of-distribution inputs can occasionally
    # produce e.g. a negative altitude or negative power - clip rather than
    # silently show nonsense to the user.
    altitude_keys = ["min_altitude_m", "max_altitude_m", "recommended_altitude_m",
                      "service_ceiling_m", "absolute_ceiling_m"]
    for k in altitude_keys:
        reg_vals[k] = max(0.0, reg_vals[k])
    for k in ["power_required_w", "lift_n", "drag_n", "range_km", "endurance_hr", "l_over_d"]:
        reg_vals[k] = max(0.0, reg_vals[k])
    # keep min <= recommended <= max <= absolute_ceiling ordering sane for display
    if reg_vals["max_altitude_m"] < reg_vals["min_altitude_m"]:
        reg_vals["max_altitude_m"] = reg_vals["min_altitude_m"]
    reg_vals["recommended_altitude_m"] = min(max(reg_vals["recommended_altitude_m"], reg_vals["min_altitude_m"]),
                                               max(reg_vals["max_altitude_m"], reg_vals["min_altitude_m"]))

    proba = _clf.predict_proba(Xs)[0]
    cls_idx = int(np.argmax(proba))
    confidence = float(proba[cls_idx])
    mean_alt = (reg_vals["min_altitude_m"] + reg_vals["max_altitude_m"]) / 2.0
    reg_vals["mean_altitude_m"] = mean_alt
    reg_vals["safety_status"] = STATUS_NAMES[cls_idx]
    reg_vals["safety_confidence"] = confidence
    reg_vals["model_used"] = _manifest["best_model_name"]

    # Confidence intervals: point prediction +/- test-set RMSE of the best
    # model for that specific target (from model_comparison.json). This is
    # an approximate, per-target uncertainty band - not a Bayesian credible
    # interval - but it's grounded in this model's actual held-out error,
    # which is more honest than a fixed +/-X% placeholder.
    ci = {}
    model_r2 = 0.0
    if _model_comparison and _manifest["best_model_name"] in _model_comparison:
        per_target = _model_comparison[_manifest["best_model_name"]].get("per_target", {})
        model_r2 = _model_comparison[_manifest["best_model_name"]].get("avg", {}).get("R2", 0.0)
        for k, v in reg_vals.items():
            if k in per_target:
                rmse = per_target[k]["RMSE"]
                ci[k] = {"lower": max(0.0, v - rmse), "upper": v + rmse, "rmse": rmse}
    reg_vals["confidence_intervals"] = ci
    reg_vals["model_r2"] = float(max(0.0, min(1.0, model_r2)))
    # Reliability score: blends held-out regression fit quality (R^2) with
    # the safety classifier's own confidence for this specific input.
    reg_vals["reliability_score"] = round(0.5 * reg_vals["model_r2"] + 0.5 * confidence, 4)
    return reg_vals


def _compare(physics_result: dict, ml_result: dict) -> list:
    comparison = []
    shared_keys = ["min_altitude_m", "max_altitude_m", "recommended_altitude_m", "service_ceiling_m",
                   "absolute_ceiling_m", "rate_of_climb_ms", "range_km", "endurance_hr",
                   "power_required_w", "lift_n", "drag_n", "l_over_d"]
    for k in shared_keys:
        pv, mv = physics_result[k], ml_result[k]
        diff_pct = 0.0 if abs(pv) < 1e-9 else (mv - pv) / abs(pv) * 100.0
        comparison.append({"target": k, "physics_value": pv, "ml_value": mv, "difference_pct": diff_pct})
    return comparison


# ---------------------------------------------------------------------------
# Failure simulation (Phase D)
# ---------------------------------------------------------------------------

FAILURE_SCENARIOS = {
    "engine_failure": "Engine Failure (1 of N inoperative)",
    "battery_degradation": "Battery Degradation (-20% capacity)",
    "payload_increase": "Payload Increase (+2 kg)",
    "wind_gusts": "Headwind Gusts (8 m/s)",
    "prop_efficiency_loss": "Propeller Efficiency Loss (-15% relative)",
}


def _delta_summary(baseline: dict, scenario: dict) -> dict:
    keys = ["recommended_altitude_m", "service_ceiling_m", "endurance_hr", "range_km", "rate_of_climb_ms"]
    out = {}
    for k in keys:
        b, s = baseline.get(k, 0.0), scenario.get(k, 0.0)
        out[k] = {"before": b, "after": s, "delta": s - b,
                   "delta_pct": ((s - b) / abs(b) * 100.0) if abs(b) > 1e-9 else 0.0}
    return out


def _simulate_failures(inp: UAVInput, requested: list = None):
    """Runs each failure scenario as a modified physics-engine input (or,
    for engine failure, reuses the engine-out analysis already computed by
    _run_physics) and compares it to the baseline. Wind gusts is explicitly
    flagged as a partial approximation - see its explanation text - since
    the physics engine has no aerodynamic gust-load model."""
    baseline_result, _, uav = _run_physics(inp)
    base_dict = inp.dict()
    results = []
    keys_to_run = requested or list(FAILURE_SCENARIOS.keys())

    if "engine_failure" in keys_to_run:
        eo = baseline_result["engine_out"]
        if eo["applicable"]:
            scenario_vals = dict(baseline_result)
            scenario_vals["service_ceiling_m"] = eo["single_engine_service_ceiling_m"]
            scenario_vals["rate_of_climb_ms"] = eo["single_engine_roc_at_min_alt_ms"]
            new_status = "CRITICAL" if not eo["can_maintain_min_altitude"] else baseline_result["safety_status"]
            results.append(FailureScenarioResult(
                key="engine_failure", label=FAILURE_SCENARIOS["engine_failure"], applicable=True,
                description=f"1 of {uav.num_engines} engines inoperative ({eo['power_loss_fraction'] * 100:.0f}% power loss).",
                baseline_value={"service_ceiling_m": baseline_result["service_ceiling_m"],
                                 "rate_of_climb_ms": baseline_result["rate_of_climb_ms"]},
                scenario_value={"service_ceiling_m": eo["single_engine_service_ceiling_m"],
                                 "rate_of_climb_ms": eo["single_engine_roc_at_min_alt_ms"]},
                deltas=_delta_summary(baseline_result, scenario_vals),
                new_safety_status=new_status,
                explanation=(
                    f"With one engine out, service ceiling drops to {eo['single_engine_service_ceiling_m']:.0f} m "
                    f"and climb rate at the minimum operating altitude becomes "
                    f"{eo['single_engine_roc_at_min_alt_ms']:.2f} m/s. "
                    + ("The aircraft can still maintain minimum altitude." if eo["can_maintain_min_altitude"]
                       else "The aircraft CANNOT maintain minimum altitude on the remaining engine(s) - "
                            "this is a critical contingency.")
                ),
            ))
        else:
            results.append(FailureScenarioResult(
                key="engine_failure", label=FAILURE_SCENARIOS["engine_failure"], applicable=False,
                description="Single-engine aircraft - no redundant engine to lose.",
                baseline_value={}, scenario_value={}, deltas={}, new_safety_status=baseline_result["safety_status"],
                explanation="Not applicable: this configuration has only 1 engine.",
            ))

    if "battery_degradation" in keys_to_run:
        d = dict(base_dict)
        d["battery_wh"] = base_dict["battery_wh"] * 0.8
        scenario_result, _, _ = _run_physics(UAVInput(**d))
        results.append(FailureScenarioResult(
            key="battery_degradation", label=FAILURE_SCENARIOS["battery_degradation"], applicable=True,
            description="Simulates a battery pack degraded to 80% of rated capacity.",
            baseline_value={"endurance_hr": baseline_result["endurance_hr"], "range_km": baseline_result["range_km"]},
            scenario_value={"endurance_hr": scenario_result["endurance_hr"], "range_km": scenario_result["range_km"]},
            deltas=_delta_summary(baseline_result, scenario_result),
            new_safety_status=scenario_result["safety_status"],
            explanation=(
                f"Endurance falls from {baseline_result['endurance_hr']:.2f} hr to "
                f"{scenario_result['endurance_hr']:.2f} hr and range from {baseline_result['range_km']:.0f} km "
                f"to {scenario_result['range_km']:.0f} km."
            ),
        ))

    if "payload_increase" in keys_to_run:
        d = dict(base_dict)
        new_payload = min(15.0, base_dict["payload_kg"] + 2.0)
        added = new_payload - base_dict["payload_kg"]
        d["payload_kg"] = new_payload
        d["mass_kg"] = min(60.0, base_dict["mass_kg"] + added)
        try:
            scenario_result, _, _ = _run_physics(UAVInput(**d))
            results.append(FailureScenarioResult(
                key="payload_increase", label=FAILURE_SCENARIOS["payload_increase"], applicable=True,
                description=f"Simulates an unplanned +{added:.1f} kg payload addition.",
                baseline_value={"recommended_altitude_m": baseline_result["recommended_altitude_m"],
                                 "rate_of_climb_ms": baseline_result["rate_of_climb_ms"]},
                scenario_value={"recommended_altitude_m": scenario_result["recommended_altitude_m"],
                                 "rate_of_climb_ms": scenario_result["rate_of_climb_ms"]},
                deltas=_delta_summary(baseline_result, scenario_result),
                new_safety_status=scenario_result["safety_status"],
                explanation=(
                    f"Extra weight reduces climb rate to {scenario_result['rate_of_climb_ms']:.2f} m/s "
                    f"(from {baseline_result['rate_of_climb_ms']:.2f} m/s) and shifts recommended altitude to "
                    f"{scenario_result['recommended_altitude_m']:.0f} m."
                ),
            ))
        except Exception:
            pass

    if "wind_gusts" in keys_to_run:
        headwind = 8.0
        cruise = base_dict["cruise_speed_ms"]
        ground_speed_ratio = max(0.05, (cruise - headwind) / cruise)
        scenario_result = dict(baseline_result)
        scenario_result["range_km"] = baseline_result["range_km"] * ground_speed_ratio
        results.append(FailureScenarioResult(
            key="wind_gusts", label=FAILURE_SCENARIOS["wind_gusts"], applicable=True,
            description=f"Simulates a sustained {headwind:.0f} m/s headwind component.",
            baseline_value={"range_km": baseline_result["range_km"]},
            scenario_value={"range_km": scenario_result["range_km"]},
            deltas=_delta_summary(baseline_result, scenario_result),
            new_safety_status=baseline_result["safety_status"],
            explanation=(
                f"A {headwind:.0f} m/s headwind doesn't change true airspeed or power draw (endurance is "
                f"unaffected), but it reduces ground speed and therefore ground-covered range from "
                f"{baseline_result['range_km']:.0f} km to {scenario_result['range_km']:.0f} km. This is a "
                f"partial, range-only approximation - the physics engine has no aerodynamic gust-load or "
                f"control-authority model, so real-world gust effects on stall margin aren't captured here."
            ),
        ))

    if "prop_efficiency_loss" in keys_to_run:
        d = dict(base_dict)
        d["propulsion_efficiency"] = max(0.31, base_dict["propulsion_efficiency"] * 0.85)
        scenario_result, _, _ = _run_physics(UAVInput(**d))
        results.append(FailureScenarioResult(
            key="prop_efficiency_loss", label=FAILURE_SCENARIOS["prop_efficiency_loss"], applicable=True,
            description="Simulates propeller wear/damage causing a 15% relative efficiency loss.",
            baseline_value={"range_km": baseline_result["range_km"], "endurance_hr": baseline_result["endurance_hr"]},
            scenario_value={"range_km": scenario_result["range_km"], "endurance_hr": scenario_result["endurance_hr"]},
            deltas=_delta_summary(baseline_result, scenario_result),
            new_safety_status=scenario_result["safety_status"],
            explanation=(
                f"Reduced propeller efficiency raises electrical power draw for the same thrust, cutting "
                f"endurance to {scenario_result['endurance_hr']:.2f} hr and range to "
                f"{scenario_result['range_km']:.0f} km."
            ),
        ))

    return baseline_result, results


# ---------------------------------------------------------------------------
# Design score (Phase D)
# ---------------------------------------------------------------------------

def _design_score(physics_result: dict, ml_result: dict) -> dict:
    status = physics_result["safety_status"]
    safety_pts = {"SAFE": 40, "CAUTION": 22, "CRITICAL": 0}.get(status, 10)
    ld = physics_result["l_over_d"]
    ld_pts = max(0.0, min(25.0, (ld / 20.0) * 25.0))
    power_margin = 0.0
    if physics_result["power_available_w"] > 0:
        power_margin = (physics_result["power_available_w"] - physics_result["power_required_w"]) / physics_result["power_available_w"]
    margin_pts = max(0.0, min(20.0, power_margin * 100 * 0.8))
    reliability_pts = max(0.0, min(15.0, ml_result.get("reliability_score", 0) * 15))
    total = round(safety_pts + ld_pts + margin_pts + reliability_pts, 1)
    grade = "A" if total >= 85 else "B" if total >= 70 else "C" if total >= 55 else "D" if total >= 40 else "F"
    return {
        "total": total,
        "breakdown": {
            "safety_status": {"points": safety_pts, "max": 40, "detail": status},
            "aerodynamic_efficiency_l_over_d": {"points": round(ld_pts, 1), "max": 25, "detail": f"L/D = {ld:.2f}"},
            "power_margin": {"points": round(margin_pts, 1), "max": 20, "detail": f"{power_margin * 100:.0f}% margin"},
            "ml_reliability": {"points": round(reliability_pts, 1), "max": 15,
                                "detail": f"{ml_result.get('reliability_score', 0) * 100:.0f}% reliability"},
        },
        "grade": grade,
    }


# ---------------------------------------------------------------------------
# Auto Design Optimizer / inverse design (Phase D)
# ---------------------------------------------------------------------------

AUTO_DESIGN_BOUNDS = {
    "wing_area_m2": (0.1, 2.0),
    "battery_wh": (200.0, 4000.0),
    "mass_kg": (2.0, 60.0),
    "cruise_speed_ms": (8.0, 35.0),
    "l_over_d": (4.0, 25.0),
}


def _auto_design_objective(inp: UAVInput, target_endurance, target_range):
    try:
        r, _, _ = _run_physics(inp)
    except Exception:
        return None, 1e9
    err = 0.0
    if target_endurance is not None:
        err += ((r["endurance_hr"] - target_endurance) / max(target_endurance, 1e-6)) ** 2
    if target_range is not None:
        err += ((r["range_km"] - target_range) / max(target_range, 1e-6)) ** 2
    if r["safety_status"] == "CRITICAL":
        err += 5.0
    elif r["safety_status"] == "CAUTION":
        err += 0.5
    return r, err


def _auto_design_search(req: AutoDesignRequest) -> AutoDesignResponse:
    """Inverse design via random search + coordinate-descent local
    refinement, using the (fast) physics engine as the objective evaluator.
    This is NOT a gradient-based or provably-optimal optimizer - it's a
    practical, dependency-free search that reliably finds good, physically
    valid designs within the sampling bounds in well under a second."""
    if req.target_endurance_hr is None and req.target_range_km is None:
        raise HTTPException(400, "Provide at least one of target_endurance_hr or target_range_km.")

    if req.seed_input:
        seed = req.seed_input.dict()
    else:
        seed = UAVInput(
            mass_kg=max(req.payload_kg + 5, 8), payload_kg=req.payload_kg, wing_area_m2=0.5,
            l_over_d=12.0, cd0=0.028, air_density_kg_m3=1.225, sfc_kg_per_n_s=0.0,
            thrust_to_weight=0.25, propulsion_efficiency=0.75, fuel_capacity_l=0.0,
            propeller_diameter_m=0.5, battery_wh=1200.0, battery_soc=1.0, aux_power_w=20.0,
            cruise_speed_ms=18.0,
        ).dict()
    seed["payload_kg"] = req.payload_kg
    seed["mass_kg"] = max(seed["mass_kg"], req.payload_kg + 3)

    rnd = random.Random(42)

    def build(vals):
        d = dict(seed)
        d.update(vals)
        d["payload_kg"] = req.payload_kg
        d["mass_kg"] = max(d["mass_kg"], req.payload_kg + 1.0)
        return d

    n_random = max(50, req.iterations // 2)
    pool = []
    for _ in range(n_random):
        vals = {k: rnd.uniform(lo, hi) for k, (lo, hi) in AUTO_DESIGN_BOUNDS.items()}
        d = build(vals)
        try:
            inp = UAVInput(**d)
        except Exception:
            continue
        r, err = _auto_design_objective(inp, req.target_endurance_hr, req.target_range_km)
        if r is not None:
            pool.append((err, d, r))

    pool.sort(key=lambda x: x[0])
    top = pool[:8]

    refined = []
    remaining_iters = max(0, req.iterations - n_random)
    per_candidate_iters = max(10, remaining_iters // max(1, len(top))) if top else 0
    for err0, d0, r0 in top:
        best_err, best_d, best_r = err0, dict(d0), r0
        for _ in range(per_candidate_iters):
            k = rnd.choice(list(AUTO_DESIGN_BOUNDS.keys()))
            lo, hi = AUTO_DESIGN_BOUNDS[k]
            span = hi - lo
            trial = dict(best_d)
            trial[k] = min(hi, max(lo, best_d[k] + rnd.uniform(-0.08, 0.08) * span))
            trial["payload_kg"] = req.payload_kg
            trial["mass_kg"] = max(trial["mass_kg"], req.payload_kg + 1.0)
            try:
                inp = UAVInput(**trial)
            except Exception:
                continue
            r, err = _auto_design_objective(inp, req.target_endurance_hr, req.target_range_km)
            if r is not None and err < best_err:
                best_err, best_d, best_r = err, trial, r
        refined.append((best_err, best_d, best_r))

    refined.sort(key=lambda x: x[0])
    if not refined:
        raise HTTPException(500, "Auto-design search failed to find any valid candidate within bounds.")

    def to_candidate(item):
        err, d, r = item
        return AutoDesignCandidate(
            input=UAVInput(**d), achieved_endurance_hr=r["endurance_hr"], achieved_range_km=r["range_km"],
            achieved_recommended_altitude_m=r["recommended_altitude_m"], safety_status=r["safety_status"],
            score=round(1.0 / (1.0 + err), 4),
        )

    best = to_candidate(refined[0])
    alternatives = [to_candidate(x) for x in refined[1:4]]

    return AutoDesignResponse(
        target_endurance_hr=req.target_endurance_hr, target_range_km=req.target_range_km,
        best=best, alternatives=alternatives,
        iterations_run=n_random + per_candidate_iters * len(top),
        method="random_search_plus_coordinate_refinement",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/predict", response_model=PredictResponse)
def predict(inp: UAVInput):
    physics_result, envelope_points, uav = _run_physics(inp)
    ml_result = _run_ml(uav)
    comparison = _compare(physics_result, ml_result)
    return PredictResponse(
        input=inp,
        physics=PhysicsResult(**physics_result, envelope_profile=envelope_points),
        ml=MLResult(**ml_result),
        comparison=[ComparisonEntry(**c) for c in comparison],
    )


@app.post("/batch-predict")
async def batch_predict(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Please upload a .csv file.")
    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Could not parse CSV: {e}")

    required = [
        "mass_kg", "payload_kg", "wing_area_m2", "l_over_d", "cd0", "cruise_speed_ms",
        "air_density_kg_m3", "sfc_kg_per_n_s", "thrust_to_weight", "propulsion_efficiency",
        "fuel_capacity_l", "propeller_diameter_m", "battery_wh", "battery_soc", "aux_power_w",
    ]
    optional_defaults = {}
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(400, f"CSV missing required columns: {missing}")

    rows_out = []
    for _, r in df.iterrows():
        try:
            payload = {c: float(r[c]) for c in required}
            # aircraft_name may be provided as an optional string column
            if 'aircraft_name' in df.columns:
                payload['aircraft_name'] = str(r['aircraft_name'])
            inp = UAVInput(**payload)
        except Exception as e:
            rows_out.append({"error": str(e)})
            continue
        physics_result, _, uav = _run_physics(inp)
        ml_result = _run_ml(uav)
        rows_out.append({
            **{c: getattr(inp, c) for c in required},
            "num_engines": uav.num_engines,
            "physics_recommended_altitude_m": physics_result["recommended_altitude_m"],
            "physics_min_altitude_m": physics_result["min_altitude_m"],
            "physics_max_altitude_m": physics_result["max_altitude_m"],
            "physics_service_ceiling_m": physics_result["service_ceiling_m"],
            "physics_safety_status": physics_result["safety_status"],
            "ml_recommended_altitude_m": ml_result["recommended_altitude_m"],
            "ml_min_altitude_m": ml_result["min_altitude_m"],
            "ml_max_altitude_m": ml_result["max_altitude_m"],
            "ml_safety_status": ml_result["safety_status"],
            "ml_safety_confidence": ml_result["safety_confidence"],
        })

    return {"n_rows": len(rows_out), "results": rows_out}


@app.get("/feature-importance", response_model=FeatureImportanceResponse)
def feature_importance():
    import json
    with open(os.path.join(MODELS_DIR, "model_comparison.json")) as f:
        comparison = json.load(f)
    return FeatureImportanceResponse(
        best_model_name=_manifest["best_model_name"],
        permutation_importance=_manifest["permutation_importance"],
        native_feature_importance=_manifest["native_feature_importance"],
        model_comparison=comparison,
        safety_classifier_accuracy=_manifest["safety_classifier_accuracy"],
    )


@app.post("/sensitivity", response_model=list[SensitivityPoint])
def sensitivity(req: SensitivityRequest):
    if req.parameter not in req.base_input.dict():
        raise HTTPException(400, f"Unknown parameter '{req.parameter}'")
    points = []
    values = np.linspace(req.min_value, req.max_value, max(2, req.steps))
    for v in values:
        data = req.base_input.dict()
        # int-typed fields (currently only num_engines) must stay whole numbers
        is_int_field = isinstance(data[req.parameter], int) and not isinstance(data[req.parameter], bool)
        data[req.parameter] = round(float(v)) if is_int_field else float(v)
        inp = UAVInput(**data)
        physics_result, _, uav = _run_physics(inp)
        points.append(SensitivityPoint(
            parameter_value=float(v),
            recommended_altitude_m=physics_result["recommended_altitude_m"],
            max_altitude_m=physics_result["max_altitude_m"],
            rate_of_climb_ms=physics_result["rate_of_climb_ms"],
            endurance_hr=physics_result["endurance_hr"],
            range_km=physics_result["range_km"],
            l_over_d=physics_result["l_over_d"],
            power_required_w=physics_result["power_required_w"],
            safety_status=physics_result["safety_status"],
        ))
    return points


@app.post("/sensitivity-2d", response_model=list[Sensitivity2DPoint])
def sensitivity_2d(req: Sensitivity2DRequest):
    """Sweep two parameters simultaneously over a grid (physics engine only -
    fast enough to run at request time) for multi-parameter sensitivity
    heatmaps (e.g. Mass vs Motor Power)."""
    base = req.base_input.dict()
    if req.parameter_x not in base or req.parameter_y not in base:
        raise HTTPException(400, "Unknown parameter_x or parameter_y")
    if req.target not in ("recommended_altitude_m", "range_km", "endurance_hr",
                           "rate_of_climb_ms", "l_over_d", "power_required_w"):
        raise HTTPException(400, f"Unsupported target '{req.target}'")

    steps = max(3, min(req.steps, 14))
    xs = np.linspace(req.min_x, req.max_x, steps)
    ys = np.linspace(req.min_y, req.max_y, steps)
    points = []
    for xv in xs:
        for yv in ys:
            data = dict(base)
            for key, val in ((req.parameter_x, xv), (req.parameter_y, yv)):
                is_int_field = isinstance(data[key], int) and not isinstance(data[key], bool)
                data[key] = round(float(val)) if is_int_field else float(val)
            try:
                inp = UAVInput(**data)
                physics_result, _, _ = _run_physics(inp)
                points.append(Sensitivity2DPoint(
                    x=float(xv), y=float(yv),
                    value=physics_result[req.target],
                    safety_status=physics_result["safety_status"],
                ))
            except Exception:
                points.append(Sensitivity2DPoint(x=float(xv), y=float(yv), value=0.0, safety_status="CRITICAL"))
    return points


@app.get("/training-bounds", response_model=TrainingBoundsResponse)
def training_bounds():
    """Sampling bounds used to generate the ML training data - the frontend
    uses these to badge each input as within / near-boundary / outside the
    ML model's training distribution."""
    return TrainingBoundsResponse(bounds={k: list(v) for k, v in BOUNDS.items()})


# ---------------------------------------------------------------------------
# Uncertainty Quantification: aleatoric (Monte Carlo through the physics
# engine) + epistemic (cross-model prediction spread)
# ---------------------------------------------------------------------------

# Aleatoric: irreducible, real-world variability in physical parameters
# (manufacturing tolerance, cell-to-cell battery capacity spread,
# aerodynamic surface-finish variation) - modeled here as independent
# normal perturbations propagated through the physics engine via Monte
# Carlo sampling, the same technique used for the reference study this
# platform's methodology was benchmarked against.
ALEATORIC_PARAMS = ["mass_kg", "cd0", "battery_wh", "propulsion_efficiency"]


@app.post("/uncertainty/monte-carlo", response_model=MonteCarloResponse)
def uncertainty_monte_carlo(req: MonteCarloRequest):
    base = req.base_input.dict()
    std_pct = {
        "mass_kg": req.mass_std_pct, "cd0": req.cd0_std_pct,
        "battery_wh": req.battery_std_pct, "propulsion_efficiency": req.prop_eff_std_pct,
    }
    rng = np.random.RandomState(42)
    n = req.n_samples

    samples = {p: rng.normal(base[p], base[p] * (std_pct[p] / 100.0), size=n) for p in ALEATORIC_PARAMS}
    # clip to physically sane, schema-valid ranges
    samples["mass_kg"] = np.clip(samples["mass_kg"], 0.5, 3000)
    samples["cd0"] = np.clip(samples["cd0"], 0.006, 0.08)
    samples["battery_wh"] = np.clip(samples["battery_wh"], 50, 150000)
    samples["propulsion_efficiency"] = np.clip(samples["propulsion_efficiency"], 0.3, 0.99)

    endurance_vals, range_vals, alt_vals = [], [], []
    for i in range(n):
        trial = dict(base)
        for p in ALEATORIC_PARAMS:
            trial[p] = float(samples[p][i])
        try:
            trial_input = UAVInput(**trial)
            r, _, _ = _run_physics(trial_input)
            endurance_vals.append(r["endurance_hr"])
            range_vals.append(r["range_km"])
            alt_vals.append(r["recommended_altitude_m"])
        except Exception:
            continue

    def summarize(vals: list) -> MonteCarloSummary:
        arr = np.array(vals)
        return MonteCarloSummary(
            mean=float(arr.mean()), std=float(arr.std()),
            ci_95_low=float(np.percentile(arr, 2.5)), ci_95_high=float(np.percentile(arr, 97.5)),
            samples=[float(v) for v in arr],
        )

    return MonteCarloResponse(
        n_samples=len(endurance_vals),
        endurance_hr=summarize(endurance_vals),
        range_km=summarize(range_vals),
        recommended_altitude_m=summarize(alt_vals),
        method="monte_carlo_normal_perturbation_through_physics_engine",
        perturbed_parameters={p: std_pct[p] for p in ALEATORIC_PARAMS},
    )


# Epistemic: uncertainty from limited model knowledge - operationalized
# here as the spread of predictions across independently-trained
# algorithms (Linear Regression, Random Forest, Extra Trees, Gradient
# Boosting, XGBoost - SVR and Gaussian Process are excluded from this
# on-disk ensemble purely for artifact size, see train_model.py) for the
# same input. This is the same "ensemble disagreement" proxy used in
# deep-ensemble uncertainty literature: models that agree closely are in a
# well-understood region of the design space; models that diverge signal
# the surrogate is less certain there, independent of any single model's
# own error bars.
@app.post("/uncertainty/epistemic", response_model=EpistemicResponse)
def uncertainty_epistemic(req: EpistemicRequest):
    global _all_models

    if _all_models is None:
        all_models_path = os.path.join(MODELS_DIR, "all_models.joblib")

        if not os.path.exists(all_models_path):
            raise HTTPException(
                status_code=503,
                detail="All-model ensemble not available."
            )

        _all_models = joblib.load(all_models_path)

    if req.target not in REG_TARGETS:
        raise HTTPException(
            400,
            f"Unknown target '{req.target}'. Choose from {REG_TARGETS}"
        )

    uav = _uav_config_from_input(req.input)
    row = _feature_row(uav)
    Xs = _scaler.transform(row)
    target_idx = REG_TARGETS.index(req.target)

    predictions = []

    for name, model in _all_models.items():
        try:
            pred = float(model.predict(Xs)[0][target_idx])
        except Exception:
            continue

        test_r2 = 0.0
        if _model_comparison and name in _model_comparison:
            test_r2 = _model_comparison[name]["per_target"].get(req.target, {}).get("R2", 0.0)

        predictions.append(
            EpistemicModelPrediction(
                model=name,
                value=pred,
                test_r2=test_r2
            )
        )

    values = np.array([p.value for p in predictions])
    mean_v = float(values.mean()) if len(values) else 0.0
    std_v = float(values.std()) if len(values) else 0.0
    spread_pct = (std_v / abs(mean_v) * 100.0) if abs(mean_v) > 1e-9 else 0.0

    return EpistemicResponse(
        target=req.target,
        predictions=predictions,
        mean=mean_v,
        std=std_v,
        spread_pct=spread_pct,
        method="cross_model_prediction_spread",
    )


@app.get("/uncertainty/scatter", response_model=ScatterResponse)
def uncertainty_scatter():
    """True-vs-predicted scatter data (held-out test set, capped sample)
    for every trained model, for range/endurance/recommended-altitude."""
    if _scatter_data is None:
        raise HTTPException(503, "Scatter data not available - retrain with the current train_model.py to enable this.")
    return ScatterResponse(data=_scatter_data)


@app.post("/explain", response_model=LocalExplanationResponse)
def explain(req: LocalExplanationRequest):
    """Local, per-prediction feature attribution via one-at-a-time occlusion:
    for each feature, replace it with the training-set mean (holding all
    others at their current value) and measure how much the model's
    prediction for `target` moves. This is a real, cheap, model-agnostic
    local explanation method (an approximation in the spirit of SHAP, not
    an exact Shapley-value computation, since we don't compute the full
    coalition/permutation game)."""
    if req.target not in REG_TARGETS:
        raise HTTPException(400, f"Unknown target '{req.target}'. Choose from {REG_TARGETS}")

    uav = _uav_config_from_input(req.input)
    row = _feature_row(uav)
    Xs = _scaler.transform(row)
    target_idx = REG_TARGETS.index(req.target)
    baseline_pred = float(_model.predict(Xs)[0][target_idx])

    # prediction if every feature were at its training-set mean
    mean_row = row.copy()
    for c in FEATURE_COLUMNS:
        mean_row[c] = _feature_means.get(c, row[c].iloc[0])
    mean_Xs = _scaler.transform(mean_row)
    dataset_mean_pred = float(_model.predict(mean_Xs)[0][target_idx])

    contributions = []
    for c in FEATURE_COLUMNS:
        perturbed = row.copy()
        perturbed[c] = _feature_means.get(c, row[c].iloc[0])
        p_Xs = _scaler.transform(perturbed)
        p_pred = float(_model.predict(p_Xs)[0][target_idx])
        # positive contribution = this feature's current value pushes the
        # prediction UP relative to swapping it for the dataset average
        contribution = baseline_pred - p_pred
        contributions.append(FeatureContribution(
            feature=c,
            value=float(row[c].iloc[0]),
            training_mean=float(_feature_means.get(c, 0.0)),
            contribution=contribution,
            direction="increases" if contribution > 0 else ("decreases" if contribution < 0 else "neutral"),
        ))
    contributions.sort(key=lambda fc: abs(fc.contribution), reverse=True)

    return LocalExplanationResponse(
        target=req.target,
        baseline_prediction=baseline_pred,
        dataset_mean_prediction=dataset_mean_pred,
        contributions=contributions,
        method="occlusion_one_at_a_time",
    )


@app.post("/report/pdf")
def report_pdf(req: ReportRequest):
    inp = req.input
    physics_result, envelope_points, uav = _run_physics(inp)
    ml_result = _run_ml(uav)
    comparison = _compare(physics_result, ml_result)

    local_explanation = None
    optimize_range = None
    optimize_endurance = None
    failure_results = None
    score = None

    try:
        exp = explain(LocalExplanationRequest(input=inp, target="recommended_altitude_m"))
        local_explanation = exp.dict()
    except Exception:
        pass

    if req.include_optimization:
        try:
            optimize_range = [s.dict() for s in optimize_suggestions(
                OptimizeSuggestionRequest(base_input=inp, target="range_km")).suggestions]
            optimize_endurance = [s.dict() for s in optimize_suggestions(
                OptimizeSuggestionRequest(base_input=inp, target="endurance_hr")).suggestions]
        except Exception:
            pass

    if req.include_failure_analysis:
        try:
            _, fr = _simulate_failures(inp)
            failure_results = [f.dict() for f in fr]
        except Exception:
            pass

    try:
        score = _design_score(physics_result, ml_result)
    except Exception:
        pass

    mission_dict = req.mission.dict() if req.mission else None

    pdf_bytes = build_pdf_report(
        inp.dict(), physics_result, ml_result, comparison,
        local_explanation=local_explanation, optimize_range=optimize_range,
        optimize_endurance=optimize_endurance, failure_results=failure_results,
        design_score=score, mission=mission_dict,
        flight_profile_image=req.flight_profile_image,
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=uav_flight_envelope_report.pdf"},
    )


@app.post("/report/csv")
def report_csv(inp: UAVInput):
    physics_result, envelope_points, uav = _run_physics(inp)
    ml_result = _run_ml(uav)
    csv_text = build_csv_report(inp.dict(), physics_result, ml_result)
    return StreamingResponse(
        io.StringIO(csv_text), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=uav_flight_envelope_report.csv"},
    )


# ---------------------------------------------------------------------------
# Optimization suggestions (Range / Endurance) - Phase B
# ---------------------------------------------------------------------------

OPTIMIZE_FIELDS = {
    "mass_kg": (0.5, 3000, "Total Mass"),
    "wing_area_m2": (0.3, 25.0, "Wing Area"),
    "cd0": (0.006, 0.08, "Zero-Lift Drag Coefficient"),
    "propulsion_efficiency": (0.3, 0.99, "Propulsion Efficiency"),
    "battery_wh": (50, 150000, "Battery Capacity (Wh)"),
    "cruise_speed_ms": (5, 60, "Cruise Speed"),
    "l_over_d": (4.0, 30.0, "Lift-to-Drag Ratio"),
    "thrust_to_weight": (0.05, 1.5, "Thrust-to-Weight Ratio"),
}


@app.post("/auto-design", response_model=AutoDesignResponse)
def auto_design(req: AutoDesignRequest):
    return _auto_design_search(req)


@app.post("/failure-simulation", response_model=FailureSimulationResponse)
def failure_simulation(req: FailureSimulationRequest):
    baseline_result, results = _simulate_failures(req.input, req.scenarios)
    return FailureSimulationResponse(baseline_safety_status=baseline_result["safety_status"], results=results)


@app.post("/design-score", response_model=DesignScoreResponse)
def design_score(inp: UAVInput):
    physics_result, _, uav = _run_physics(inp)
    ml_result = _run_ml(uav)
    score = _design_score(physics_result, ml_result)
    return DesignScoreResponse(**score)


@app.post("/optimize-suggestions", response_model=OptimizeSuggestionResponse)
def optimize_suggestions(req: OptimizeSuggestionRequest):
    """One-at-a-time physics-engine sensitivity used to rank the most
    impactful single-parameter changes for improving Range or Endurance.
    This is NOT a joint/global optimizer (it doesn't search combinations of
    changes together) - each suggestion holds everything else fixed at the
    current configuration, which is stated explicitly in its rationale."""
    if req.target not in ("range_km", "endurance_hr", "recommended_altitude_m"):
        raise HTTPException(400, "target must be 'range_km', 'endurance_hr', or 'recommended_altitude_m'")

    base_result, _, _ = _run_physics(req.base_input)
    baseline_value = base_result[req.target]
    base_dict = req.base_input.dict()

    suggestions = []
    for field, (lo, hi, label) in OPTIMIZE_FIELDS.items():
        current = base_dict[field]
        best = None  # (trial_value, trial_target, change_pct)
        for direction in (0.10, -0.10):
            trial_value = max(lo, min(hi, current * (1 + direction)))
            if abs(trial_value - current) < 1e-9:
                continue
            trial_dict = dict(base_dict)
            trial_dict[field] = trial_value
            try:
                trial_input = UAVInput(**trial_dict)
                trial_result, _, _ = _run_physics(trial_input)
                trial_target = trial_result[req.target]
            except Exception:
                continue
            change_pct = ((trial_target - baseline_value) / abs(baseline_value)) * 100 if baseline_value else 0
            if best is None or change_pct > best[2]:
                best = (trial_value, trial_target, change_pct)
        if best is None:
            continue
        trial_value, trial_target, change_pct = best
        if change_pct <= 0.05:
            continue  # not a meaningful improvement in this direction
        direction_word = "Increasing" if trial_value > current else "Decreasing"
        rationale = (
            f"{direction_word} {label.lower()} from {current:.3g} to {trial_value:.3g} "
            f"({(trial_value / current - 1) * 100:+.1f}%) is projected to move "
            f"{req.target.replace('_', ' ')} from {baseline_value:.2f} to {trial_target:.2f} "
            f"({change_pct:+.1f}%), holding every other parameter fixed at its current value."
        )
        suggestions.append(OptimizeSuggestion(
            parameter=field, label=label, current_value=current, suggested_value=trial_value,
            change_pct=(trial_value / current - 1) * 100 if current else 0.0,
            projected_target_value=trial_target, projected_change_pct=change_pct, rationale=rationale,
        ))

    suggestions.sort(key=lambda s: s.projected_change_pct, reverse=True)
    return OptimizeSuggestionResponse(target=req.target, baseline_value=baseline_value, suggestions=suggestions[:6])


# ---------------------------------------------------------------------------
# Mission Planner - Phase C (Leaflet map + terrain + weather, frontend side)
# ---------------------------------------------------------------------------

@app.post("/mission/elevation", response_model=MissionElevationResponse)
def mission_elevation(req: MissionElevationRequest):
    points = [(p.lat, p.lon) for p in req.points]
    elevations, source, available = mission.fetch_elevations(points)
    return MissionElevationResponse(elevations_m=elevations, source=source, available=available)


@app.post("/mission/weather", response_model=MissionWeatherResponse)
def mission_weather(req: MissionWeatherRequest):
    data = mission.fetch_weather(req.lat, req.lon)
    return MissionWeatherResponse(**data)


@app.post("/mission/geocode", response_model=GeocodeResponse)
def mission_geocode(req: GeocodeRequest):
    results, available = mission.geocode_search(req.query, req.limit)
    return GeocodeResponse(results=[GeocodeResult(**r) for r in results], available=available)


@app.post("/mission/compute", response_model=MissionComputeResponse)
def mission_compute(req: MissionComputeRequest):
    """Combines the physics engine with real terrain elevation (Open-Meteo)
    to compute a terrain-aware minimum safe altitude, then a cruise
    altitude, per-leg energy consumption, and total mission energy/duration.
    Live weather is fetched for situational awareness but is NOT yet fed
    back into the physics engine (which still assumes a fixed ISA
    atmosphere column - see the Sensitivity page for that scope note)."""
    if len(req.waypoints) < 2:
        raise HTTPException(400, "Provide at least 2 waypoints to compute a mission.")

    points = [(w.lat, w.lon) for w in req.waypoints]
    elevations, elev_source, elev_available = mission.fetch_elevations(points)

    physics_result, _, uav = _run_physics(req.input)
    min_safe_alts = [e + req.altitude_buffer_m for e in elevations]
    mission_floor = max(min_safe_alts)
    cruise_altitude = min(max(physics_result["recommended_altitude_m"], mission_floor),
                           physics_result["service_ceiling_m"])
    terrain_conflict = mission_floor > physics_result["service_ceiling_m"]

    perf = physics.evaluate_altitude(uav, cruise_altitude)
    eta = physics.prop_efficiency_at_altitude(uav, perf.sigma)
    p_elec_w = perf.power_required_w / max(eta, 1e-6)

    waypoint_results = [
        MissionWaypointResult(index=i, lat=w.lat, lon=w.lon, terrain_elevation_m=elevations[i],
                               min_safe_altitude_m=min_safe_alts[i])
        for i, w in enumerate(req.waypoints)
    ]

    legs, total_distance, total_energy, total_time = [], 0.0, 0.0, 0.0
    cruise_kmh = uav.cruise_speed_ms * 3.6
    for i in range(len(points) - 1):
        d = mission.haversine_km(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])
        t = d / cruise_kmh if cruise_kmh > 0 else 0.0
        e = p_elec_w * t
        legs.append(MissionLeg(from_index=i, to_index=i + 1, distance_km=d, time_hr=t, energy_wh=e))
        total_distance += d
        total_time += t
        total_energy += e

    battery_reserve_frac = 0.20
    usable_energy = req.input.battery_wh * (1 - battery_reserve_frac)
    battery_margin_pct = (((usable_energy - total_energy) / req.input.battery_wh) * 100
                           if req.input.battery_wh else 0.0)

    warnings = []
    if terrain_conflict:
        warnings.append(
            f"Terrain along the route requires a minimum safe altitude of {mission_floor:.0f} m, which "
            f"exceeds this aircraft's service ceiling ({physics_result['service_ceiling_m']:.0f} m). "
            "Reduce payload/mass, increase motor power, or re-route away from high terrain."
        )
    if total_energy > usable_energy:
        warnings.append(
            f"Estimated mission energy ({total_energy:.0f} Wh) exceeds usable battery capacity "
            f"({usable_energy:.0f} Wh, after a 20% reserve) - this mission is not flyable as planned. "
            "Add battery capacity, shorten the route, or reduce cruise speed."
        )
    if not elev_available:
        warnings.append("Terrain elevation service was unreachable - assumed flat 0 m terrain; verify manually before flight.")
    if not warnings:
        warnings.append("No conflicts detected - mission is within the aircraft's altitude and energy margins.")

    weather_resp = None
    if points:
        weather_resp = MissionWeatherResponse(**mission.fetch_weather(points[0][0], points[0][1]))

    return MissionComputeResponse(
        mission_type=req.mission_type,
        waypoints=waypoint_results,
        legs=legs,
        total_distance_km=total_distance,
        mission_duration_hr=total_time,
        total_energy_wh=total_energy,
        battery_capacity_wh=req.input.battery_wh,
        battery_usable_wh=usable_energy,
        battery_margin_pct=battery_margin_pct,
        cruise_altitude_m=cruise_altitude,
        mission_floor_m=mission_floor,
        terrain_conflict=terrain_conflict,
        warnings=warnings,
        elevation_source=elev_source,
        weather=weather_resp,
    )
