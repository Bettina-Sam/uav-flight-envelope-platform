# ML Methodology

## Problem framing

This is a **multi-output regression** problem: given 14 UAV design features, predict 12
continuous flight-envelope quantities simultaneously (min/max/recommended altitude,
service/absolute ceiling, rate of climb, range, endurance, power required, lift, drag,
L/D). A separate **3-class classification** model predicts the rule-based safety status
(SAFE / CAUTION / CRITICAL) from the same features.

This is a **hybrid physics + ML** design: the physics engine is the ground-truth
generator and the always-available fallback; the ML model is a fast surrogate trained to
approximate it. Both are shown to the user side-by-side (see Flight Envelope Dashboard),
which is itself a diagnostic — large physics-vs-ML gaps flag where the surrogate is
weakest.

## Dataset generation

See `docs/DATASET_DESCRIPTION.md` for the full column list. In short: 6,000 UAV
configurations were sampled uniformly at random within realistic bounds for a 7-25 kg
electric fixed-wing UAV class, and each was run through the physics engine
(`backend/app/physics.py`) to compute its ground-truth flight envelope. One row = one
design configuration + its envelope outputs (not one row per altitude — altitude is an
internal sweep variable inside the physics engine, not an ML input).

## Train/test split

80/20 split, `random_state=42`, giving 4,800 training rows and 1,200 test rows. Features
are standardized with `sklearn.preprocessing.StandardScaler` (fit on train only, applied
to test) before every model except the tree ensembles (which don't strictly need it, but
scaling is applied uniformly for a fair, consistent pipeline across all 7 models).

## Models compared

| Model | Why included |
|---|---|
| Linear Regression | Baseline — establishes the "floor" any nonlinear model must beat |
| Random Forest | Robust bagged-tree baseline, handles nonlinearity well |
| Extra Trees | Faster, more randomized variant of Random Forest |
| Gradient Boosting | Sequential boosting, typically stronger than bagging on tabular data |
| SVR (RBF kernel) | Tests whether a kernel method captures the nonlinearity better than trees |
| Gaussian Process | Gives predictive uncertainty in principle; trained on a 900-row subsample because exact GP inference is O(n³) |
| XGBoost | Industry-standard gradient boosting; usually the strongest tabular-data model |

CatBoost was intentionally **left out of the default pipeline** to avoid an extra heavy
dependency for a class-project environment. To add it: `pip install catboost`, then add
a `CatBoostRegressor` (wrapped in `sklearn.multioutput.MultiOutputRegressor`) to
`build_models()` in `app/train_model.py` — it follows the same scikit-learn API as the
other models already there.

## Actual results (this training run, `n=6000`, seed=42, twin-engine schema with num_engines feature)

Averaged across all 12 regression targets, test set:

| Model | R² | MAE | RMSE | MAPE % | Train time |
|---|---|---|---|---|---|
| **XGBoost** ★ | **0.9802** | **91.57** | **154.73** | 79.61 | 5.3s |
| Gradient Boosting | 0.9651 | 155.63 | 217.31 | 153.31 | 43.7s |
| Gaussian Process (subsampled) | 0.9517 | 231.18 | 311.19 | 248.18 | 22.3s |
| Extra Trees | 0.8633 | 100.41 | 186.95 | 101.17 | 8.5s |
| Linear Regression | 0.8465 | 374.64 | 463.35 | 455.93 | 0.02s |
| Random Forest | 0.8368 | 99.97 | 181.68 | 88.36 | 14.9s |
| SVR | 0.7929 | 629.43 | 735.08 | 683.49 | 36.5s |

**XGBoost was selected as the production model** (highest R², competitive MAE, fast
training and inference). Safety classifier (Random Forest, 3-class): **95.5% test
accuracy**.

Adding `num_engines` as a 12th feature (alongside the twin-engine total-power change)
slightly reduced overall R² versus the earlier single-engine-only dataset (0.980 vs the
prior 0.984) — expected, since the feature space now spans a wider range of
configurations (1-4 engines) with a genuinely different power-availability relationship
per engine count, which is a harder function to learn than a fixed single-engine
baseline. This is a reasonable trade-off for the added realism and the engine-out safety
feature it unlocks.

