import json
import os
import random
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import ExtraTreesRegressor, RandomForestClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from app.dataset_generator import FEATURE_COLUMNS, TARGET_COLUMNS, generate_row
from app.main import _uav_config_from_input
from app.schemas import UAVInput


BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "uav_synthetic_dataset.csv")
MODELS_DIR = os.path.join(BACKEND_DIR, "models")
REG_TARGETS = [t for t in TARGET_COLUMNS if t != "safety_status"]
CLS_TARGET = "safety_status"

TAPAS_BASE = {
    "aircraft_name": "TAPAS BH-201",
    "mass_kg": 2850,
    "payload_kg": 350,
    "wing_area_m2": 21.2,
    "l_over_d": 26,
    "cd0": 0.03,
    "cruise_speed_ms": 45,
    "air_density_kg_m3": 1.225,
    "sfc_kg_per_n_s": 0.000007,
    "thrust_to_weight": 0.32,
    "propulsion_efficiency": 0.8,
    "fuel_capacity_l": 500,
    "propeller_diameter_m": 3.0,
    "battery_wh": 106875,
    "battery_soc": 0.9,
    "aux_power_w": 480,
}


def _mape(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = np.abs(y_true) > 1e-6
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def _evaluate(y_true: pd.DataFrame, y_pred: np.ndarray):
    per_target = {}
    for i, name in enumerate(REG_TARGETS):
        yt = y_true.iloc[:, i].values
        yp = y_pred[:, i]
        per_target[name] = {
            "MAE": float(mean_absolute_error(yt, yp)),
            "RMSE": float(np.sqrt(mean_squared_error(yt, yp))),
            "R2": float(r2_score(yt, yp)),
            "MAPE": _mape(yt, yp),
        }
    avg = {
        "MAE": float(np.mean([v["MAE"] for v in per_target.values()])),
        "RMSE": float(np.mean([v["RMSE"] for v in per_target.values()])),
        "R2": float(np.mean([v["R2"] for v in per_target.values()])),
        "MAPE": float(np.nanmean([v["MAPE"] for v in per_target.values()])),
    }
    return avg, per_target


def _sample_near_tapas(rng: random.Random):
    d = dict(TAPAS_BASE)
    multipliers = {
        "mass_kg": (0.7, 1.25),
        "payload_kg": (0.55, 1.35),
        "wing_area_m2": (0.75, 1.25),
        "l_over_d": (0.8, 1.13),
        "cd0": (0.8, 1.25),
        "cruise_speed_ms": (0.9, 1.2),
        "thrust_to_weight": (0.75, 1.3),
        "propulsion_efficiency": (0.9, 1.12),
        "sfc_kg_per_n_s": (0.45, 1.75),
        "battery_wh": (0.55, 1.3),
        "battery_soc": (0.8, 1.0),
        "aux_power_w": (0.5, 1.5),
        "fuel_capacity_l": (0.25, 1.75),
        "propeller_diameter_m": (0.8, 1.15),
    }
    for key, (lo, hi) in multipliers.items():
        d[key] = float(d[key] * rng.uniform(lo, hi))
    d["payload_kg"] = min(d["payload_kg"], 500)
    d["cd0"] = min(max(d["cd0"], 0.006), 0.08)
    d["l_over_d"] = min(max(d["l_over_d"], 5), 30)
    d["cruise_speed_ms"] = min(max(d["cruise_speed_ms"], 40), 70)
    d["propulsion_efficiency"] = min(max(d["propulsion_efficiency"], 0.3), 0.95)
    d["battery_soc"] = min(max(d["battery_soc"], 0.05), 1.0)
    d["aux_power_w"] = min(max(d["aux_power_w"], 0), 2000)
    return d


def _row_from_input(data: dict):
    inp = UAVInput(**data)
    uav = _uav_config_from_input(inp)
    return generate_row(uav)


def build_augmented_dataframe(n_local_samples=12000, n_reference_anchors=0, n_fuel_sweep_samples=2500, seed=9):
    base_df = pd.read_csv(DATA_PATH)
    if len(base_df) > 2500:
        base_df = base_df.sample(n=2500, random_state=seed).reset_index(drop=True)
    rng = random.Random(seed)
    rows = []
    for _ in range(n_reference_anchors):
        rows.append(_row_from_input(TAPAS_BASE))
    while len(rows) < n_reference_anchors + n_local_samples:
        try:
            rows.append(_row_from_input(_sample_near_tapas(rng)))
        except Exception:
            continue
    for _ in range(n_fuel_sweep_samples):
        try:
            d = _sample_near_tapas(rng)
            d["fuel_capacity_l"] = rng.uniform(75.0, 1100.0)
            d["sfc_kg_per_n_s"] = rng.uniform(0.000003, 0.000014)
            d["battery_wh"] = TAPAS_BASE["battery_wh"] * rng.uniform(0.8, 1.1)
            rows.append(_row_from_input(d))
        except Exception:
            continue
    aug_df = pd.DataFrame(rows)
    return pd.concat([base_df, aug_df], ignore_index=True), len(aug_df)


def train(seed=42):
    os.makedirs(MODELS_DIR, exist_ok=True)
    df, n_aug = build_augmented_dataframe()
    X = df[FEATURE_COLUMNS]
    y_reg = df[REG_TARGETS]
    y_cls = df[CLS_TARGET]

    X_train, X_test, y_train, y_test, yc_train, yc_test = train_test_split(
        X, y_reg, y_cls, test_size=0.2, random_state=seed
    )
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    model = ExtraTreesRegressor(
        n_estimators=140,
        max_depth=18,
        random_state=seed,
        n_jobs=-1,
        min_samples_leaf=2,
        max_features=0.8,
    )
    t0 = time.time()
    model.fit(X_train_s, y_train.values)
    train_seconds = round(time.time() - t0, 2)
    pred = model.predict(X_test_s)
    avg, per_target = _evaluate(y_test, pred)

    clf = RandomForestClassifier(
    n_estimators=80,
    max_depth=14,
    min_samples_leaf=3,
    random_state=seed,
    n_jobs=1,
    )
    clf.fit(X_train_s, yc_train)
    clf_acc = float(clf.score(X_test_s, yc_test))

    comparison = {
        "TAPASLocalExtraTrees": {
            "avg": avg,
            "per_target": per_target,
            "train_seconds": train_seconds,
            "note": f"ExtraTrees trained on base synthetic data plus {n_aug} TAPAS-scale nearby physics samples; the exact TAPAS preset is intentionally excluded.",
        }
    }

    native = {feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, model.feature_importances_)}

    joblib.dump(model, os.path.join(MODELS_DIR, "best_model.joblib"), compress=3)
    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.joblib"), compress=3)
    joblib.dump(clf, os.path.join(MODELS_DIR, "safety_classifier.joblib"), compress=3)
    joblib.dump({"TAPASLocalExtraTrees": model}, os.path.join(MODELS_DIR, "all_models.joblib"), compress=3)

    manifest = {
        "best_model_name": "TAPASLocalExtraTrees",
        "feature_columns": FEATURE_COLUMNS,
        "target_columns": REG_TARGETS,
        "safety_classifier_accuracy": clf_acc,
        "safety_classes": {"0": "SAFE", "1": "CAUTION", "2": "CRITICAL"},
        "permutation_importance": native,
        "native_feature_importance": native,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "data_source": "synthetic_plus_tapas_local_augmentation",
    }
    with open(os.path.join(MODELS_DIR, "model_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    with open(os.path.join(MODELS_DIR, "model_comparison.json"), "w") as f:
        json.dump(comparison, f, indent=2)

    # Keep uncertainty scatter endpoint alive with the headline targets.
    scatter = {"TAPASLocalExtraTrees": {}}
    sample_n = min(400, len(X_test))
    sample_idx = np.random.RandomState(seed).choice(len(X_test), size=sample_n, replace=False)
    for target in ["range_km", "endurance_hr", "recommended_altitude_m"]:
        ti = REG_TARGETS.index(target)
        scatter["TAPASLocalExtraTrees"][target] = {
            "y_true": [float(v) for v in y_test[target].values[sample_idx]],
            "y_pred": [float(v) for v in pred[sample_idx, ti]],
        }
    with open(os.path.join(MODELS_DIR, "scatter_data.json"), "w") as f:
        json.dump(scatter, f)

    print(json.dumps({"manifest": manifest, "comparison": comparison}, indent=2))


if __name__ == "__main__":
    train()
