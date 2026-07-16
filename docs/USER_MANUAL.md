# User Manual

## 1. Home
Landing page with the project pitch, a signature altitude-strip graphic, and the
platform flow diagram. Click **Run a Prediction** to start.

## 2. UAV Input
Enter all design parameters: mass, payload, wing area, wingspan, Cl_max, Cd0, Oswald
efficiency, battery energy, motor power (per engine), propeller efficiency, and cruise
speed — plus a highlighted **Number of Engines** selector (platform baseline: 2, twin
engine). Derived values (aspect ratio, wing loading, total power, power loading) update
live as you type. Clicking **Run Physics Engine & ML Prediction** calls `POST /predict`
once and stores the result for every other page to reuse — you don't need to re-enter
data per page.

## 3. Physics Calculator
Shows every quantity computed directly by the physics engine: min/max/mean/recommended
altitude, service/absolute ceiling, rate of climb, stall speed, power, lift, drag, L/D,
range, endurance, wing loading — plus the plain-English reason the recommended altitude
was chosen, and any safety warnings.

## 4. ML Prediction
The same set of outputs, this time from the trained ML surrogate model, plus the safety
classifier's confidence score and which model produced the prediction (e.g. XGBoost).

## 5. Flight Envelope Dashboard
The main visual dashboard:
- Two altitude gauges (physics vs ML) with a green "safe band" up to the service
  ceiling and an amber zone above it.
- A 3D flight visualization — an orbit-controllable scene (drag to rotate, scroll to
  zoom) showing the twin-engine aircraft positioned at its recommended altitude within
  the swept operating column, with min/recommended/service-ceiling/max markers.
- An Engine-Out Safety Analysis panel — shows whether the aircraft can maintain its
  minimum operating altitude with one of its engines inoperative, the single-engine
  service ceiling, and rate of climb in that condition. Only shown as applicable for
  twin-engine (or more) configurations.
- A line chart of rate of climb and power required/available across the full altitude
  sweep, with reference lines at the recommended altitude and service ceiling.
- A grouped bar chart comparing every physics output against its ML counterpart.

## 6. Feature Importance
Calls `GET /feature-importance`. Shows:
- Permutation importance (model-agnostic — how much R² drops when a feature is
  shuffled).
- Native tree-based feature importance from the winning model.
- A full model comparison table (R², MAE, RMSE, MAPE, training time) across all 7
  models that were trained and compared.

## 7. Sensitivity Analysis (What-If Simulation)
Pick one design parameter (e.g. motor power), choose a sweep range, and click **Run
Sweep**. This calls `POST /sensitivity`, which re-runs the physics engine at each
sampled value while holding every other parameter fixed at your current configuration,
returning how recommended altitude, max altitude, rate of climb, and endurance respond.

## 8. Batch CSV Prediction
Upload a CSV of multiple UAV configurations (download the template button for the
exact column headers). Each row is run through both physics and ML, and results are
shown in a table with a **Download Results CSV** button.

## 9. Report Generation
Download a PDF or CSV summary of the current configuration's physics results, ML
results, and comparison table — for inclusion in your project report appendix.

## 10. About / Methodology
The full write-up: what the platform does, why synthetic data was used, why
recommended altitude isn't a simple average, the parameter-influence table, the full
formula sheet, and a clear breakdown of implemented work vs. synthetic assumptions vs.
future enhancements.

## Installing as an app (PWA)
Look for the **Install App** button in the navbar (desktop: top-right; mobile: inside
the hamburger menu). This is only offered by the browser once the app has been served
over HTTPS (or localhost) and meets PWA install criteria — it will not appear on the
very first load of `npm run dev`; use `npm run build && npm run preview` or the
deployed production URL to test it reliably. On iOS Safari (which never fires the
standard install-prompt event), the button instead shows manual "Share → Add to Home
Screen" instructions.

## Light / dark mode
The app defaults to **light mode**. Toggle to dark mode using the sun/moon icon next to
the Install button in the navbar; your choice is remembered (localStorage) across
visits.
