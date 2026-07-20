import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { downloadReport } from '../api/client';
import SavedConfigsPanel from './SavedConfigsPanel';
import FlightProfileVisualizer from '../components/FlightProfileVisualizer';

export default function ReportGenerationPage() {
  const { input, result, lastMission } = useUAV();
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flightProfileRef = useRef<HTMLDivElement>(null);

  if (!result) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <p className="text-muted mb-4">Run a prediction first to generate a report.</p>
        <Link to="/input" className="text-cyan font-mono text-xs uppercase tracking-wider">Go to UAV Input →</Link>
      </div>
    );
  }

  const handleDownload = async (format: 'pdf' | 'csv') => {
    setDownloading(format);
    setError(null);
    try {
      let flightProfileImage: string | null = null;
      if (format === 'pdf' && flightProfileRef.current) {
        const canvas = await html2canvas(flightProfileRef.current, {
          backgroundColor: null,
          scale: 2,
        });
        flightProfileImage = canvas.toDataURL('image/png');
      }
      await downloadReport(input, format, format === 'pdf' ? lastMission : undefined, flightProfileImage);
    } catch (e: any) {
      setError(e?.message || 'Report generation failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="fixed -left-[10000px] top-0 w-[760px] pointer-events-none" aria-hidden="true">
        <div ref={flightProfileRef}>
          <FlightProfileVisualizer
            minAltitude={result.physics.min_altitude_m}
            maxAltitude={result.physics.max_altitude_m}
            recommendedAltitude={result.physics.recommended_altitude_m}
            serviceCeiling={result.physics.service_ceiling_m}
            cruiseSpeedMs={input.cruise_speed_ms}
            rateOfClimbMs={result.physics.rate_of_climb_ms}
            safetyStatus={result.physics.safety_status}
            numEngines={result.physics.engine_out?.engines_operating ?? 1}
            silent
          />
        </div>
      </div>
      <div className="eyebrow mb-2">Step 8</div>
      <h1 className="font-display text-3xl font-semibold mb-2">Export Report</h1>
      <p className="text-muted text-sm mb-4 max-w-2xl">
        Generate a downloadable engineering summary: cover page, executive summary, configuration,
        physics results, ML results with confidence intervals, physics-vs-ML comparison, local
        explanation, optimization suggestions, failure simulation, design score, and — if you've
        planned one — the mission profile.
      </p>
      {lastMission ? (
        <p className="text-xs text-cyan mb-6">
          ✓ A mission plan from this session ({lastMission.mission_type}, {lastMission.waypoints.length} waypoints)
          will be included in the PDF.
        </p>
      ) : (
        <p className="text-xs text-muted mb-6">
          No mission plan in this session yet — the PDF's Mission Profile section will note that. Visit{' '}
          <Link to="/mission" className="text-cyan">Mission Planner</Link> first if you'd like it included.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6 max-w-2xl">
        <button
          onClick={() => handleDownload('pdf')}
          disabled={downloading !== null}
          className="panel p-6 flex flex-col items-center gap-3 hover:border-cyan/50 transition disabled:opacity-50"
        >
          {downloading === 'pdf' ? <Loader2 className="w-8 h-8 text-cyan animate-spin" /> : <FileText className="w-8 h-8 text-cyan" />}
          <div className="font-display font-semibold">PDF Report</div>
          <div className="text-xs text-muted text-center">Full engineering report — 12 sections, tables, charts, and reasoning</div>
        </button>
        <button
          onClick={() => handleDownload('csv')}
          disabled={downloading !== null}
          className="panel p-6 flex flex-col items-center gap-3 hover:border-cyan/50 transition disabled:opacity-50"
        >
          {downloading === 'csv' ? <Loader2 className="w-8 h-8 text-amber animate-spin" /> : <FileSpreadsheet className="w-8 h-8 text-amber" />}
          <div className="font-display font-semibold">CSV Export</div>
          <div className="text-xs text-muted text-center">Raw key/value data for further analysis in Excel/Sheets</div>
        </button>
      </div>

      {error && <div className="panel p-4 border-red/30 text-red text-sm max-w-2xl">{error}</div>}

      <div className="panel p-5 mt-6 max-w-2xl">
        <div className="eyebrow mb-2">Current Configuration Snapshot</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono text-muted">
          {Object.entries(input).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k}</span><span className="text-text">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 pt-8 border-t border-border">
        <SavedConfigsPanel />
      </div>
    </div>
  );
}