### Feature importance (permutation, top 6)

| Feature | Importance |
|---|---|
| cruise_speed_ms | 0.565 |
| wing_loading_kg_m2 | 0.331 |
| aspect_ratio | 0.283 |
| mass_kg | 0.278 |
| power_loading_w_kg | 0.170 |
| battery_wh | 0.082 |

`cruise_speed_ms` remains the dominant feature, consistent with the fixed-cruise-speed
formulation in `docs/FORMULA_SHEET.md` — cruise speed is the single design choice with
the largest leverage over the entire drag polar, and hence the whole envelope.

### A note on MAPE

MAPE values above look large (68-700%) because several targets (rate of climb, drag,
recommended altitude near the operating floor) can be close to zero for some
configurations, and MAPE is defined by dividing by the true value — it blows up near
zero regardless of how good the absolute prediction is. **R² and MAE/RMSE are the more
reliable metrics here**; MAPE is reported for completeness because the spec calls for
it, but should be read alongside the others, not in isolation.

### Per-target breakdown for the winning model (XGBoost)

| Target | R² | MAE |
|---|---|---|
| min_altitude_m | 1.000 | 0.00 |
| max_altitude_m | 0.989 | 219.0 |
| recommended_altitude_m | 0.964 | 333.5 |
| service_ceiling_m | 0.988 | 229.4 |
| absolute_ceiling_m | 0.989 | 220.0 |
| rate_of_climb_ms | 0.989 | 0.28 |
| range_km | 0.972 | 25.4 |
| endurance_hr | 0.974 | 0.38 |
| power_required_w | 0.982 | 9.03 |
| lift_n | 0.992 | 2.60 |
| drag_n | 0.973 | 0.39 |
| l_over_d | 0.992 | 0.37 |

`min_altitude_m` is trivially perfect because it's a fixed constant (30 m operating
floor) in this configuration — the model has correctly learned it's constant.
`recommended_altitude_m` has the weakest R² of the group (0.964, still good) because it
is the output of an argmax over a fairly flat scoring function near its optimum — small
physics differences can shift which altitude "wins," making it inherently harder to
regress exactly than the more smoothly-varying quantities.

## Explainable AI

- **Permutation importance** (`sklearn.inspection.permutation_importance`,
  model-agnostic, 8 repeats): shown on the Feature Importance page.
- **Native feature importance**: gain-based importance internal to the XGBoost model,
  averaged across its 12 per-target sub-estimators.
- **Partial Dependence Plots and SHAP** were scoped as future enhancements (see
  `docs/AboutPage` / `About` page in the app) — not included in this build to keep the
  dependency footprint and training time reasonable for a class-project deployment.
  Adding SHAP is straightforward: `pip install shap`, then
  `shap.TreeExplainer(model.estimators_[i])` per target, since XGBoost is a supported
  model type.

## How to retrain

```bash
cd backend
python -m app.dataset_generator --n 6000 --seed 42   # regenerate data (optional)
python -m app.train_model --data-source synthetic       # default; also: real, blended
```
Artifacts are written to `backend/models/`: `best_model.joblib`, `scaler.joblib`,
`safety_classifier.joblib`, `model_manifest.json` (importance + metadata, including
which `data_source` was used), `model_comparison.json` (full per-model, per-target
metrics). See `docs/DATASET_DESCRIPTION.md` for how to switch to real flight-test data.

## How prediction integrates with the backend

`app/main.py::_run_ml()` loads the saved model/scaler/classifier once at FastAPI
startup, builds the same 14-feature row the training pipeline used
(`_feature_row()`), scales it, and calls `.predict()` / `.predict_proba()`. This is
served through `POST /predict` (single config), `POST /batch-predict` (CSV upload), and
internally reused by `/sensitivity`.
