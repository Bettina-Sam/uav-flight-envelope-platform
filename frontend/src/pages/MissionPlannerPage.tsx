import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline, Circle, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import {
  Loader2, Trash2, PlayCircle, MapPin, Thermometer, Wind, Gauge, Droplets,
  Search, ArrowUp, ArrowDown, Wand2, RotateCcw, Grid3x3, Download, RefreshCw, X,
} from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { useTheme } from '../context/ThemeContext';
import { getChartColors } from '../lib/chartTheme';
import { computeMission, geocodeSearch } from '../api/client';
import { MissionComputeResponse, MissionWaypoint as MissionWaypointT, GeocodeResult } from '../types';
import { haversineKm, totalRouteDistanceKm, optimizeRouteOrder, generateSurveyGrid } from '../lib/geo';
import { narrateMissionSummary } from '../lib/narrationText';
import NarrateButton from '../components/NarrateButton';
import { buildKML, buildGPX, downloadTextFile } from '../lib/missionExport';
import { saveMissionToHistory } from '../lib/missionHistory';

const DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;
const PlaneIcon = L.divIcon({
  className: '',
  html: '<div style="width:30px;height:30px;border-radius:999px;background:#4FD1C5;color:#071018;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(79,209,197,.22);font-size:17px;transform:rotate(45deg)">✈</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const MISSION_TYPES = [
  { key: 'Surveillance', desc: 'Loiter-heavy, moderate altitude, long dwell time.' },
  { key: 'Mapping', desc: 'Straight parallel legs at a fixed altitude for consistent ground sample distance.' },
  { key: 'Delivery', desc: 'Point-to-point, minimum-time routing, payload-critical.' },
  { key: 'Reconnaissance', desc: 'Higher altitude for standoff distance, longer range.' },
  { key: 'Border Patrol', desc: 'Long linear routes, endurance-critical.' },
  { key: 'Disaster Relief', desc: 'Flexible routing, terrain-aware minimum altitude is critical.' },
];

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

function ClickToAddWaypoint({ onAdd }: { onAdd: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { onAdd(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/** Imperatively pans/zooms the map when `target` changes — used by the
 * location search. Kept as its own child so it can call useMap() (only
 * valid inside a MapContainer). */
function FlyTo({ target }: { target: [number, number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target[0], target[1]], target[2], { duration: 1.1 });
  }, [target, map]);
  return null;
}

export default function MissionPlannerPage() {
  const { input, result: currentPrediction, setLastMission } = useUAV();
  const { theme } = useTheme();
  const c = getChartColors(theme);

  const [waypoints, setWaypoints] = useState<MissionWaypointT[]>([]);
  const [missionType, setMissionType] = useState('Surveillance');
  const [buffer, setBuffer] = useState(100);
  const [returnToLaunch, setReturnToLaunch] = useState(false);
  const [result, setResult] = useState<MissionComputeResponse | null>(null);
  const [missionProgress, setMissionProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Location search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number, number] | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Survey grid generator
  const [showGrid, setShowGrid] = useState(false);
  const [gridSpacing, setGridSpacing] = useState(80);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setSearchResults([]);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const addWaypoint = (lat: number, lon: number) => setWaypoints((w) => [...w, { lat, lon }]);
  const removeWaypoint = (i: number) => setWaypoints((w) => w.filter((_, idx) => idx !== i));
  const clearAll = () => { setWaypoints([]); setResult(null); };

  const moveWaypoint = (i: number, dir: -1 | 1) => {
    setWaypoints((w) => {
      const j = i + dir;
      if (j < 0 || j >= w.length) return w;
      const next = [...w];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const handleOptimizeOrder = () => setWaypoints((w) => optimizeRouteOrder(w));

  const handleGenerateGrid = () => {
    if (waypoints.length !== 2) return;
    const grid = generateSurveyGrid(waypoints[0], waypoints[1], gridSpacing);
    setWaypoints(grid);
    setMissionType('Mapping');
    setShowGrid(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await geocodeSearch(searchQuery, 5);
      setSearchResults(results);
      if (results.length === 0) setError('No results found — the location service may be unreachable, or try a more specific query.');
      else setError(null);
    } catch {
      setError('Location search failed. Is the backend running?');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (r: GeocodeResult) => {
    setFlyTarget([r.lat, r.lon, 12]);
    setSearchResults([]);
    setSearchQuery(r.display_name.split(',')[0]);
  };

  // Route used for display and for the API call — includes the
  // return-to-launch closing leg when enabled, without mutating the
  // editable waypoints list itself.
  const effectiveRoute = useMemo(
    () => (returnToLaunch && waypoints.length > 1 ? [...waypoints, waypoints[0]] : waypoints),
    [waypoints, returnToLaunch]
  );

  const liveDistanceKm = useMemo(() => totalRouteDistanceKm(effectiveRoute), [effectiveRoute]);

  useEffect(() => {
    const id = window.setInterval(() => setMissionProgress((p) => (p + 0.004) % 1), 80);
    return () => window.clearInterval(id);
  }, []);

  const planeState = useMemo(() => {
    if (effectiveRoute.length < 2) return null;
    const total = totalRouteDistanceKm(effectiveRoute);
    if (total <= 0) return null;
    const targetDistance = missionProgress * total;
    let covered = 0;
    for (let i = 0; i < effectiveRoute.length - 1; i++) {
      const a = effectiveRoute[i];
      const b = effectiveRoute[i + 1];
      const legDistance = haversineKm(a, b);
      if (covered + legDistance >= targetDistance || i === effectiveRoute.length - 2) {
        const t = legDistance > 0 ? Math.max(0, Math.min(1, (targetDistance - covered) / legDistance)) : 0;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lon = a.lon + (b.lon - a.lon) * t;
        const leg = result?.legs[i];
        const elapsedHr = result ? result.legs.slice(0, i).reduce((sum, l) => sum + l.time_hr, 0) + (leg?.time_hr ?? 0) * t : 0;
        const energyUsed = result ? result.legs.slice(0, i).reduce((sum, l) => sum + l.energy_wh, 0) + (leg?.energy_wh ?? 0) * t : 0;
        const batteryRemaining = result ? Math.max(0, result.battery_capacity_wh - energyUsed) : null;
        const fuelBurnKgHr = input.sfc_kg_per_n_s * (currentPrediction?.physics.drag_n ?? 0) * 3600;
        const fuelUsedL = fuelBurnKgHr > 0 ? (elapsedHr * fuelBurnKgHr) / 0.8 : 0;
        return {
          position: [lat, lon] as [number, number],
          legIndex: i,
          legDistance,
          etaMin: result ? Math.max(0, (result.mission_duration_hr - elapsedHr) * 60) : null,
          altitude: result?.cruise_altitude_m ?? currentPrediction?.physics.recommended_altitude_m ?? null,
          batteryRemaining,
          fuelRemainingL: Math.max(0, input.fuel_capacity_l - fuelUsedL),
        };
      }
      covered += legDistance;
    }
    return null;
  }, [effectiveRoute, missionProgress, result, input, currentPrediction]);

  const handleCompute = async () => {
    if (effectiveRoute.length < 2) {
      setError('Add at least 2 waypoints on the map (click to place them).');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await computeMission(effectiveRoute, input, missionType, buffer);
      setResult(res);
      setLastMission(res);
      saveMissionToHistory(effectiveRoute, res);
    } catch (e: any) {
      setError(e?.response?.data?.detail || e?.message || 'Mission computation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'kml' | 'gpx') => {
    if (effectiveRoute.length === 0) return;
    const alt = result?.cruise_altitude_m;
    const content = format === 'kml' ? buildKML(effectiveRoute, missionType, alt) : buildGPX(effectiveRoute, missionType, alt);
    downloadTextFile(`${missionType.toLowerCase().replace(/\s+/g, '-')}-mission.${format}`, content, format === 'kml' ? 'application/vnd.google-earth.kml+xml' : 'application/gpx+xml');
  };

  const profileData = useMemo(() => {
    if (!result) return [];
    let cumulative = 0;
    return result.waypoints.map((wp, i) => {
      if (i > 0) cumulative += result.legs[i - 1]?.distance_km ?? 0;
      return {
        distance: Number(cumulative.toFixed(1)),
        terrain: Math.round(wp.terrain_elevation_m),
        minSafe: Math.round(wp.min_safe_altitude_m),
        cruise: Math.round(result.cruise_altitude_m),
      };
    });
  }, [result]);

  return (
    <div>
      <div className="eyebrow mb-2">Mission Planning</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Mission Planner</h1>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Search a location or click the map to lay down waypoints, pick a mission type, and compute
        a terrain-aware cruise altitude, per-leg energy use, and mission duration — using this
        UAV's current design parameters, real terrain elevation, and live weather.
      </p>

      {/* Mission type selector */}
      <div className="flex flex-wrap gap-2 mb-4">
        {MISSION_TYPES.map((mt) => (
          <button
            key={mt.key}
            onClick={() => setMissionType(mt.key)}
            title={mt.desc}
            className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
              missionType === mt.key ? 'bg-cyan text-bg border-cyan' : 'border-border text-muted hover:text-text hover:border-cyan/50'
            }`}
          >
            {mt.key}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted mb-6 max-w-2xl">
        Mission type currently informs route framing and labeling only — the underlying physics
        model doesn't yet have per-mission-profile aerodynamic behavior (e.g. loiter vs cruise
        polar), so power/energy figures below use the same steady-cruise physics regardless of
        type. That's flagged here rather than silently implied.
      </p>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Map */}
        <div className="lg:col-span-2 panel p-2 overflow-hidden">
          {/* Location search */}
          <div className="relative m-1 mb-2" ref={searchBoxRef}>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search a location, e.g. 'Austin, Texas'…"
                  className="w-full bg-bg border border-border rounded-md pl-9 pr-3 py-2 font-mono text-xs text-text focus:border-cyan outline-none"
                />
              </div>
              <button
                onClick={handleSearch} disabled={searching}
                className="px-3 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
            <AnimatePresence>
              {searchResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full mt-1 rounded-md border border-border bg-bg shadow-xl z-[1000] overflow-hidden"
                >
                  {searchResults.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSearchResult(r)}
                      className="block w-full text-left px-3 py-2 text-xs text-muted hover:bg-cyan/10 hover:text-text transition border-b border-border/40 last:border-b-0"
                    >
                      {r.display_name}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="rounded-md overflow-hidden" style={{ height: 420 }}>
            <MapContainer center={DEFAULT_CENTER} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo target={flyTarget} />
              <ClickToAddWaypoint onAdd={addWaypoint} />
              {effectiveRoute[0] && currentPrediction && (
                <Circle
                  center={[effectiveRoute[0].lat, effectiveRoute[0].lon]}
                  radius={Math.max(0, currentPrediction.physics.range_km * 500)}
                  pathOptions={{ color: '#4FD1C5', weight: 1, opacity: 0.45, fillOpacity: 0.05 }}
                />
              )}
              {waypoints.map((w, i) => (
                <Marker key={i} position={[w.lat, w.lon]} />
              ))}
              {effectiveRoute.length > 1 && (
                <Polyline
                  positions={effectiveRoute.map((w) => [w.lat, w.lon])}
                  pathOptions={{ color: '#4FD1C5', weight: 3 }}
                />
              )}
              {planeState && (
                <Marker position={planeState.position} icon={PlaneIcon}>
                  <Popup>
                    <div style={{ minWidth: 180 }}>
                      <strong>Mission aircraft</strong><br />
                      Leg: WP{planeState.legIndex + 1} {'->'} WP{planeState.legIndex + 2}<br />
                      Leg distance: {planeState.legDistance.toFixed(2)} km<br />
                      ETA remaining: {planeState.etaMin !== null ? `${planeState.etaMin.toFixed(1)} min` : 'Compute mission'}<br />
                      Altitude: {planeState.altitude !== null ? `${planeState.altitude.toFixed(0)} m` : 'n/a'}<br />
                      Battery remaining: {planeState.batteryRemaining !== null ? `${planeState.batteryRemaining.toFixed(0)} Wh` : 'n/a'}<br />
                      Fuel remaining: {input.fuel_capacity_l > 0 ? `${planeState.fuelRemainingL.toFixed(1)} L` : 'n/a'}
                    </div>
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
          <p className="text-[11px] text-muted mt-2 px-1">Click anywhere on the map to add a waypoint, in order.</p>
        </div>

        {/* Waypoint list + controls */}
        <div className="panel p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="eyebrow">Waypoints ({waypoints.length})</div>
            {waypoints.length > 1 && (
              <span className="text-[10px] font-mono text-cyan">{liveDistanceKm.toFixed(1)} km</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 mb-3" style={{ maxHeight: 220 }}>
            {waypoints.length === 0 && <p className="text-xs text-muted">No waypoints yet — search a place or click the map.</p>}
            {waypoints.map((w, i) => (
              <div key={i} className="flex items-center justify-between text-xs font-mono border border-border rounded-md px-2 py-1.5">
                <span className="flex items-center gap-1.5 text-text min-w-0 truncate">
                  <MapPin className="w-3 h-3 text-cyan shrink-0" /> {i + 1}. {w.lat.toFixed(3)}, {w.lon.toFixed(3)}
                  {i > 0 && <span className="text-muted shrink-0">· +{haversineKm(waypoints[i - 1], w).toFixed(1)}km</span>}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moveWaypoint(i, -1)} disabled={i === 0} className="text-muted hover:text-cyan disabled:opacity-20 transition p-0.5"><ArrowUp className="w-3 h-3" /></button>
                  <button onClick={() => moveWaypoint(i, 1)} disabled={i === waypoints.length - 1} className="text-muted hover:text-cyan disabled:opacity-20 transition p-0.5"><ArrowDown className="w-3 h-3" /></button>
                  <button onClick={() => removeWaypoint(i)} className="text-muted hover:text-red transition p-0.5"><Trash2 className="w-3 h-3" /></button>
                </span>
              </div>
            ))}
            {returnToLaunch && waypoints.length > 1 && (
              <div className="text-[10px] font-mono text-cyan/70 px-2 flex items-center gap-1.5">
                <RotateCcw className="w-3 h-3" /> Return-to-launch leg back to WP1 included
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button
              onClick={handleOptimizeOrder} disabled={waypoints.length < 3}
              title="Reorder waypoints (2..N) to reduce backtracking — nearest-neighbor heuristic, launch point stays fixed"
              className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1.5 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition disabled:opacity-30"
            >
              <Wand2 className="w-3 h-3" /> Optimize Order
            </button>
            <button
              onClick={() => setReturnToLaunch((r) => !r)}
              className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1.5 rounded-md border transition ${
                returnToLaunch ? 'bg-cyan/15 border-cyan/50 text-cyan' : 'border-border text-muted hover:text-text'
              }`}
            >
              <RotateCcw className="w-3 h-3" /> Return to Launch
            </button>
            <button
              onClick={() => setShowGrid((s) => !s)}
              title="Generate a lawnmower survey grid between the first 2 waypoints"
              className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-1.5 rounded-md border transition ${
                showGrid ? 'bg-cyan/15 border-cyan/50 text-cyan' : 'border-border text-muted hover:text-text'
              }`}
            >
              <Grid3x3 className="w-3 h-3" /> Survey Grid
            </button>
          </div>

          <AnimatePresence>
            {showGrid && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="rounded-md border border-cyan/30 bg-cyan/5 p-3">
                  <p className="text-[10px] text-muted mb-2">
                    Place exactly 2 waypoints as opposite corners of the survey area, then generate a
                    lawnmower coverage pattern between them.
                  </p>
                  <label className="text-[10px] font-mono text-muted block mb-1">Line spacing (m)</label>
                  <div className="flex gap-2">
                    <input
                      type="number" value={gridSpacing} onChange={(e) => setGridSpacing(Number(e.target.value))}
                      className="flex-1 bg-bg border border-border rounded-md px-2 py-1.5 font-mono text-xs text-text"
                    />
                    <button
                      onClick={handleGenerateGrid} disabled={waypoints.length !== 2}
                      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-3 py-1.5 rounded-md bg-cyan text-bg font-semibold disabled:opacity-30"
                    >
                      Generate
                    </button>
                  </div>
                  {waypoints.length !== 2 && (
                    <p className="text-[10px] text-amber mt-1.5">Currently {waypoints.length} waypoint(s) — need exactly 2.</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <label className="text-[10px] font-mono text-muted mb-1 block">Terrain safety buffer (m)</label>
          <input
            type="number" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}
            className="w-full bg-bg border border-border rounded-md px-2.5 py-1.5 font-mono text-xs text-text mb-3"
          />

          <div className="flex gap-2 mb-2">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleCompute} disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              Compute Mission
            </motion.button>
            <button onClick={clearAll} className="px-3 py-2.5 rounded-md border border-border text-muted hover:text-red hover:border-red/50 transition">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleExport('kml')} disabled={waypoints.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase px-2 py-2 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition disabled:opacity-30"
            >
              <Download className="w-3 h-3" /> KML
            </button>
            <button
              onClick={() => handleExport('gpx')} disabled={waypoints.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase px-2 py-2 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition disabled:opacity-30"
            >
              <Download className="w-3 h-3" /> GPX
            </button>
          </div>

          {error && (
            <p className="text-xs text-red mt-2 flex items-start gap-1.5">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 shrink-0" /></button>
            </p>
          )}
        </div>
      </div>

      {result && (
        <>
          {/* Summary stats */}
          <div className="flex justify-end mb-2">
            <NarrateButton
              text={narrateMissionSummary(
                result.mission_type,
                result.waypoints.length,
                result.mission_duration_hr * 60,
                result.total_distance_km,
                result.energy_source === 'fuel' ? (result.fuel_margin_pct ?? 0) : result.battery_margin_pct
              )}
              label="Narrate Summary"
            />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="panel p-4">
              <div className="eyebrow">Mission Duration</div>
              <div className="font-mono text-2xl text-text mt-1">{(result.mission_duration_hr * 60).toFixed(0)}<span className="text-sm text-muted ml-1">min</span></div>
            </div>
            <div className="panel p-4">
              <div className="eyebrow">Total Distance</div>
              <div className="font-mono text-2xl text-text mt-1">{result.total_distance_km.toFixed(1)}<span className="text-sm text-muted ml-1">km</span></div>
            </div>
            <div className="panel p-4">
              <div className="eyebrow">Cruise Altitude</div>
              <div className="font-mono text-2xl text-cyan mt-1">{result.cruise_altitude_m.toFixed(0)}<span className="text-sm text-muted ml-1">m</span></div>
            </div>
            <div className="panel p-4">
              <div className="eyebrow">{result.energy_source === 'fuel' ? 'Fuel Margin' : 'Battery Margin'}</div>
              {(() => {
                const margin = result.energy_source === 'fuel' ? (result.fuel_margin_pct ?? 0) : result.battery_margin_pct;
                return (
                  <div className={`font-mono text-2xl mt-1 ${margin > 20 ? 'text-green' : margin > 0 ? 'text-amber' : 'text-red'}`}>
                    {margin.toFixed(0)}<span className="text-sm text-muted ml-1">%</span>
                  </div>
                );
              })()}
              {result.energy_source === 'fuel' && result.total_fuel_used_l != null && (
                <div className="text-[10px] text-muted mt-1">{result.total_fuel_used_l.toFixed(1)} L used</div>
              )}
              {result.energy_source !== 'fuel' && (
                <div className="text-[10px] text-muted mt-1">{result.total_energy_wh.toFixed(0)} Wh used</div>
              )}
            </div>
          </div>

          {/* Altitude profile */}
          <div className="panel p-5 mb-6">
            <div className="eyebrow mb-4">Altitude Profile Along Route</div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={profileData}>
                <CartesianGrid stroke={c.grid} strokeDasharray="3 3" />
                <XAxis dataKey="distance" stroke={c.axis} fontSize={10} label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5, fill: c.axis, fontSize: 10 }} />
                <YAxis stroke={c.axis} fontSize={10} label={{ value: 'Altitude (m)', angle: -90, position: 'insideLeft', fill: c.axis, fontSize: 10 }} />
                <Tooltip contentStyle={{ background: c.tooltipBg, border: `1px solid ${c.tooltipBorder}`, color: c.tooltipText, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={result.cruise_altitude_m} stroke={c.cyan} strokeDasharray="4 4" label={{ value: 'Cruise', fill: c.cyan, fontSize: 10 }} />
                <Area type="monotone" dataKey="terrain" name="Terrain elevation" stroke={c.amber} fill={c.amber} fillOpacity={0.25} />
                <Area type="monotone" dataKey="minSafe" name="Min safe altitude" stroke={c.red} fill="none" strokeDasharray="3 3" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-muted mt-2">
              Terrain source: {result.elevation_source}. Min safe altitude = terrain + {buffer} m buffer.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-6">
            {/* Warnings */}
            <div className="panel p-5">
              <div className="eyebrow mb-3">Mission Warnings</div>
              <ul className="space-y-2">
                {result.warnings.map((w, i) => (
                  <li key={i} className={`text-xs leading-relaxed flex gap-2 ${w.startsWith('No conflicts') ? 'text-green' : 'text-amber'}`}>
                    <span>{w.startsWith('No conflicts') ? '✓' : '▲'}</span>{w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Weather */}
            <div className="panel p-5">
              <div className="eyebrow mb-3">Live Weather (start waypoint)</div>
              {result.weather?.available ? (
                <div className="grid grid-cols-2 gap-3 font-mono text-sm">
                  <div className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-amber" /> {result.weather.temperature_c?.toFixed(1)}°C</div>
                  <div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-cyan" /> {result.weather.pressure_hpa?.toFixed(0)} hPa</div>
                  <div className="flex items-center gap-2"><Droplets className="w-4 h-4 text-cyan" /> {result.weather.humidity_pct?.toFixed(0)}%</div>
                  <div className="flex items-center gap-2"><Wind className="w-4 h-4 text-muted" /> {result.weather.wind_speed_ms?.toFixed(1)} m/s</div>
                </div>
              ) : (
                <p className="text-xs text-muted">Weather service unavailable right now (needs outbound internet access to Open-Meteo). Informational only — not yet fed back into the physics engine.</p>
              )}
            </div>
          </div>

          {/* Leg table */}
          <div className="panel p-5 overflow-x-auto">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="eyebrow">Per-Leg Breakdown</div>
              <button
                onClick={handleCompute}
                className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase text-muted hover:text-cyan transition"
              >
                <RefreshCw className="w-3 h-3" /> Recompute
              </button>
            </div>
            <table className="w-full text-xs font-mono min-w-[480px]">
              <thead>
                <tr className="text-muted uppercase border-b border-border">
                  <th className="text-left py-2 pr-4">Leg</th>
                  <th className="text-right py-2 px-3">Distance</th>
                  <th className="text-right py-2 px-3">Time</th>
                  <th className="text-right py-2 pl-3">Energy</th>
                </tr>
              </thead>
              <tbody>
                {result.legs.map((leg, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 pr-4 text-text">WP{leg.from_index + 1} → WP{leg.to_index + 1}</td>
                    <td className="text-right px-3 text-muted">{leg.distance_km.toFixed(2)} km</td>
                    <td className="text-right px-3 text-muted">{(leg.time_hr * 60).toFixed(1)} min</td>
                    <td className="text-right pl-3 text-cyan">{leg.energy_wh.toFixed(1)} Wh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
