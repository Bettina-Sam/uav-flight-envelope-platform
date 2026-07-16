# Viva Questions & Model Answers

**Q: Why didn't you use real UAV flight data?**
A: Real flight-test telemetry at the granularity needed (systematic altitude/power/lift
sweeps across many configurations) is operationally restricted and not publicly
available for a research prototype. Physics-generated synthetic data is standard
practice for early-stage physics-informed surrogate modeling — I disclose this
explicitly rather than presenting it as real data.

**Q: Isn't "recommended altitude" just the average of min and max?**
A: No — that was explicitly avoided. It's selected by scoring every feasible altitude
below the service ceiling on a weighted combination of L/D, climb-rate margin, power
margin, and an endurance proxy, then picking the best-scoring altitude. The mean is
still shown separately, labeled as a midpoint reference, never as the recommendation.

**Q: Why does holding cruise speed constant (not lift coefficient) matter?**
A: If Cl were held constant across altitude, dynamic pressure stays constant, drag
becomes altitude-invariant, and power margin falls monotonically with altitude — the
"optimal" altitude collapses to the operating floor every time, which isn't a real
engineering result. Holding cruise airspeed fixed instead means required Cl rises with
altitude (thinner air), producing a genuine trade-off between falling parasite drag and
rising induced drag — a real minimum-power altitude, matching classical
aircraft-performance theory.

**Q: Why XGBoost over the other 6 models?**
A: Highest R² (0.984 vs. next-best 0.970 for Gradient Boosting) on held-out test data,
averaged across all 12 regression targets, with fast training (~7s) and low-latency
inference — important since it serves a live web API. Full comparison table is in
`docs/ML_METHODOLOGY.md`.

**Q: What's the model's weakest prediction, and why?**
A: `recommended_altitude_m`, R² = 0.964 (still good, but the lowest of the 12 targets).
It's the output of an argmax over a fairly flat scoring function near its optimum —
small physics differences can shift which altitude "wins," making it inherently harder
to regress exactly than smoothly-varying quantities like lift or L/D.

**Q: How do you know your physics equations are correct?**
A: They implement standard, named aircraft-performance relations (ISA atmosphere,
lift/drag polar with induced drag from lifting-line theory, excess-power climb theorem,
standard service-ceiling definition of 100 ft/min) — not custom formulas. Each is
documented with its name and reasoning in `docs/FORMULA_SHEET.md`. They have not been
validated against real flight-test data, which is disclosed as a limitation.

**Q: What's the safety classifier, and is it reliable?**
A: A Random Forest classifier predicting SAFE/CAUTION/CRITICAL, trained to approximate
the transparent rule-based classification (`physics.classify_status()`). Test accuracy
is 96.25%. The rule-based version remains the ground truth and is always shown
alongside the ML version.

**Q: What are the main limitations of this platform?**
A: (1) Trained entirely on synthetic, physics-generated data — never validated against
real flight-test telemetry. (2) No wind, gust, or turbulence modeling. (3) Propeller
efficiency vs. altitude uses an empirical smoothing curve, not a measured propeller
map. (4) Single airfoil family assumption (fixed Cl_max range). All stated explicitly
in the About page and report limitations section.

**Q: How would you validate this against a real UAV?**
A: Fly a real (or simulated in a validated tool like XFLR5/OpenVSP) UAV matching the
input parameters, log actual climb rate, power draw, and endurance at several
altitudes, and compare against both the physics engine and ML predictions — this is
listed as future work.

**Q: Why FastAPI and React specifically?**
A: FastAPI gives automatic request validation (Pydantic), interactive API docs
(Swagger UI at `/docs`), and async support with minimal boilerplate — well suited to
serving a numeric/ML backend. React + TypeScript + Tailwind + Vite is a standard,
fast-to-build modern frontend stack with strong typing (catches mismatches between
frontend and backend data shapes at compile time) and native PWA tooling via
`vite-plugin-pwa`.

**Q: Why twin-engine, and how does the engine-out analysis work?**
A: The platform models a twin-engine fixed-wing electric UAV, the standard configuration
wherever propulsion redundancy matters operationally. The engine-out analysis
re-evaluates the entire altitude sweep with one engine's worth of power removed, reusing
the exact same stall/Cl_max feasibility check as normal flight — stalling depends only on
speed and altitude, not engine count, so the single-engine-out ceiling can never exceed
the twin-engine ceiling. Where a configuration is power-limited, losing an engine
visibly lowers the ceiling; where it's stall-limited, losing an engine costs nothing,
which is also physically correct.

**Q: Is this platform ready to use real flight-test data if it becomes available?**
A: Yes — `backend/app/data_loader.py` provides a `synthetic` / `real` / `blended` data
source abstraction, switchable with a single CLI flag (`--data-source real`). A blank CSV
template with the exact required schema is provided. No changes to the physics engine,
backend API, or frontend are needed when that happens — only the training data source.

**Q: What would you add with more time?**
A: SHAP values for per-prediction explanations, partial dependence plots, CatBoost in
the model comparison, wind/gust-perturbed envelope modeling, and validation against
real flight-test data or a higher-fidelity simulator.
