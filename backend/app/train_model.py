"""
train_model.py
----------------
ML pipeline for the physics-informed surrogate model.

STAGE 1 - Multi-output regression: predicts the 12 continuous flight-
          envelope quantities (min/max/recommended altitude, service &
          absolute ceiling, ROC, range, endurance, power required,
          lift, drag, L/D) directly from the 14 UAV design features.

STAGE 2 - Classification: predicts the rule-based safety status
          (SAFE / CAUTION / CRITICAL) from the same features, so the
          frontend can show an ML-side "confidence" on safety alongside
          the transparent rule-based physics classification.

MODELS COMPARED (regression): Linear Regression, Random Forest,
Extra Trees, Gradient Boosting, SVR, Gaussian Process, XGBoost (if
installed). CatBoost is intentionally left out of the default pipeline
(heavy optional dependency) - see docs/ML_METHODOLOGY.md for how to add it.

METRICS: MAE, RMSE, R2, MAPE - averaged across all 12 output targets to
produce a single comparable score per model, plus a full per-target
breakdown saved to models/model_comparison.json.
"""

import json
import os
import time
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, ExtraTreesRegressor, GradientBoostingRegressor, RandomForestClassifier
from sklearn.svm import SVR
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from sklearn.multioutput import MultiOutputRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.inspection import permutation_importance

from app.dataset_generator import FEATURE_COLUMNS, TARGET_COLUMNS
from app.data_loader import load_training_data

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BACKEND_DIR, "data", "uav_synthetic_dataset.csv")
MODELS_DIR = os.path.join(BACKEND_DIR, "models")

REG_TARGETS = [t for t in TARGET_COLUMNS if t != "safety_status"]
CLS_TARGET = "safety_status"

try:
    from xgboost import XGBRegressor
    HAS_XGB = True
except ImportError:
    HAS_XGB = False


def mape(y_true, y_pred):
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)
    mask = np.abs(y_true) > 1e-6
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def evaluate_multi_output(y_true: pd.DataFrame, y_pred: np.ndarray, target_names):
    per_target = {}
    for i, name in enumerate(target_names):
        yt, yp = y_true.iloc[:, i].values, y_pred[:, i]
        per_target[name] = {
            "MAE": float(mean_absolute_error(yt, yp)),
            "RMSE": float(np.sqrt(mean_squared_error(yt, yp))),
            "R2": float(r2_score(yt, yp)),
            "MAPE": mape(yt, yp),
        }
    avg = {
        "MAE": float(np.mean([v["MAE"] for v in per_target.values()])),
        "RMSE": float(np.mean([v["RMSE"] for v in per_target.values()])),
        "R2": float(np.mean([v["R2"] for v in per_target.values()])),
        "MAPE": float(np.nanmean([v["MAPE"] for v in per_target.values()])),
    }
    return avg, per_target


def build_models():
    models = {
        "LinearRegression": LinearRegression(),
        # min_samples_leaf (not just max_depth) is what actually controls
        # serialized size here: with 12 continuous outputs, each leaf
        # stores a 12-value array, so leaf *count* (not depth alone - depth
        # was already implicitly capped by sample count around ~13) is what
        # drove the original 190-380 MB per model. min_samples_leaf=4 cuts
        # each down to a few MB total (~60 MB combined), at a modest R2
        # cost (RandomForest 0.837->0.789, ExtraTrees 0.863->0.829 on this
        # dataset) - an intentional size/accuracy tradeoff, not free. It
        # doesn't change which model is selected as best (XGBoost, ~0.98,
        # unaffected either way) or the overall benchmark conclusion; it
        # only affects these two models' individual standing and their
        # contribution to the epistemic ensemble spread.
        "RandomForest": RandomForestRegressor(n_estimators=200, max_depth=16, min_samples_leaf=4, random_state=42, n_jobs=-1),
        "ExtraTrees": ExtraTreesRegressor(n_estimators=250, max_depth=16, min_samples_leaf=4, random_state=42, n_jobs=-1),
        "GradientBoosting": MultiOutputRegressor(GradientBoostingRegressor(n_estimators=150, max_depth=3, random_state=42), n_jobs=-1),
        # SVR is deliberately NOT in this dict - see the dedicated subsampled
        # training block below, same reasoning as Gaussian Process.
    }
    if HAS_XGB:
        models["XGBoost"] = MultiOutputRegressor(
            XGBRegressor(n_estimators=250, max_depth=5, learning_rate=0.08, random_state=42, n_jobs=-1, verbosity=0)
        )
    return models


