# Reference Aircraft Preset + Performance Fixes

## Reference aircraft data → GUI

Added a **Reference Configurations** selector at the top of the UAV Input
page: "Default — Mini Surveillance UAV" and **"TAPAS BH-201"**.

**Important honesty note, read before using this in your defense:** the
reference table is for a **fuel/turboprop** aircraft (SFC in kg/N·s, 500 L
fuel, thrust-to-weight ratio). This platform models **battery-electric**
propulsion. That's an architecture difference, not just a scale difference
— so the preset does NOT pretend every field transfers 1:1. Each field is
tagged in the UI with exactly where it came from:

- **table** (used exactly as given): cruise speed (38 m/s), propulsive
  efficiency (80%), wing area (21.2 m²), mass (2850 kg), payload (350 kg)
- **derived** (computed from table values using this platform's physics):
  wingspan (from wing area + an assumed AR≈14), and — importantly — motor
  power was derived from the table's **thrust-to-weight ratio** (→ ≈425 kW),
  *not* from the table's "Power Consumption Rate" (480 W), which is far too
  small to propel a 2,850 kg aircraft and is almost certainly avionics/
  payload draw, not propulsion. Using the wrong field there would have
  produced a nonsensical result.
- **assumed** (no valid electric-UAV analog exists, so a reasonable
  engineering value was used instead of fabricating one): battery energy
  (the reference aircraft has no battery-electric powertrain to convert —
  see the in-app note on why converting the fuel's actual energy content
  would need a battery ~45× larger than what's used here), CL-max, CD0,
  Oswald efficiency, and engine count.

**A genuinely useful side effect, worth mentioning in your defense:** this
platform's ML model was trained only on small electric UAVs (7–25 kg). Every
field in this preset will correctly show as "Outside Training Distribution"
— that's the epistemic-uncertainty system working as intended, not a bug.
The physics engine has no such limit and computes a real result regardless
of scale: using the literal table values, it flags **CAUTION** on wing
loading (134 kg/m² — a tight stall margin for that wing area at that
weight) — a legitimate design-sensitivity finding you can discuss, not
noise to hide.

Schema bounds were widened accordingly (mass ≤3000 kg, payload ≤500 kg,
wing area ≤25 m², wingspan ≤20 m, motor power ≤600 kW, battery ≤150,000 Wh) —
the ML training bounds in `dataset_generator.py` were deliberately left
unchanged, since that's what makes the "outside training distribution"
flagging meaningful.

Full field-by-field reasoning is in `lib/referenceAircraft.ts` (shown live
in the UI) and cross-referenced in `docs/UNCERTAINTY_METHODOLOGY_AND_MODEL_CHOICE.md`.

## Performance audit — what I found and fixed

I can't run a real browser timing test in this sandbox (headless browser
binaries aren't reachable from here), so this was a code-level audit + real
fixes, not a simulated "it feels fine" claim. Two genuine issues found:

1. **Page transitions were blocking on their own animation.**
   `AnimatePresence mode="wait"` meant the *new* page didn't even mount —
   so its data-fetching `useEffect`s didn't start — until the *old* page's
   250 ms exit animation fully finished. That's up to a quarter-second of
   pure animation delay before a new page even begins loading its data, on
   every single navigation. Switched to `mode="popLayout"` (old and new
   overlap instead of sequencing) and cut the duration to 150 ms. The new
   page now starts fetching data immediately on click.

2. **Two of the heaviest pages re-fetched the same data on every visit.**
   `/feature-importance` and `/uncertainty` both call the model-comparison
   endpoint, and `/uncertainty` also pulls a ~290 KB held-out-predictions
   payload for the scatter grid — both were being re-fetched from scratch
   every time you navigated back to either page. Added simple in-memory
   caching (`api/client.ts`) so this data is fetched once per session;
   revisiting either page is now instant.

Also split the frontend bundle properly (`vite.config.ts` →
`manualChunks`): the main app chunk was 912 KB (over Vite's 500 KB
warning threshold); it's now 234 KB, with React, Framer Motion, and
Recharts split into their own vendor chunks. This mainly helps first-load
parse time and lets browsers cache vendor code across future app updates
(most updates only touch app code, not these libraries) — verified via a
clean production build with the chunk-size warning gone.

**What I couldn't test directly:** actual measured navigation latency in a
real browser (frame timing, network waterfall). If it still feels slow
after these fixes, the most useful next step would be your browser's
DevTools Performance tab on a slow transition — that would show exactly
what's taking time, and I can target that specifically.
