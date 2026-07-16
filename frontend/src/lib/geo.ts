export interface LatLon { lat: number; lon: number }

const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance (km) between two points — mirrors the backend's
 * haversine_km so live, pre-compute distance readouts match the server's
 * numbers exactly. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dphi = ((b.lat - a.lat) * Math.PI) / 180;
  const dlambda = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dphi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dlambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function totalRouteDistanceKm(points: LatLon[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) total += haversineKm(points[i], points[i + 1]);
  return total;
}

/** Nearest-neighbor route heuristic: keeps the first waypoint fixed as the
 * launch point, then repeatedly visits whichever remaining waypoint is
 * closest to the current one. Not provably optimal (true TSP is
 * NP-hard) — it's a fast, "good enough" reordering that typically removes
 * obvious backtracking from a route the person clicked in on the map in a
 * non-optimal order. */
export function optimizeRouteOrder(points: LatLon[]): LatLon[] {
  if (points.length <= 2) return points;
  const remaining = points.slice(1);
  const ordered: LatLon[] = [points[0]];
  let current = points[0];
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }
  return ordered;
}

/**
 * Generates a boustrophedon ("lawnmower") survey grid covering the
 * rectangle defined by two opposite corners, with parallel lines spaced
 * `lineSpacingM` meters apart running north-south. Uses a flat-earth
 * approximation (fine at survey scales, i.e. up to a few km) rather than
 * full geodesic math.
 */
export function generateSurveyGrid(cornerA: LatLon, cornerB: LatLon, lineSpacingM: number): LatLon[] {
  const avgLatRad = ((cornerA.lat + cornerB.lat) / 2) * (Math.PI / 180);
  const metersPerDegLon = 111_320 * Math.cos(avgLatRad);

  const lonSpanM = Math.abs(cornerB.lon - cornerA.lon) * metersPerDegLon;
  const spacing = Math.max(5, lineSpacingM);
  const numLines = Math.max(2, Math.ceil(lonSpanM / spacing) + 1);

  const lonMin = Math.min(cornerA.lon, cornerB.lon);
  const lonMax = Math.max(cornerA.lon, cornerB.lon);
  const latMin = Math.min(cornerA.lat, cornerB.lat);
  const latMax = Math.max(cornerA.lat, cornerB.lat);

  const points: LatLon[] = [];
  for (let i = 0; i < numLines; i++) {
    const lon = numLines === 1 ? lonMin : lonMin + (i / (numLines - 1)) * (lonMax - lonMin);
    const goingUp = i % 2 === 0;
    points.push({ lat: goingUp ? latMin : latMax, lon });
    points.push({ lat: goingUp ? latMax : latMin, lon });
  }
  return points;
}