def train_and_compare(n_samples_gp: int = 900, n_samples_svr: int = 4000, test_size: float = 0.2, random_state: int = 42,
                       data_source: str = "synthetic"):
    os.makedirs(MODELS_DIR, exist_ok=True)
    df = load_training_data(source=data_source)
    print(f"[train_model] data source: {data_source}  ({len(df)} rows)")
    X = df[FEATURE_COLUMNS]
    y_reg = df[REG_TARGETS]
    y_cls = df[CLS_TARGET]

    X_train, X_test, yreg_train, yreg_test, ycls_train, ycls_test = train_test_split(
        X, y_reg, y_cls, test_size=test_size, random_state=random_state
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    results = {}
    fitted_models = {}

    for name, model in build_models().items():
        t0 = time.time()
        model.fit(X_train_s, yreg_train.values)
        pred = model.predict(X_test_s)
        avg, per_target = evaluate_multi_output(yreg_test, pred, REG_TARGETS)
        results[name] = {"avg": avg, "per_target": per_target, "train_seconds": round(time.time() - t0, 2)}
        fitted_models[name] = model
        print(f"[train_model] {name:18s} R2={avg['R2']:.4f}  MAE={avg['MAE']:.3f}  RMSE={avg['RMSE']:.3f}  "
              f"({results[name]['train_seconds']}s)")

    # Gaussian Process - trained on a subsample (O(n^3) cost)
    gp_idx = np.random.RandomState(random_state).choice(len(X_train_s), size=min(n_samples_gp, len(X_train_s)), replace=False)
    kernel = RBF(length_scale=1.0) + WhiteKernel(noise_level=1.0)
    gp = MultiOutputRegressor(GaussianProcessRegressor(kernel=kernel, random_state=random_state, normalize_y=True))
    t0 = time.time()
    gp.fit(X_train_s[gp_idx], yreg_train.values[gp_idx])
    pred = gp.predict(X_test_s)
    avg, per_target = evaluate_multi_output(yreg_test, pred, REG_TARGETS)
    results["GaussianProcess"] = {"avg": avg, "per_target": per_target, "train_seconds": round(time.time() - t0, 2),
                                   "note": f"trained on {len(gp_idx)}-row subsample for tractability"}
    fitted_models["GaussianProcess"] = gp
    print(f"[train_model] {'GaussianProcess':18s} R2={avg['R2']:.4f}  MAE={avg['MAE']:.3f}  RMSE={avg['RMSE']:.3f}  "
          f"({results['GaussianProcess']['train_seconds']}s, subsampled)")

    # SVR - also O(n^2)-O(n^3) per target and NOT parallelized by sklearn's
    # SVR itself, so (same reasoning as Gaussian Process above) it's trained
    # on a subsample rather than the full training set. n_jobs=-1 on the
    # MultiOutputRegressor wrapper also parallelizes across the 12 output
    # targets, which single-handedly cut wall time several-fold here since
    # SVR has no other means of using multiple cores.
    svr_idx = np.random.RandomState(random_state).choice(len(X_train_s), size=min(n_samples_svr, len(X_train_s)), replace=False)
    svr = MultiOutputRegressor(SVR(C=10.0, epsilon=0.01, kernel="rbf"), n_jobs=-1)
    t0 = time.time()
    svr.fit(X_train_s[svr_idx], yreg_train.values[svr_idx])
    pred = svr.predict(X_test_s)
    avg, per_target = evaluate_multi_output(yreg_test, pred, REG_TARGETS)
    results["SVR"] = {"avg": avg, "per_target": per_target, "train_seconds": round(time.time() - t0, 2),
                       "note": f"trained on {len(svr_idx)}-row subsample for tractability"}
    fitted_models["SVR"] = svr
    print(f"[train_model] {'SVR':18s} R2={avg['R2']:.4f}  MAE={avg['MAE']:.3f}  RMSE={avg['RMSE']:.3f}  "
          f"({results['SVR']['train_seconds']}s, subsampled)")

    best_name = max(results.keys(), key=lambda k: results[k]["avg"]["R2"])
    best_model = fitted_models[best_name]
    print(f"[train_model] BEST MODEL: {best_name} (R2={results[best_name]['avg']['R2']:.4f})")

    # --- safety classifier ---
    clf = RandomForestClassifier(n_estimators=200, random_state=random_state, n_jobs=-1)
    clf.fit(X_train_s, ycls_train)
    clf_acc = float(clf.score(X_test_s, ycls_test))
    print(f"[train_model] Safety classifier accuracy: {clf_acc:.4f}")

    # --- feature importance (best model, permutation importance = model-agnostic) ---
    try:
        perm = permutation_importance(best_model, X_test_s, yreg_test.values, n_repeats=8,
                                       random_state=random_state, n_jobs=-1)
        importance = {feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, perm.importances_mean)}
    except Exception as e:
        importance = {}
        print(f"[train_model] permutation importance failed: {e}")

    # native feature_importances_ if tree-based (extra signal for the dashboard).
    # MultiOutputRegressor wraps one estimator per target in `.estimators_`,
    # so average their per-target importances into one vector.
    native_importance = {}
    base_est = best_model
    if hasattr(base_est, "feature_importances_"):
        native_importance = {feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, base_est.feature_importances_)}
    elif hasattr(base_est, "estimators_"):
        sub_ests = [e for e in base_est.estimators_ if hasattr(e, "feature_importances_")]
        if sub_ests:
            avg_imp = np.mean([e.feature_importances_ for e in sub_ests], axis=0)
            native_importance = {feat: float(imp) for feat, imp in zip(FEATURE_COLUMNS, avg_imp)}

    # --- persist artifacts ---
    joblib.dump(best_model, os.path.join(MODELS_DIR, "best_model.joblib"))
    joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.joblib"))
    joblib.dump(clf, os.path.join(MODELS_DIR, "safety_classifier.joblib"))

    # All fitted models (not just the best one) - used for epistemic
    # uncertainty estimation via cross-model prediction spread (the same
    # "ensemble disagreement" operationalization used in deep-ensemble
    # uncertainty literature, e.g. Lakshminarayanan et al.), and so the
    # platform can show the same multi-algorithm benchmark table a
    # from-scratch comparison study would produce, with every candidate
    # available for on-demand inference, not just the winner.
    #
    # SVR and GaussianProcess are excluded from this saved ensemble - both
    # serialize their full training set as support vectors / kernel data
    # (SVR here: 12 outputs x ~4800 training rows; GP: an explicit kernel
    # matrix), which bloated this single file to 600+ MB, impractical to
    # ship. They remain fully present in model_comparison.json (metrics
    # table) and in the training run's console output - only their heavy
    # fitted objects are left out of the on-disk epistemic ensemble.
    EPISTEMIC_ENSEMBLE_EXCLUDE = {"SVR", "GaussianProcess"}
    epistemic_models = {k: v for k, v in fitted_models.items() if k not in EPISTEMIC_ENSEMBLE_EXCLUDE}
    joblib.dump(epistemic_models, os.path.join(MODELS_DIR, "all_models.joblib"), compress=3)

    # True-vs-predicted scatter data for the headline targets (range,
    # endurance, recommended altitude), for every model - directly
    # reproducible as a "true vs predicted" scatter plot per model, capped
    # to a random sample of the test set to keep the JSON payload small.
    scatter_targets = ["range_km", "endurance_hr", "recommended_altitude_m"]
    rng = np.random.RandomState(random_state)
    sample_n = min(400, len(X_test))
    sample_idx = rng.choice(len(X_test), size=sample_n, replace=False)
    scatter_data = {}
    for name, model in fitted_models.items():
        pred_full = model.predict(X_test_s)
        scatter_data[name] = {}
        for target in scatter_targets:
            ti = REG_TARGETS.index(target)
            scatter_data[name][target] = {
                "y_true": [float(v) for v in yreg_test[target].values[sample_idx]],
                "y_pred": [float(v) for v in pred_full[sample_idx, ti]],
            }
    with open(os.path.join(MODELS_DIR, "scatter_data.json"), "w") as f:
        json.dump(scatter_data, f)

    manifest = {
        "best_model_name": best_name,
        "feature_columns": FEATURE_COLUMNS,
        "target_columns": REG_TARGETS,
        "safety_classifier_accuracy": clf_acc,
        "safety_classes": {"0": "SAFE", "1": "CAUTION", "2": "CRITICAL"},
        "permutation_importance": importance,
        "native_feature_importance": native_importance,
        "n_train": len(X_train),
        "n_test": len(X_test),
        "data_source": data_source,
    }
    with open(os.path.join(MODELS_DIR, "model_manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    with open(os.path.join(MODELS_DIR, "model_comparison.json"), "w") as f:
        json.dump(results, f, indent=2)

    print(f"[train_model] Saved best_model.joblib, scaler.joblib, safety_classifier.joblib, all_models.joblib, "
          f"model_manifest.json, model_comparison.json, scatter_data.json -> {MODELS_DIR}")
    return manifest, results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-source", choices=["synthetic", "real", "blended"], default="synthetic",
                         help="synthetic (default, current data) | real (once real_uav_flight_data.csv "
                              "exists) | blended (synthetic + real combined)")
    args = parser.parse_args()
    train_and_compare(data_source=args.data_source)
