# Formula Sheet

All equations implemented in `backend/app/physics.py`. SI units throughout unless noted.

## 1. ISA Atmosphere Model (troposphere, 0–11,000 m)

**Temperature:** `T(h) = T0 - L·h`
where T0 = 288.15 K, L = 0.0065 K/m (standard lapse rate).

**Pressure:** `P(h) = P0 · (T(h)/T0)^(g0 / (R·L))`
Derived from the hydrostatic equation combined with the ideal gas law, for a
constant-lapse-rate layer. P0 = 101,325 Pa, g0 = 9.80665 m/s², R = 287.05 J/(kg·K).

**Density:** `ρ(h) = P(h) / (R·T(h))` — direct application of the ideal gas law.

**Why it matters:** every aerodynamic and propulsion equation below depends on air
density, which falls roughly exponentially with altitude — this is the root cause of
every altitude-dependent effect in the model.

## 2. Aerodynamics

**Dynamic pressure:** `q = ½·ρ·V²`

**Lift:** `L = Cl·q·S` — for steady level flight, L = W (weight).

**Induced drag coefficient:** `Cdi = Cl² / (π·e·AR)` (Prandtl lifting-line theory) —
drag caused by the wingtip vortices generated whenever lift is produced.

**Total drag coefficient:** `Cd = Cd0 + Cdi` — the classic parabolic drag polar:
constant parasite drag plus lift-dependent induced drag.

**Drag force:** `D = Cd·q·S`

**Stall speed:** `V_stall = √(2W / (ρ·S·Cl_max))` — the minimum speed at which the wing
can generate enough lift to support the aircraft's weight, using the maximum usable
lift coefficient.

## 3. The altitude trade-off (why cruise speed is held fixed, not Cl)

This platform holds the UAV's **design cruise airspeed constant** across the altitude
sweep (not the lift coefficient). This is the physically standard way to model a
fixed-wing aircraft flying a planned cruise speed profile. Consequence:

`Cl_required(h) = 2W / (ρ(h)·V²·S)`

As altitude increases, ρ falls, so `Cl_required` must rise to keep lift equal to
weight at the same speed. This is what creates a genuine engineering trade-off:

- **Parasite drag** (`Cd0·q·S`) *falls* with altitude, because q = ½ρV² falls as ρ falls
  (V fixed).
- **Induced drag** (`Cl²/(π·e·AR)·q·S`) *rises* with altitude, because Cl must rise
  faster than q falls.

Total drag therefore has a genuine minimum at some altitude — this is the classical
"there's an optimal cruise altitude" result from aircraft performance theory, and it's
the reason the recommended altitude in this platform is not simply the operating floor,
nor a naive average.

If `Cl_required` exceeds `Cl_max`, the aircraft has stalled at that altitude/speed
combination and the point is marked infeasible.

## 4. Propulsion / power

**Propeller efficiency vs. altitude (modeling assumption):**
`η_prop(h) = η_static · (0.4 + 0.6·σ)`, where σ = ρ(h)/ρ0.
This is an empirical smoothing function representing mild efficiency degradation with
reduced air density — **explicitly flagged as a synthetic assumption**, not a measured
propeller curve. A real prop map (from manufacturer test data or blade-element momentum
theory) would replace this in a production system.

**Power available:** `P_avail = P_motor_max · η_prop(h)` — electric motors, unlike IC
engines, don't lose electrical power output with altitude; only the propeller's
aerodynamic conversion efficiency changes.

**Power required:** `P_req = D · V` — thrust-power balance in steady level flight.

**Rate of climb (excess power theorem):** `ROC = (P_avail - P_req) / W`
Positive → aircraft can climb; zero → level-flight ceiling condition (absolute
ceiling); negative → cannot sustain altitude.

## 5. Ceilings

**Service ceiling:** the altitude where ROC falls to 0.508 m/s (100 ft/min) — the
standard industry definition of the "practical" operating ceiling, found by linear
interpolation between the two altitude-sweep points that bracket this ROC value.

