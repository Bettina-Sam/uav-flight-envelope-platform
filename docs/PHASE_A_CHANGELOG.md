# Phase A Upgrade — Changelog

This is a scoped, fully-working upgrade of the UAV Flight Envelope Platform: the
**UI/UX overhaul + explainable-ML + full comparison + expanded sensitivity + 3D +
audio** slice of the 23-item wishlist. It does **not** include Mission Planner,
Maps/Terrain/Weather, Auto Design Optimizer, Saved Configs/Shareable Links, or
Failure Simulation — see "Not in this phase" at the bottom for why, and the
suggested next phases.

Every item below is real, tested code (backend endpoints smoke-tested, frontend
type-checked with `tsc --noEmit` and built with `vite build`) — not placeholder UI.

## What changed

### 1. Visual redesign
- `AnimatedBackground.tsx` — global fixed-position layer: animated gradient sky,
  22 drifting particles, a radar sweep, a perspective grid horizon, and a UAV
  silhouette that crosses the screen on a loop. Pure CSS/SVG, no extra libraries,
  respects `prefers-reduced-motion`.
- Framer Motion added (`framer-motion`): page transitions in `App.tsx`
  (`AnimatePresence`), staggered card/section reveals, hover lift on feature
  cards, animated stat bars, animated SVG path draw-in on the homepage.
- New **Sound Toggle** in the navbar + `lib/sound.ts`: synthesized (Web Audio
  API, no audio files) SAFE / CAUTION / CRITICAL avionics tones, muted by
  default, preference persisted in `localStorage`.

### 2. UAV Input page — grouped sections + training-range badges
- Inputs regrouped into **Aircraft Geometry / Aerodynamics / Propulsion /
  Weight & Payload / Battery & Energy** panels.
- Live-computed Aspect Ratio, Wing Loading, Total Power, Power Loading, Est.
  MTOW, Battery Energy.
- New backend endpoint **`GET /training-bounds`** exposes the ML model's actual
  sampling bounds (`dataset_generator.BOUNDS`). Frontend (`TrainingRangeBadge.tsx`)
  classifies every field live as `Within ML Range` / `Near Boundary` / `Outside
  Training Distribution`.

### 3. Physics page → engineering dashboard
Input Summary, full Physics Results grid, rule-based **Engineering
Interpretation** (aspect ratio class, wing loading class, L/D quality, power
margin — all computed from the actual numbers, not canned text), the existing
"why this altitude" explanation, and Safety Assessment.

### 4. ML Prediction page
- **Confidence intervals**: new `POST /predict` response field
  `ml.confidence_intervals`, computed as prediction ± that target's actual
  held-out RMSE from `model_comparison.json` (not a fixed % placeholder).
- **Reliability score**: blends held-out R² with the safety classifier's
  per-input confidence.
- **Physics vs ML difference** quick view + link to the full comparison page.
- **Local feature contribution** chart via new `POST /explain` endpoint
  (see below), selectable target metric.

### 5. New `/comparison` page — full Physics vs ML matrix (item 6)
All 10 shared metrics (Recommended Altitude, Endurance, Range, Service
Ceiling, Absolute Ceiling, Rate of Climb, Lift, Drag, L/D, Power Required),
each as Physics → ML → Difference → Confidence → Engineering Interpretation
→ Recommendation, green/yellow/red coded by disagreement size.

### 6. Explainability — real local attribution, not fabricated SHAP
New **`POST /explain`** endpoint: one-at-a-time occlusion — each feature is
swapped for its training-set mean (others held fixed) and the resulting
prediction shift is measured. This is a real, cheap, model-agnostic local
explanation method, in the spirit of SHAP — **not** an exact Shapley-value
computation (that would need the `shap` library and a coalition sampling
step we didn't want to silently bolt on without you weighing the extra
dependency/runtime cost). It's clearly labeled `occlusion_one_at_a_time` in
the API response and in the UI copy.
- Feature Importance page gained a **Local Explanation** section: waterfall
  chart (cumulative build-up from dataset-average prediction) + force-plot-style
  segmented bar, plus auto-generated interpretation text, alongside the
  existing Global (permutation + native) importance and model comparison table.

### 7. Sensitivity analysis — all design parameters + multi-parameter grids
- Single-parameter sweep now covers all 12 UAV design fields (was a handful),
  and returns Range/Endurance/L-over-D/Power in addition to altitude/climb.
- New **`POST /sensitivity-2d`** endpoint + UI: 2D grid sweeps over parameter
  pairs (Mass×Motor Power, Wing Area×Cruise Speed, Battery×Payload,
  CLmax×CD0, Prop Efficiency×Motor Power, plus 2 extra range/endurance
  presets), rendered as a color/size-coded bubble scatter.
- **Honest scope note in the UI**: air density, temperature, pressure
  altitude, wind speed/direction are *not* modeled by the physics engine yet
  (it assumes a fixed ISA atmosphere column and fixed design cruise speed) —
  flagged directly in the Sensitivity page rather than faking sliders that do
  nothing.

### 8. 3D visualization fixes/upgrades
Rewrote `Flight3DScene.tsx`: the aircraft now flies a banked, pitching patrol
circle (not just a static bob), leaves a fading flight trail, ground now has
a proper grid (`gridHelper`) instead of a flat disc only, added drifting
low-poly clouds and 4 waypoint markers, kept the existing altitude-band
reference lines and OrbitControls.

## Backend API additions (all additive — nothing existing removed/renamed)

| Endpoint | Purpose |
|---|---|
| `GET /training-bounds` | Sampling bounds for range-validation badges |
| `POST /explain` | Local feature attribution (occlusion method) for any regression target |
| `POST /sensitivity-2d` | Two-parameter grid sweep (physics engine only, fast) |
| `POST /predict` | *(unchanged shape, extra fields)* now also returns `confidence_intervals`, `reliability_score`, `model_r2` inside `ml` |
| `POST /sensitivity` | *(unchanged shape, extra fields)* now also returns `range_km`, `l_over_d`, `power_required_w` per point |

## Not in this phase (by design — see the phase plan you picked)

- **Range & Endurance full workflow** (Phase B) — sensitivity/comparison for
  these already landed in this phase; the dedicated multi-tab deep-dive pages
  (mirroring the Altitude page 1:1, with their own optimization-suggestion
  copy) did not.
- **Mission Planner, Map/Leaflet integration, Terrain-aware floor altitude,
  Live Weather** (Phase C) — needs a mapping library, a real elevation API,
  and a weather API wired into the physics engine's atmosphere model. You
  chose open providers (OpenStreetMap/Open-Meteo) for this when we get there.
- **Auto Design Optimizer (inverse design), Saved Configurations, Shareable
  Links, Failure Simulation, PDF report rebuild with all 20 report sections**
  (Phase D).

Ask for any of these next and I'll build them the same way — real, tested,
end-to-end.
