import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Download } from 'lucide-react';
import { batchPredict } from '../api/client';
import SafetyBadge from '../components/SafetyBadge';

const TEMPLATE_HEADER = "aircraft_name,mass_kg,payload_kg,wing_area_m2,l_over_d,cd0,cruise_speed_ms,air_density_kg_m3,sfc_kg_per_n_s,thrust_to_weight,propulsion_efficiency,fuel_capacity_l,propeller_diameter_m,battery_wh,battery_soc,aux_power_w";
const TEMPLATE_ROW = "MyUAV,14,3,0.6,12,0.028,20,1.225,0.000007,0.25,0.8,10,0.3,1200,0.9,480";

export default function BatchPredictionPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const res = await batchPredict(file);
      setRows(res.results);
    } catch (e: any) {
      setError(e?.response?.data?.detail ? JSON.stringify(e.response.data.detail) : e?.message || 'Batch prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`${TEMPLATE_HEADER}\n${TEMPLATE_ROW}\n`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'uav_batch_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResults = () => {
    if (!rows) return;
    const cols = Object.keys(rows[0]);
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'uav_batch_results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="eyebrow mb-2">Step 7</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Batch CSV Prediction</h1>
      <p className="text-muted text-sm mb-8 max-w-2xl">
        Upload a CSV of multiple UAV configurations to get physics + ML predictions for all of
        them at once — useful for comparing design variants.
      </p>

      <div className="panel p-8 border-dashed border-2 border-border text-center mb-6"
           onDragOver={(e) => e.preventDefault()}
           onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}>
        <UploadCloud className="w-8 h-8 text-cyan mx-auto mb-3" />
        <p className="text-sm text-muted mb-4">Drag &amp; drop a CSV file here, or</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => inputRef.current?.click()} className="bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md font-semibold">
            Choose File
          </button>
          <button onClick={downloadTemplate} className="border border-border text-text font-mono text-xs uppercase tracking-wider px-4 py-2.5 rounded-md">
            Download Template
          </button>
        </div>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>

      {loading && <div className="flex items-center gap-2 text-muted mb-6"><Loader2 className="w-4 h-4 animate-spin" /> Processing batch…</div>}
      {error && <div className="panel p-4 border-red/30 text-red text-sm mb-6">{error}</div>}

      {rows && (
        <div className="panel p-5 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="eyebrow">{rows.length} configurations processed</div>
            <button onClick={downloadResults} className="inline-flex items-center gap-2 text-cyan font-mono text-xs uppercase tracking-wider">
              <Download className="w-4 h-4" /> Download Results CSV
            </button>
          </div>
          <table className="w-full text-xs font-mono min-w-[900px]">
            <thead>
              <tr className="text-muted uppercase border-b border-border">
                <th className="text-left py-2 pr-3">#</th>
                <th className="text-right py-2 px-2">Mass</th>
                <th className="text-right py-2 px-2">Phys. Recommended</th>
                <th className="text-right py-2 px-2">ML Recommended</th>
                <th className="text-right py-2 px-2">Phys. Ceiling</th>
                <th className="text-left py-2 px-2">Phys. Status</th>
                <th className="text-left py-2 pl-2">ML Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-muted">{i + 1}</td>
                  {r.error ? (
                    <td colSpan={6} className="text-red py-2">{r.error}</td>
                  ) : (
                    <>
                      <td className="text-right px-2">{r.mass_kg}</td>
                      <td className="text-right px-2 text-cyan">{r.physics_recommended_altitude_m?.toFixed(0)} m</td>
                      <td className="text-right px-2 text-amber">{r.ml_recommended_altitude_m?.toFixed(0)} m</td>
                      <td className="text-right px-2">{r.physics_service_ceiling_m?.toFixed(0)} m</td>
                      <td className="px-2"><SafetyBadge status={r.physics_safety_status} size="sm" /></td>
                      <td className="pl-2"><SafetyBadge status={r.ml_safety_status} size="sm" /></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
