import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Save, Trash2, RotateCcw, GitCompare, Loader2, Share2, Copy, Check } from 'lucide-react';
import { useUAV } from '../context/UAVContext';
import { listSavedConfigs, saveConfig, deleteConfig, SavedConfig } from '../lib/savedConfigs';
import { buildShareableUrl } from '../lib/shareLink';
import { predict } from '../api/client';
import { PredictResponse } from '../types';
import { computeAchievements } from '../lib/achievements';
import AchievementBadges from '../components/AchievementBadges';

export default function SavedConfigsPanel() {
  const { input, setInput, runPrediction, result } = useUAV();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<SavedConfig[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [compareResults, setCompareResults] = useState<Record<string, PredictResponse> | null>(null);
  const [comparing, setComparing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setConfigs(listSavedConfigs()); }, []);

  const handleSave = () => {
    saveConfig(name, input);
    setConfigs(listSavedConfigs());
    setName('');
  };

  const handleDelete = (id: string) => {
    deleteConfig(id);
    setConfigs(listSavedConfigs());
    setSelected((s) => s.filter((x) => x !== id));
  };

  const handleRestore = async (cfg: SavedConfig) => {
    setInput(cfg.input);
    await runPrediction(cfg.input);
    navigate('/physics');
  };

  const toggleSelect = (id: string) => {
    setCompareResults(null);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]));
  };

  const handleCompare = async () => {
    if (selected.length !== 2) return;
    setComparing(true);
    try {
      const results: Record<string, PredictResponse> = {};
      for (const id of selected) {
        const cfg = configs.find((c) => c.id === id);
        if (!cfg) continue;
        results[id] = await predict(cfg.input);
      }
      setCompareResults(results);
    } finally {
      setComparing(false);
    }
  };

  const handleCopyLink = async (cfg?: SavedConfig) => {
    const url = buildShareableUrl(cfg ? cfg.input : input);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div>
      <div className="eyebrow mb-2">Saved Configurations &amp; Shareable Links</div>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        Saved configs live in this browser's local storage (no account needed, nothing leaves your
        machine). Shareable links encode the full configuration in the URL itself — anyone who opens
        the link sees exactly this setup, no server-side storage required.
      </p>

      {/* Milestones */}
      <div className="panel p-5 mb-6">
        <AchievementBadges achievements={computeAchievements(configs, result)} />
      </div>

      {/* Save current */}
      <div className="panel p-5 mb-6">
        <div className="eyebrow mb-3">Save Current Configuration</div>
        <div className="flex flex-wrap gap-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder={`e.g. "Long-endurance mapping variant"`}
            className="flex-1 min-w-[220px] bg-bg border border-border rounded-md px-3 py-2 font-mono text-sm text-text"
          />
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-md font-semibold hover:opacity-90 transition"
          >
            <Save className="w-4 h-4" /> Save
          </motion.button>
          <button
            onClick={() => handleCopyLink()}
            className="inline-flex items-center gap-2 border border-border text-muted hover:text-cyan hover:border-cyan/50 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-md transition"
          >
            {copied ? <Check className="w-4 h-4 text-green" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Shareable Link'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="eyebrow mb-3">History ({configs.length})</div>
      {configs.length === 0 ? (
        <div className="panel p-8 text-center text-muted text-sm mb-6">No saved configurations yet.</div>
      ) : (
        <div className="space-y-2 mb-6">
          {configs.map((cfg, i) => (
            <motion.div
              key={cfg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`panel p-4 flex items-center justify-between flex-wrap gap-3 ${selected.includes(cfg.id) ? 'border-cyan/50' : ''}`}
            >
              <label className="flex items-center gap-3 cursor-pointer min-w-0">
                <input type="checkbox" checked={selected.includes(cfg.id)} onChange={() => toggleSelect(cfg.id)} className="accent-cyan" />
                <div className="min-w-0">
                  <div className="font-mono text-sm text-text truncate">{cfg.name}</div>
                  <div className="text-[10px] text-muted">{new Date(cfg.savedAt).toLocaleString()} · {cfg.input.mass_kg}kg · {cfg.input.wing_area_m2}m² wing</div>
                </div>
              </label>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => handleCopyLink(cfg)} title="Copy shareable link" className="p-2 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition"><Share2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleRestore(cfg)} title="Restore this configuration" className="p-2 rounded-md border border-border text-muted hover:text-cyan hover:border-cyan/50 transition"><RotateCcw className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(cfg.id)} title="Delete" className="p-2 rounded-md border border-border text-muted hover:text-red hover:border-red/50 transition"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Compare */}
      {configs.length >= 2 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="eyebrow flex items-center gap-2"><GitCompare className="w-4 h-4 text-cyan" /> Compare Two Configurations</div>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={handleCompare} disabled={selected.length !== 2 || comparing}
              className="inline-flex items-center gap-2 bg-cyan text-bg font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded-md font-semibold hover:opacity-90 transition disabled:opacity-40"
            >
              {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <GitCompare className="w-3.5 h-3.5" />} Compare Selected
            </motion.button>
          </div>
          {selected.length !== 2 ? (
            <p className="text-xs text-muted">Select exactly 2 configurations above (checkboxes) to compare.</p>
          ) : compareResults ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono min-w-[520px]">
                <thead>
                  <tr className="text-muted uppercase border-b border-border">
                    <th className="text-left py-2 pr-4">Metric</th>
                    {selected.map((id) => (
                      <th key={id} className="text-right py-2 px-3">{configs.find((c) => c.id === id)?.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(['recommended_altitude_m', 'endurance_hr', 'range_km', 'l_over_d', 'rate_of_climb_ms', 'safety_status'] as const).map((k) => (
                    <tr key={k} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-text">{k.replace(/_/g, ' ')}</td>
                      {selected.map((id) => (
                        <td key={id} className="text-right px-3 text-cyan">
                          {typeof compareResults[id]?.physics[k] === 'number'
                            ? (compareResults[id].physics[k] as number).toFixed(2)
                            : compareResults[id]?.physics[k]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted">Click "Compare Selected" to run physics on both and see them side by side.</p>
          )}
        </div>
      )}

    </div>
  );
}