**Absolute ceiling:** the altitude where ROC = 0 — the theoretical maximum altitude for
sustained level flight, also found by interpolation.

## 6. Recommended altitude selection (NOT an average)

Restricted to feasible altitudes at or below the service ceiling. Each candidate
altitude is scored:

```
score = 0.35·norm(L/D) + 0.30·norm(ROC) + 0.20·norm(power_margin) + 0.15·norm_inv(P_req)
```
where `norm()` min-max normalizes each quantity across the candidate set, and
`norm_inv()` inverts the normalization for `P_req` (lower power required is better, for
endurance). The altitude with the highest composite score is recommended. See
`backend/app/physics.py::_select_recommended_altitude` for the exact implementation,
and `docs/ML_METHODOLOGY.md` for why this makes `recommended_altitude_m` the hardest
target for the ML surrogate to regress exactly.

The simple **mean altitude** `(min + max) / 2` is also computed and displayed
separately in the UI, labelled clearly as a midpoint reference value — never presented
as the recommendation.

## 7. Endurance and range (electric propulsion)

**Endurance:** `E = (E_battery · (1 - reserve)) / P_elec`, where
`P_elec = P_req / η_prop(h)` (electrical power draw needed to produce the required
aerodynamic power through a non-ideal propeller), and `reserve = 0.20` (20% battery
reserve, standard safety practice — never plan to fully deplete the pack).

**Range:** `R = V · E` (still-air, straight-line range).

## 8. Wing / power loading and aspect ratio

**Wing loading:** `W/S` — higher wing loading → higher stall speed, more structural
load per unit area.

**Power loading:** `P_motor / m` — higher power loading → better climb performance,
more safety margin.

**Aspect ratio:** `AR = b²/S` — higher AR → lower induced drag → higher L/D, at the
cost of structural weight and reduced roll rate (not modeled here).

## 9. Twin-Engine Power and Engine-Out Safety Analysis

**Total power available (twin-engine):**
`P_avail = (P_motor_per_engine × n_engines_operating) · η_prop(h)`

Normal operation uses `n_engines_operating = num_engines` (2 for the platform baseline).
Power loading (`docs/DATASET_DESCRIPTION.md`) uses the TOTAL power across all engines,
since that determines climb margin in normal flight.

**Engine-out analysis** (`physics.engine_out_analysis()`) re-evaluates the full altitude
sweep with `n_engines_operating = num_engines - 1`, reusing the exact same
`evaluate_altitude()` function (and therefore the exact same stall/Cl_max feasibility
check) used for normal operation. This matters because stalling is a function of speed
and altitude only, independent of engine count — the single-engine-out ceiling can never
exceed the twin-engine ceiling, and the two will be equal whenever a configuration is
stall-limited rather than power-limited (i.e. losing an engine costs nothing on
configurations that were never using their full power margin at the ceiling in the first
place). Where a configuration IS power-limited, losing an engine visibly lowers the
service ceiling — this is the meaningful case the safety panel is designed to catch.

The engine-out result reports: whether the aircraft can still hold the minimum operating
altitude with one engine out, the rate of climb at the floor in that condition, and the
single-engine-out service ceiling (same 100 ft/min ROC definition as the normal ceiling).
Not applicable to single-engine configurations (no redundant engine to lose).

## 10. Safety classification (rule-based, not ML)

Implemented as explicit, auditable rules in `physics.classify_status()`:
- CRITICAL if no altitude in the swept range sustains level flight.
- CAUTION if wing loading > 35 kg/m², power loading < 60 W/kg, or the usable altitude
  band (service ceiling − min altitude) is under 200 m.
- SAFE otherwise.

This is intentionally rule-based (not a black box) so every flag can be explained in a
viva. The ML safety **classifier** (a Random Forest, 96% test accuracy) is a separate,
faster approximation of this same rule set — shown alongside it for comparison, exactly
like the regression outputs.
