# Phase D — Changelog

Builds on Phase A/B/C. Note up front: **none of Phase D needs external API
keys** (unlike Phase C's maps/terrain/weather). Auto Design, Saved Configs,
Shareable Links, and Failure Simulation are all local computation, browser
storage, or URL encoding. Everything below is real, tested code — backend
endpoints smoke-tested end to end (including extracting and reading the
rebuilt PDF's text), frontend type-checked and production-built clean.

## Auto Design Optimizer (inverse design)

New page **`/auto-design`**, backed by **`POST /auto-design`**. You specify
target endurance and/or range plus a fixed payload; the backend searches
over wing area, wingspan, motor power, battery capacity, mass, and cruise
speed to find a configuration that gets close.

**Method, stated plainly:** random search (up to a few hundred physics-engine
evaluations) followed by coordinate-descent local refinement on the best
candidates. It's not a gradient-based or provably-optimal solver, and it's
not a joint/global optimizer in the mathematical sense — it's a practical,
dependency-free search (no scipy needed) that reliably lands close to
targets in well under a second. Verified in this sandbox: asked for 3.5 hr
endurance / 200 km range, it returned 3.44 hr / 198 km. Returns the best
candidate plus 3 alternatives, each one-click-loadable into the UAV Input
form.

## Failure Simulation

New page **`/failure-simulation`**, backed by **`POST /failure-simulation`**.
Re-evaluates the physics engine under 5 scenarios and shows before/after
deltas against your current baseline:

- **Engine failure** — reuses the existing engine-out analysis (service
  ceiling / climb rate on remaining engines).
- **Battery degradation** (-20% capacity)
- **Payload increase** (+2 kg)
- **Headwind gusts** (8 m/s) — explicitly flagged as a **partial
  approximation**: it reduces ground-relative range only (true airspeed and
  power draw, and therefore endurance, are unaffected by wind in this
  model); real gust effects on stall margin/control authority aren't
  captured, and the UI says so rather than implying a full gust-load model.
- **Propeller efficiency loss** (-15% relative)

Each scenario reports its new safety status and a plain-language
explanation, not just numbers.

## Saved Configurations + Shareable Links

New page **`/saved-configs`**. Both features are intentionally
**client-side only** — no backend database, no accounts:

- **Saved Configurations** (`lib/savedConfigs.ts`): stored in the browser's
  `localStorage`, capped at 50 entries. Save the current design with a
  name, restore it (loads into the input form and re-runs the prediction),
  delete it, or select any 2 to **compare side by side** (runs `/predict`
  on both, shows a metrics diff table).
- **Shareable Links** (`lib/shareLink.ts`): the entire UAV configuration is
  base64url-encoded directly into the URL (`/input?config=...`) — no server
  storage at all, so the link works forever and needs no backend changes.
  Opening a shared link pre-fills the Input form and shows a "loaded from a
  shared link" banner. A "Copy Shareable Link" button was added to both the
  Input page and the Saved Configs page.

*(This is the same tradeoff called out at the start of Phase C/D planning —
since neither of these needs multi-device sync or multi-user sharing beyond
"send someone a link," client-side storage is simpler and more robust than
standing up a database for it. If you later want configs synced across
devices, that's the point to add a backend table.)*

## Design Score

New **`POST /design-score`** endpoint, surfaced as a widget on the Flight
Envelope Dashboard: a 0–100 score (A–F grade) blending safety status (40
pts), aerodynamic efficiency / L-over-D (25 pts), power margin (20 pts),
and ML-model reliability (15 pts) — each component shown with its own
detail line, not just a black-box number.

## PDF Report — full rebuild

`build_pdf_report()` was rewritten from a 3-section, 3-page report into a
12-section report (5 pages for a typical config) covering everything on
the original wishlist:

Cover page → Executive Summary → UAV Configuration → Mission Profile
(pulled from a Mission Planner run in the same session, if any — otherwise
says so plainly instead of pretending) → Physics Results → Engine-Out
Safety → ML Results → Physics-vs-ML Comparison (table + chart) →
Confidence Intervals → Local Explanation (occlusion-based, same honest
"SHAP-style, not exact Shapley values" framing as the in-app page) →
Optimization Suggestions (Range + Endurance) → Failure Simulation → Design
Score → Safety Warnings → Final Engineering Recommendation → Appendix
(methodology & limitations, stated explicitly: synthetic training data,
one-at-a-time explanations and optimization, fixed-ISA atmosphere, not
certified airworthiness data).

**Verified by extracting and reading the actual PDF text in this sandbox**
(not just "it returned 200") — every section renders with real computed
numbers, not placeholders.

The `/report/pdf` request shape changed from a raw `UAVInput` body to
`{ input, mission?, include_failure_analysis, include_optimization }` — the
frontend's `downloadReport()` was updated accordingly and now passes along
the last mission you computed in this session automatically.
**`/report/csv` is unchanged** (still takes a raw `UAVInput` body) — verified
as a regression check.

## Files touched

Backend: `schemas.py` (13 new models), `main.py` (+~450 lines: failure
simulation, design score, auto-design search, 5 new endpoints, rebuilt
`/report/pdf`), `report_generator.py` (rebuilt `build_pdf_report`).

Frontend: `AutoDesignPage.tsx`, `FailureSimulationPage.tsx`,
`SavedConfigsPage.tsx` (all new), `lib/savedConfigs.ts`, `lib/shareLink.ts`
(new), `UAVContext.tsx` (+`lastMission`), `UAVInputPage.tsx` (shareable-link
decode + copy button), `MissionPlannerPage.tsx` (writes to
`lastMission`), `FlightEnvelopeDashboard.tsx` (design score widget),
`ReportGenerationPage.tsx`, `client.ts`, `types.ts`, `App.tsx`, `Navbar.tsx`.

No new dependencies — everything in Phase D runs on what Phases A–C already
installed.
