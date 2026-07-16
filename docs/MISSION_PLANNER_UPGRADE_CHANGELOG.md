# 3D-Load Fix (For Real This Time) + Mission Planner Upgrade

## The 3D-load error — root cause, actually fixed

Last time I fixed the wrong thing: `vite:preloadError` is only emitted by
Vite's **production** preload helper — it never fires for the dev-mode
dependency-optimizer race that was actually causing your error. So that
"fix" did nothing for the dev server, which is why it kept happening.

**Real fix, in `lib/lazyRetry.ts`:** every lazy-loaded chunk (`Flight3DScene`,
`MissionPlannerPage`) now goes through a wrapper that catches exactly this
failure class ("Failed to fetch dynamically imported module", "Loading
chunk...") at the `import()` call site itself, waits briefly, and retries
(up to 3 times, backing off each time). By the time of a retry, Vite's
dependency optimizer has finished its re-bundle and the import succeeds
normally — this works in **both dev and prod** (the prod case being a
stale tab open across a new deploy). If all retries are exhausted, it does
one guarded full-page reload as a last resort, rather than looping forever.

I also gave the `ErrorBoundary` fallback a working **Retry** button (it
used to just say "try refreshing" with no button to do it).

I can't fully prove this eliminates 100% of occurrences without your dev
environment, but this addresses the actual mechanism this time, not a
plausible-sounding but wrong one — and it degrades gracefully (retry →
reload → clear error UI with a retry button) instead of a dead end either
way.

## Mission Planner — upgraded

- **Location search** — type a place name (e.g. "Austin, Texas"), pick from
  results, the map flies there. New `POST /mission/geocode` endpoint proxies
  OpenStreetMap's free Nominatim search (no API key).
- **Live distance readout** — total route distance now updates instantly as
  you add/remove/reorder waypoints, computed client-side, no need to hit
  "Compute Mission" first to see it. Per-leg distance also shows inline in
  the waypoint list.
- **Reorder waypoints** — up/down arrows on each waypoint row.
- **Optimize Order** — one click reorders waypoints 2..N with a
  nearest-neighbor heuristic (launch point stays fixed) to cut obvious
  backtracking from a route you clicked in non-optimally. Not a provable
  TSP solution (that's NP-hard) — a fast, practical reordering, said so in
  the UI tooltip.
- **Return to Launch** — toggle that appends a closing leg back to
  waypoint 1, shown on the map and included in the energy/duration
  calculation, without touching your editable waypoint list.
- **Survey Grid Generator** — place 2 waypoints as opposite corners of an
  area, set a line spacing, and it generates a full lawnmower/boustrophedon
  coverage pattern between them (auto-switches mission type to Mapping).
  Genuinely useful for the Mapping mission type that was previously just a
  label.
- **Export as KML / GPX** — download the route for use in Google Earth,
  QGroundControl, or most other GCS/GIS tools. Includes the computed cruise
  altitude if you've run Compute Mission.
- **Recompute** button on the leg table — re-run after editing waypoints
  without scrolling back up.

### New files
`lib/geo.ts` (haversine, route optimizer, survey grid math),
`lib/missionExport.ts` (KML/GPX builders), `lib/lazyRetry.ts`.

### Backend
`mission.py`: `geocode_search()` (Nominatim proxy, same fail-soft pattern
as elevation/weather — verified in this sandbox: correctly returns
`available: false` rather than erroring, since Nominatim isn't reachable
from here either). `schemas.py` / `main.py`: `POST /mission/geocode`.

No new dependencies — Nominatim needs no API key, same as the
elevation/weather providers from Phase C.
