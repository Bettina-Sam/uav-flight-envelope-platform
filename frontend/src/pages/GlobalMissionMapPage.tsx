import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, Marker, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, CheckCircle2, Download, Loader2, MapPin, Plane, Trash2 } from 'lucide-react';
import { listMissionHistory, deleteMissionFromHistory, HistoricalMission, MISSION_TYPE_COLORS } from '../lib/missionHistory';

const DEFAULT_CENTER: [number, number] = [20, 0];

function hasConflict(mission: HistoricalMission) {
  const r = mission.result;
  return r.terrain_conflict || (r.energy_source === 'fuel' ? (r.fuel_margin_pct ?? 0) < 0 : r.battery_margin_pct < 0)
    || r.warnings.some((w) => !w.startsWith('No conflicts') && !w.includes('service was unreachable'));
}

function waypointIcon(index: number, color: string, conflict: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [30, 38],
    iconAnchor: [15, 34],
    tooltipAnchor: [0, -30],
    html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${conflict ? '#EF4444' : color};border:3px solid #07111f;box-shadow:0 4px 14px rgba(0,0,0,.55);display:grid;place-items:center">
      <span style="transform:rotate(45deg);color:white;font:700 11px ui-monospace,monospace">${index + 1}</span>
    </div>`,
  });
}

function aircraftIcon(bearing: number) {
  return L.divIcon({
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    html: `<div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#07111f;border:2px solid #4FD1C5;box-shadow:0 0 20px rgba(79,209,197,.8);transform:rotate(${bearing}deg)">
      <span style="font-size:20px;line-height:1;color:#fff;transform:rotate(45deg)">✈</span>
    </div>`,
  });
}

function FitRoutes({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 10);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 11 });
  }, [map, points]);
  return null;
}

function AnimatedAircraft({ route }: { route: [number, number][] }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    setProgress(0);
    if (route.length < 2) return;
    const timer = window.setInterval(() => setProgress((p) => (p + 0.004) % 1), 40);
    return () => window.clearInterval(timer);
  }, [route]);
  if (route.length < 2) return null;
  const scaled = progress * (route.length - 1);
  const leg = Math.min(route.length - 2, Math.floor(scaled));
  const t = scaled - leg;
  const a = route[leg];
  const b = route[leg + 1];
  const position: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const bearing = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  return <Marker position={position} icon={aircraftIcon(bearing)} zIndexOffset={1000} interactive={false} />;
}

export default function GlobalMissionMapPage() {
  const [missions, setMissions] = useState<HistoricalMission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const mapExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMissions(listMissionHistory()); }, []);

  const handleDelete = (id: string) => {
    deleteMissionFromHistory(id);
    setMissions(listMissionHistory());
    if (selected === id) setSelected(null);
  };

  const activeMission = missions.find((m) => m.id === selected) ?? missions[0];
  const allPoints = useMemo(() => missions.flatMap((m) => m.waypoints.map((w) => [w.lat, w.lon] as [number, number])), [missions]);
  const center: [number, number] = allPoints.length
    ? [allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length, allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length]
    : DEFAULT_CENTER;
  const conflictCount = missions.filter(hasConflict).length;

  const handleDownloadPng = async () => {
    if (!mapExportRef.current) return;
    setExporting(true);
    setExportError('');
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      const canvas = await html2canvas(mapExportRef.current, {
        backgroundColor: '#07111f',
        useCORS: true,
        allowTaint: false,
        scale: Math.min(2, window.devicePixelRatio || 1),
        logging: false,
      });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png', 1);
      link.download = `global-mission-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
    } catch {
      setExportError('PNG export failed. Wait for the map tiles to finish loading and try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="eyebrow mb-2">Mission History</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Global Mission Map</h1>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <p className="text-muted text-sm max-w-2xl">
          Saved routes are color-coded by mission type. Select a route to follow its animated
          aircraft; unsafe altitude or energy margins are highlighted in red.
        </p>
        {missions.length > 0 && (
          <button disabled={exporting} onClick={handleDownloadPng} className="inline-flex items-center gap-1.5 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-md font-semibold disabled:opacity-60">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? 'Rendering…' : 'Download Map PNG'}
          </button>
        )}
      </div>
      {exportError && <div className="mb-4 text-xs text-red border border-red/30 bg-red/10 rounded-md px-3 py-2">{exportError}</div>}

      {missions.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-muted text-sm mb-4">No missions computed yet.</p>
          <Link to="/mission" className="text-cyan font-mono text-xs uppercase tracking-wider">Plan a mission →</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div ref={mapExportRef} className="lg:col-span-2 panel p-3 overflow-hidden bg-bg">
            <div className="flex items-center justify-between gap-3 px-2 pb-3">
              <div>
                <div className="font-display text-lg font-semibold">UAV Mission Overview</div>
                <div className="text-[10px] font-mono text-muted">{missions.length} routes · {allPoints.length} waypoints · generated {new Date().toLocaleDateString()}</div>
              </div>
              <div className={`flex items-center gap-1.5 text-xs font-mono ${conflictCount ? 'text-red' : 'text-green'}`}>
                {conflictCount ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                {conflictCount ? `${conflictCount} conflict${conflictCount > 1 ? 's' : ''}` : 'All clear'}
              </div>
            </div>
            <div className="rounded-md overflow-hidden border border-border" style={{ height: 500 }}>
              <MapContainer center={center} zoom={allPoints.length > 0 ? 6 : 2} style={{ height: '100%', width: '100%' }}>
                <TileLayer crossOrigin="anonymous" attribution="© OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitRoutes points={selected && activeMission ? activeMission.waypoints.map((w) => [w.lat, w.lon]) : allPoints} />
                {missions.map((m) => {
                  const conflict = hasConflict(m);
                  const color = conflict ? '#EF4444' : (MISSION_TYPE_COLORS[m.missionType] || '#4FD1C5');
                  const isSelected = activeMission?.id === m.id;
                  return (
                    <Fragment key={m.id}>
                      <Polyline positions={m.waypoints.map((w) => [w.lat, w.lon])}
                        pathOptions={{ color, weight: isSelected ? 6 : 3, opacity: isSelected || !selected ? 0.95 : 0.2, dashArray: conflict ? '10 7' : undefined }} />
                      {m.waypoints.map((w, i) => (
                        <Marker key={i} position={[w.lat, w.lon]} icon={waypointIcon(i, color, conflict)} opacity={isSelected || !selected ? 1 : 0.35}>
                          <LeafletTooltip direction="top">
                            <strong>{m.missionType} · WP{i + 1}</strong><br />
                            {w.lat.toFixed(4)}, {w.lon.toFixed(4)}{conflict ? <><br /><span style={{ color: '#EF4444' }}>Conflict detected</span></> : null}
                          </LeafletTooltip>
                        </Marker>
                      ))}
                    </Fragment>
                  );
                })}
                {activeMission && <AnimatedAircraft route={activeMission.waypoints.map((w) => [w.lat, w.lon])} />}
              </MapContainer>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 px-1 text-[10px] font-mono text-muted">
              {Object.entries(MISSION_TYPE_COLORS).map(([type, color]) => <span key={type} className="flex items-center gap-1"><i className="w-2 h-2 rounded-full" style={{ background: color }} />{type}</span>)}
              <span className="flex items-center gap-1 text-red"><i className="w-2 h-2 rounded-full bg-red" />Conflict</span>
            </div>
          </div>

          <div className="panel p-4 overflow-y-auto" style={{ maxHeight: 580 }}>
            <div className="eyebrow mb-3">Missions ({missions.length})</div>
            <div className="space-y-2">
              {missions.map((m, i) => {
                const conflict = hasConflict(m);
                return (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    role="button" tabIndex={0} onClick={() => setSelected(selected === m.id ? null : m.id)}
                    className={`w-full text-left border rounded-md p-3 cursor-pointer transition ${selected === m.id ? 'border-cyan/50 bg-cyan/5' : conflict ? 'border-red/40 bg-red/5' : 'border-border hover:border-cyan/30'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 text-xs font-mono text-text">
                        {conflict ? <AlertTriangle className="w-3.5 h-3.5 text-red" /> : <Plane className="w-3.5 h-3.5 text-cyan" />} {m.missionType}
                      </span>
                      <button aria-label="Delete mission" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-muted hover:text-red"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="text-[10px] text-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.waypoints.length} waypoints · {m.result.total_distance_km.toFixed(1)} km</div>
                    <div className={`text-[10px] mt-1 ${conflict ? 'text-red' : 'text-green'}`}>{conflict ? 'Review mission conflicts' : 'No detected conflicts'}</div>
                    <div className="text-[10px] text-muted">{new Date(m.savedAt).toLocaleString()}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
