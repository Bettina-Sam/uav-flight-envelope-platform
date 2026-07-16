# 3D Scene Replaced + State-Loss Bug Fixed

## The three.js error is gone because the risky code is gone

Three attempts to fix the dynamic-import race around `Flight3DScene`
(three.js + @react-three/fiber + @react-three/drei) weren't enough — that
combination is a known source of Vite dev-server chunk-loading flakiness,
and patching around it kept not being sufficient. So, as you suggested:
**removed it entirely**, dependencies and all (`three`, `@react-three/fiber`,
`@react-three/drei`, ~975 KB out of the app's precache) and replaced it
with something that has no dynamic-import chunk to race in the first place.

## New: Flight Profile Visualizer

`components/FlightProfileVisualizer.tsx` — pure SVG + Framer Motion (both
already normal, non-code-split dependencies), so there's nothing to fail to
load. It's also a more information-dense, "aerospace HUD" feel than the
orbiting-plane 3D scene was:

- Banked elliptical patrol orbit with a fading motion trail
- Live altitude tape (MIN / REC / CEIL / MAX bands) with a marker that
  drifts with simulated climb/descent, scaled to the actual rate of climb
- Rotating heading/compass ring tied to the aircraft's orbit position
- Airspeed and vertical-speed HUD readouts (real values from your config)
- Pulsing safety-status indicator (color-matched to SAFE/CAUTION/CRITICAL)
- Parallax cloud layers, waypoint markers, engine-count readout

Total bundle precache: **2034 KB → 1088 KB** (verified via a full production
build) — the app is meaningfully lighter, not just less buggy.

## The actual cause of "stuck on tab switch, loses my results"

This one's on me — my own earlier fix caused it. I'd added an automatic
`window.location.reload()` as a "last resort" for chunk-load failures.
Browsers throttle/delay network requests for backgrounded tabs, so
switching away and back could make an in-flight retry look like it failed
— triggering that reload, which silently wiped your in-memory UAV
input/results (plain React state has no persistence by default), forcing
you to redo the whole flow. That matches exactly what you described.

Two changes:

1. **Removed the auto-reload entirely** (`lib/lazyRetry.ts`). It now only
   retries with backoff and pauses while the tab is hidden — it never
   reloads the page on its own. The one production-only reload path
   (`vite:preloadError` in `main.tsx`) is now also gated on the tab being
   visible.
2. **Session persistence** (`UAVContext.tsx`): your current UAV input,
   prediction result, and last mission plan now auto-save to
   `sessionStorage` and restore automatically on load. So even if a reload
   *does* happen — from any cause, not just this one — you land back where
   you were, not back at square one. (Session-scoped on purpose: it
   survives a reload in the same tab, but doesn't linger forever the way
   your deliberate Saved Configurations do.)

## Files touched
Removed: `components/Flight3DScene.tsx`, `three`/`@react-three/*` deps.
New: `components/FlightProfileVisualizer.tsx`.
Modified: `FlightEnvelopeDashboard.tsx`, `lib/lazyRetry.ts`, `main.tsx`,
`UAVContext.tsx`, `vite.config.ts`, `package.json`.
