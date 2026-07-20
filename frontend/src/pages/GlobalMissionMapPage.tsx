import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';
import { Download, Trash2, MapPin } from 'lucide-react';
import { listMissionHistory, deleteMissionFromHistory, HistoricalMission, MISSION_TYPE_COLORS } from '../lib/missionHistory';

const DEFAULT_CENTER: [number, number] = [20, 0];

export default function GlobalMissionMapPage() {
  const [missions, setMissions] = useState<HistoricalMission[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const mapExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMissions(listMissionHistory()); }, []);

  const handleDelete = (id: string) => {
    deleteMissionFromHistory(id);
    setMissions(listMissionHistory());
    if (selected === id) setSelected(null);
  };

  const allPoints = missions.flatMap((m) => m.waypoints.map((w) => [w.lat, w.lon] as [number, number]));
  const center: [number, number] = allPoints.length > 0
    ? [allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length, allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length]
    : DEFAULT_CENTER;

  const handleDownloadPng = async () => {
    if (!mapExportRef.current) return;
    const canvas = await html2canvas(mapExportRef.current, {
      backgroundColor: null,
      useCORS: true,
      allowTaint: true,
      scale: 2,
    });
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'global-mission-map.png';
    link.click();
  };

  return (
    <div>
      <div className="eyebrow mb-2">Mission History</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Global Mission Map</h1>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
      <p className="text-muted text-sm max-w-2xl">
        Every mission you've computed, in this browser, on one map — color-coded by mission type.
        Click a mission in the list to highlight its route.
      </p>
        {missions.length > 0 && (
          <button onClick={handleDownloadPng} className="inline-flex items-center gap-1.5 border border-border text-muted hover:text-cyan hover:border-cyan/50 font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-md transition">
            <Download className="w-3.5 h-3.5" /> Download PNG
          </button>
        )}
      </div>

      {missions.length === 0 ? (
        <div className="panel p-10 text-center">
          <p className="text-muted text-sm mb-4">No missions computed yet.</p>
          <Link to="/mission" className="text-cyan font-mono text-xs uppercase tracking-wider">Plan a mission →</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <div ref={mapExportRef} className="lg:col-span-2 panel p-2 overflow-hidden">
            <div className="rounded-md overflow-hidden" style={{ height: 480 }}>
              <MapContainer center={center} zoom={allPoints.length > 0 ? 6 : 2} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {missions.map((m) => {
                  const color = MISSION_TYPE_COLORS[m.missionType] || '#4FD1C5';
                  const isSelected = selected === m.id;
                  return (
                    <Fragment key={m.id}>
                      <Polyline
                        positions={m.waypoints.map((w) => [w.lat, w.lon])}
                        pathOptions={{ color, weight: isSelected ? 5 : 2, opacity: isSelected || !selected ? 0.9 : 0.25 }}
                      />
                      {m.waypoints.map((w, i) => (
                        <CircleMarker key={i} center={[w.lat, w.lon]} radius={isSelected ? 5 : 3} pathOptions={{ color, fillOpacity: 0.8 }}>
                          <LeafletTooltip>{m.missionType} · WP{i + 1}</LeafletTooltip>
                        </CircleMarker>
                      ))}
                    </Fragment>
                  );
                })}
              </MapContainer>
            </div>
          </div>

          <div className="panel p-4 overflow-y-auto" style={{ maxHeight: 480 }}>
            <div className="eyebrow mb-3">Missions ({missions.length})</div>
            <div className="space-y-2">
              {missions.map((m, i) => (
                <motion.button
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(selected === m.id ? null : m.id)}
                  className={`w-full text-left border rounded-md p-3 transition ${selected === m.id ? 'border-cyan/50 bg-cyan/5' : 'border-border hover:border-cyan/30'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs font-mono text-text">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: MISSION_TYPE_COLORS[m.missionType] || '#4FD1C5' }} />
                      {m.missionType}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }} className="text-muted hover:text-red transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="text-[10px] text-muted flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.waypoints.length} waypoints · {m.result.total_distance_km.toFixed(1)} km</div>
                  <div className="text-[10px] text-muted">{new Date(m.savedAt).toLocaleString()}</div>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
