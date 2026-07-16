# Uncertainty Quantification & Model-Choice Methodology
### (Positioning against the guide's reference paper)

This document exists for one purpose: to give you a grounded, data-backed
answer when your guide asks "why did you use a different model?" or "how
does this relate to what I did in my paper?" — not a hand-wavy one.

Everything below is pulled from **this project's own real training run**
(`backend/models/model_comparison.json`), not asserted from memory.

---

## 1. How this project's approach maps to the reference paper

| Reference paper | This project |
|---|---|
| UAS domain: fuel/turboprop (SFC, thrust, L/D) | Domain: **electric** fixed-wing UAV (battery Wh, motor W, propeller efficiency) |
| Models compared: Random Forest, SVR, Linear Regression (3) | Models compared: Linear Regression, Random Forest, **Extra Trees, Gradient Boosting, XGBoost, Gaussian Process**, and SVR (**7**) |
| Metrics: MAE, RMSE, R² | Same: MAE, RMSE, R² (+ MAPE) |
| Uncertainty: not explicitly decomposed in the excerpt shown | Explicitly decomposed into **aleatoric** (Monte Carlo) and **epistemic** (cross-model ensemble spread) |
| Validation: True-vs-Predicted scatter, per model (Fig. 4/5) | Same idea, extended to **all 7 models at once** (`/uncertainty` page) |
| GUI: MATLAB | Web app (FastAPI + React), physics engine cross-validates ML rather than ML being the only source of truth |

**The core, honest answer to "why a different model":** the guide's paper's
three candidate models (RF, SVR, LR) are a **subset** of the seven this
project actually benchmarks. XGBoost was not chosen a priori — it won a
head-to-head comparison against RF, SVR, and LR (among others) on this
project's own dataset, using the exact same metrics the reference paper
uses. That's a stronger position than "I used a different model" — it's
"I ran the same kind of comparison and got a data-driven answer, which
happens to point somewhere else because the dataset and domain differ."

---

## 2. The actual numbers (from `model_comparison.json`, averaged across all 12 outputs)

| Model | R² | RMSE | MAE |
|---|---|---|---|
| **XGBoost** | **0.980** | **154.7** | **91.6** |
| Gradient Boosting | 0.965 | 217.3 | 155.6 |
| Gaussian Process | 0.952 | 311.2 | 231.2 |
| Linear Regression | 0.847 | 463.4 | 374.6 |
| Extra Trees | 0.829 | 205.8 | 111.9 |
| SVR | 0.793 | 735.1 | 629.4 |
| Random Forest | 0.789 | 190.4 | 104.6 |

