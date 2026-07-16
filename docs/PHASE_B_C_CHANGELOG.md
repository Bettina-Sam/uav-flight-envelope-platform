# Polish Fixes + Phase B + Phase C — Changelog

Builds on `docs/PHASE_A_CHANGELOG.md`. Everything below is real, tested code:
backend endpoints smoke-tested end to end, frontend type-checked (`tsc --noEmit`)
and production-built (`vite build`) clean.

## Bug fixes / polish

- **AltitudeGauge rewritten.** The old semicircular dial had an inverted
  angle→coordinate mapping (tick labels rendered in reverse order — visible
  in your screenshot as `4060…30` running the wrong direction) and looked
  degenerate for altitude ranges skewed toward the low end, which is common
  here. Replaced with a vertical altimeter-tape gauge: correctly ordered
  ticks, a safe/caution color band, and clear MIN/MAX/CEILING/recommended
  markers. Reads correctly at any skew.
- **Vite dev-server 504 "Outdated Optimize Dep" / failed 3D chunk import.**
  This is a known Vite dev-cache race: adding a new dependency
  (`framer-motion`, now also `leaflet`/`react-leaflet`) after the server's
  first optimize pass can invalidate an in-flight lazy import. Fixed by
  eagerly pre-bundling all of them in `vite.config.ts`
  (`optimizeDeps.include`). **If you still see it once**, it's leftover
  cache from before this fix — stop the dev server, delete
  `frontend/node_modules/.vite`, and restart `npm run dev`; it won't
  recur after that.
- Removed a framer-motion console warning (`'rgb(var(--color-cyan)...)' is
  not an animatable color`) on the homepage feature cards — color hover is
  now a CSS transition instead of an animated prop, which was the correct
  tool for it anyway.

## Comparison page — table view + chart

- Toggle between the **card view** and a full **data table** (Metric ·
  Physics · ML · Difference · Confidence · Recommendation).
- New **"Percent Difference by Metric" bar chart** at the top — one glance
  at where physics and ML disagree most, color-coded, with the ±5%
  "agreement" threshold marked.

## Sensitivity 2D — heatmap instead of bubble scatter

The bubble scatter could visually hide points behind larger bubbles and
didn't make the grid structure of the sweep legible. Replaced with a
`SensitivityHeatmap` component: every sampled (x, y) cell renders as a
colored grid square (cool→warm colormap = predicted value), with a small
safety-status dot in the corner. Nothing is hidden, and the sweep's grid
structure is now visible at a glance.

## Background animation — enhanced

Added a second, counter-rotating radar sweep, a slow horizontal scan beam,
faint "telemetry constellation" lines, a second (smaller, reversed) UAV
silhouette on an offset loop, and bumped particle count. Still respects
`prefers-reduced-motion` and stays subtle enough not to fight page content.

---

## Phase B — Range & Endurance full analysis

New pages **`/analysis/range`** and **`/analysis/endurance`**
(`RangeAnalysisPage.tsx` / `EnduranceAnalysisPage.tsx`, both thin wrappers
around a shared `MetricDeepDivePage.tsx`), each with the same depth of
workflow the Altitude path has, consolidated onto one page:

- **Physics Prediction** — direct read from the physics engine.
- **ML Prediction** — with its confidence-interval band.
- **Comparison** — physics vs ML, color-coded, links to the full matrix.
- **Sensitivity** — single-parameter sweep against the 5 most relevant
  parameters for that metric (e.g. battery capacity, mass, CD0, prop
  efficiency, cruise speed for Range), rendered as a line chart.
- **Optimization Suggestions** — new **`POST /optimize-suggestions`**
  endpoint: one-at-a-time physics-engine perturbation (±10%) across 8
  candidate parameters, keeps only genuinely improving changes, ranks by
  projected impact. Explicitly labeled as one-at-a-time, not a joint
  optimizer — each card's rationale says so.
- **Engineering Recommendation** — auto-generated summary tying the
  comparison result and top suggestion together.

## Phase C — Mission Planner + Maps + Terrain + Weather

New page **`/mission`** (`MissionPlannerPage.tsx`), lazy-loaded so Leaflet
doesn't bloat the main bundle:

- **Leaflet map** (OpenStreetMap tiles, no key needed) — click to drop
  waypoints in order, see them connected by a route line, remove/clear.
- **6 mission type presets** (Surveillance, Mapping, Delivery,
  Reconnaissance, Border Patrol, Disaster Relief) — **honestly scoped**:
  these currently label/frame the mission only; the physics model doesn't
  yet have per-profile aerodynamic behavior (loiter vs cruise polar), so
  energy figures use the same steady-cruise physics regardless of type.
  Said explicitly in the UI rather than implied.
- **Terrain-aware floor altitude**: new `POST /mission/elevation` proxies
  the free, no-key **Open-Meteo Elevation API** for real terrain elevation
  at each waypoint; minimum safe altitude = terrain + a configurable buffer
  (default 100 m); cruise altitude is the max of that floor and the
  aircraft's physics-recommended altitude, capped at service ceiling, with
  a "terrain conflict" warning if the floor exceeds the ceiling.
- **Live weather**: new `POST /mission/weather` proxies the free, no-key
  **Open-Meteo Forecast API** (temperature, pressure, humidity, wind) at
  the first waypoint, shown for situational awareness. **Not yet fed back
  into the physics engine** — same honesty note as the Sensitivity page:
  the atmosphere model is still a fixed ISA column. A real integration
  would adjust air density from live temperature/pressure; that's a
  reasonable next increment, flagged rather than silently faked.
- **Mission compute** (`POST /mission/compute`): per-leg distance
  (haversine), time, and energy (from the physics engine's power-required
  at the assigned cruise altitude), summed into total mission duration,
  total energy, and battery margin (with a 20% reserve) — with a warning if
  the energy required exceeds usable battery capacity.
- **Fail-soft networking**: both the elevation and weather proxies catch
  request failures and return `available: false` with a clear fallback
  (flat 0 m terrain) rather than crashing the request — verified in this
  sandbox, where outbound calls to `api.open-meteo.com` are blocked by the
  build environment's network policy, so you'll want to confirm live
  terrain/weather once this is running somewhere with normal internet
  access. Everything else (physics, haversine, energy math) was verified
  end-to-end here.

### New dependency
`httpx==0.27.2` added to `backend/requirements.txt` (Open-Meteo proxy calls).
`leaflet` + `react-leaflet` + `@types/leaflet` added to `frontend/package.json`.
Run `pip install -r requirements.txt` / `npm install` again after pulling
this update.
