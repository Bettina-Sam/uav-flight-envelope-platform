# Navbar Redesign + 3D-Load Error Fix — Changelog

## The recurring "3D visualization failed to load" error — actually fixed this time

Previously I only suggested clearing `node_modules/.vite`. That treats the
symptom. The real fix is Vite's own documented mechanism for this exact
failure class:

**`main.tsx`** now listens for the `vite:preloadError` event and reloads
the page once when it fires:

```js
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})
```

Some background: Vite's dependency optimizer can decide mid-session that it
needs to re-bundle a dependency (e.g. the first time a route pulling in
three.js/@react-three actually mounts), which invalidates the module graph
those chunks were served from. If a lazy import (`React.lazy(...)`, like
`Flight3DScene` or `MissionPlannerPage`) is in flight at that exact moment,
its fetch fails with "Failed to fetch dynamically imported module" /
"504 Outdated Optimize Dep". Vite fires `vite:preloadError` for precisely
this situation — and its own docs recommend reloading when it happens. This
also covers the production-equivalent case (a browser tab left open across
a new deployment, referencing chunk hashes that no longer exist).

Combined with the existing `optimizeDeps.include` list (which pre-bundles
three/@react-three/framer-motion/leaflet up front so the race is rarer to
begin with), this should now be fully self-healing: if it happens, the page
reloads itself once and works — no more manual cache-clearing.

*(Also quieted a separate, harmless console notice — Workbox's "navigation
route not in allowlist" — by adding an explicit `navigateFallbackAllowlist`
to the PWA config.)*

## Navbar — full redesign

The flat 17-item navbar (which didn't fit on many desktop widths, per your
screenshots) is now 6 top-level destinations: **Home, Design▾, Analysis▾,
Tools▾, Report, About**, plus the existing sound/theme/install controls.
Dropdowns open on click (not hover — more reliable on trackpads and
touchscreens), close on outside-click or Escape, and use `layoutId`-animated
active-tab pills. Mobile gets a matching accordion (each group expands
in place) instead of one long flat list.

**Grouping:**
- **Design** — UAV Input, Physics, ML Prediction (the sequential input/compute steps)
- **Analysis** — Envelope Dashboard, Physics vs ML, **Performance** (see below), Feature Importance, Sensitivity
- **Tools** — Mission Planner, **Design Studio** (see below), Batch CSV

A group's trigger highlights cyan whenever any of its children is the
active route, so you always know where you are even with the menu closed.

## Merged: Performance (Altitude + Range + Endurance)

New page **`/performance`**, replacing the separate Range/Endurance nav
entries. Three tabs — **Altitude, Range, Endurance** — each running the
identical physics/ML/comparison/sensitivity/optimization workflow
(`MetricDeepDivePage`, now generalized to accept altitude as a third
target). The tab state syncs to `?tab=`, so `/performance?tab=range` deep-links directly to a tab.

Backend note: `/optimize-suggestions` previously only accepted `range_km`
and `endurance_hr` as targets; it now also accepts `recommended_altitude_m`,
so the Altitude tab gets real optimization suggestions too, not a stub.

## Merged: Design Studio (Auto Design + Failure Simulation)

New page **`/design-studio`**, replacing the separate Auto Design / Failure
Sim nav entries. Two tabs — **Auto Design** and **Failure Simulation** —
same underlying logic as before (nothing about the auto-design search or
the 5 failure scenarios changed), just presented as tabs of one page
instead of two separate destinations. Also syncs to `?tab=`.

## Moved: Saved Configurations → Report page

Saved Configurations (save/restore/delete/compare) and Shareable Links no
longer have their own nav entry. Both now live at the bottom of the
**Report** page (`/report`), below the existing PDF/CSV export controls —
exactly as requested. `SavedConfigsPage` was refactored into an embeddable
`SavedConfigsPanel` component so it renders inline there instead of as a
standalone route.

## Backward compatibility

Old bookmarked/shared URLs still work — they redirect automatically:

| Old route | Redirects to |
|---|---|
| `/analysis/range` | `/performance?tab=range` |
| `/analysis/endurance` | `/performance?tab=endurance` |
| `/auto-design` | `/design-studio?tab=auto-design` |
| `/failure-simulation` | `/design-studio?tab=failure-sim` |
| `/saved-configs` | `/report` |

## Files touched

New: `PerformanceAnalysisPage.tsx`, `DesignStudioPage.tsx`,
`AutoDesignPanel.tsx` (renamed from `AutoDesignPage.tsx`),
`FailureSimulationPanel.tsx` (renamed from `FailureSimulationPage.tsx`),
`SavedConfigsPanel.tsx` (renamed from `SavedConfigsPage.tsx`).

Removed: `RangeAnalysisPage.tsx`, `EnduranceAnalysisPage.tsx` (superseded
by `PerformanceAnalysisPage`'s tabs).

Modified: `Navbar.tsx` (full rewrite), `App.tsx` (routing + redirects),
`MetricDeepDivePage.tsx` (widened target type to include altitude),
`ReportGenerationPage.tsx` (embeds `SavedConfigsPanel`), `main.tsx`
(preload-error recovery), `vite.config.ts` (Workbox allowlist),
`main.py` / `schemas.py` (altitude as a valid optimize-suggestions target).

No new dependencies.