**Note the honest nuance, not just the headline number:** Random Forest's
RMSE/MAE are actually competitive with the top models here (190/104 vs
XGBoost's 155/92) — its R² looks worse mainly because R² is sensitive to a
couple of the 12 output targets (e.g. absolute ceiling, which has a
different scale/variance than the others) where RF underfits more. Don't
claim RF is "bad" across the board — it isn't; XGBoost is *better*, by a
real but not enormous margin on most individual targets, and *substantially*
better on a couple of the harder ones. That's a more defensible, more
senior-sounding answer than "the other models were worse."

**Per-target detail worth knowing for Q&A**, since a guide will likely ask
about endurance/range specifically (her paper's actual focus):

| Model | Endurance R² | Range R² |
|---|---|---|
| XGBoost | 0.958 | 0.962 |
| SVR | 0.945 | 0.716 |
| Random Forest | 0.741 | 0.648 |
| Linear Regression | 0.675 | 0.753 |

Interesting, genuinely useful talking point: **SVR is actually close to
XGBoost specifically on endurance** (0.945 vs 0.958), even though its
*overall* R² across all 12 targets is the worst of the seven (0.793). That's
a real, explainable pattern: SVR is known to struggle with multi-output
regression when target scales/variances differ a lot across outputs (it
optimizes per-output independently under one shared kernel configuration
here), so it does fine on some targets and poorly on others that have very
different scales (e.g. absolute ceiling in meters vs. L/D as a small
dimensionless ratio). If asked "isn't SVR competitive with your winner on
endurance," the honest answer is "yes, on that one target — that's exactly
why we benchmark per-target, not just on one metric across one output."

---

## 3. Domain difference — why the parameters aren't 1:1

The reference paper's aleatoric uncertainty is built around **SFC**
(specific fuel consumption) and **thrust**, because it models a
fuel/turboprop UAS. This project models a **battery-electric** fixed-wing
UAV, which has no SFC or thrust in the combustion-engine sense. The
closest real analogs, used in this project's own Monte Carlo aleatoric
simulation (`POST /uncertainty/monte-carlo`):

| Reference paper (fuel/turboprop) | This project (electric) |
|---|---|
| SFC variability | Battery capacity spread (`battery_std_pct`) + propeller efficiency variation (`prop_eff_std_pct`) |
| Thrust variability | Motor power is currently held fixed; propeller efficiency variation captures the analogous propulsive-efficiency uncertainty |
| L/D ratio (given, not modeled as uncertain) | CD0 variability (`cd0_std_pct`) is modeled as uncertain here — an extension, not a simplification |
| Airframe mass (implicit) | Mass variability (`mass_std_pct`) — manufacturing/assembly tolerance |

If your guide asks why SFC doesn't appear: **because there's no fuel engine
in this design space** — this is a legitimate, structural domain
difference, not an oversight. Say that plainly.

---

## 4. What's actually new here relative to the reference paper's approach

Three things worth stating explicitly in a defense, all real and shipped:

1. **Physics-engine cross-validation.** The reference paper's ML models are
   validated against each other (and presumably against simulation-derived
   ground truth). This project adds a fully independent, closed-form
   physics engine (ISA atmosphere + steady-level-flight equations) that the
   ML surrogate is checked against on *every single prediction*, not just
   at training time — see the Physics vs ML comparison page. That's an
   additional, always-on sanity check the reference methodology doesn't
   describe.
2. **Aleatoric AND epistemic, both live and interactive.** The reference
   paper's Fig. 2-style Monte Carlo histogram is reproduced here
   (`/uncertainty`), but as an interactive tool where the person doing the
   analysis can change the perturbation magnitudes (`mass_std_pct`,
   `cd0_std_pct`, etc.) and immediately see the resulting distribution —
   not a fixed, precomputed figure.
3. **7-model benchmark, not 3.** Already covered above.

---

## 5. Suggested one-paragraph answer if asked directly in a viva/defense

> "My guide's paper benchmarks three regression models — Random Forest,
> SVR, and Linear Regression — on a fuel/turboprop UAS. My project extends
> that same benchmark-and-select methodology to seven models, including
> those three plus Extra Trees, Gradient Boosting, Gaussian Process, and
> XGBoost, evaluated with the same MAE/RMSE/R² metrics. On my dataset,
> XGBoost wins with R² ≈ 0.98 versus Random Forest's ≈ 0.79 and SVR's
> ≈ 0.79 — so the model choice wasn't arbitrary, it came out of the same
> kind of comparison her paper does, just over a larger candidate set. I
> also separated uncertainty into aleatoric (Monte Carlo propagation of
> manufacturing/battery/aerodynamic variability through the physics engine)
> and epistemic (prediction spread across the 5 independently trained
> models), which maps directly onto the aleatoric/epistemic framing in her
> literature review, adapted to an electric UAV rather than an SFC-based
> one."

---

## 6. Where this lives in the app

- `/uncertainty` — model benchmark table, 7-model true-vs-predicted scatter
  grid, Monte Carlo aleatoric histogram (interactive), epistemic cross-model
  spread chart.
- `/feature-importance` — the same model comparison table plus global/local
  feature importance (SHAP-style occlusion explanation).
- `backend/app/train_model.py` — the actual training/comparison code;
  the docstring at the top lists exactly which models are compared and why
  a couple (CatBoost) were deliberately left out.
- `backend/app/main.py` — `/uncertainty/monte-carlo`, `/uncertainty/epistemic`,
  `/uncertainty/scatter` endpoints (all pre-existing in this codebase; this
  session's work was building the `/uncertainty` frontend page to actually
  surface them, since they had schemas and endpoints but no UI before now).
