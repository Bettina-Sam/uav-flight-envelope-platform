import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { UAVInput, PredictResponse, DEFAULT_UAV_INPUT, MissionComputeResponse } from '../types';
import { predict as apiPredict } from '../api/client';

interface UAVContextValue {
  input: UAVInput;
  setInput: (i: UAVInput) => void;
  result: PredictResponse | null;
  loading: boolean;
  error: string | null;
  runPrediction: (i?: UAVInput) => Promise<PredictResponse | null>;
  lastMission: MissionComputeResponse | null;
  setLastMission: (m: MissionComputeResponse | null) => void;
}

const UAVContext = createContext<UAVContextValue | undefined>(undefined);

// Session-only persistence (survives a reload within the same tab, cleared
// when the tab actually closes) so that a chunk-loading hiccup, an
// accidental refresh, or a mobile browser reclaiming a backgrounded tab
// doesn't force you to re-run the UAV Input step from scratch. This is
// deliberately sessionStorage, not localStorage: "what I was just working
// on" should survive a reload, but shouldn't quietly persist forever or
// collide with the separate, deliberate Saved Configurations feature.
const SESSION_KEY = 'uav-envelope-session-v1';
const CURRENT_MODEL_NAME = 'TAPASLocalExtraTrees';

interface PersistedSession {
  input: UAVInput;
  result: PredictResponse | null;
  lastMission: MissionComputeResponse | null;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

function saveSession(data: PersistedSession) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // sessionStorage can throw in some privacy modes / when full — losing
    // the auto-save silently is fine, it's a convenience, not a requirement.
  }
}

function migrateSession(session: PersistedSession): PersistedSession {
  const i = session.input;
  const hasOldModelResult = !!session.result && session.result.ml.model_used !== CURRENT_MODEL_NAME;
  const isOldTapasDefault =
    i.aircraft_name === 'TAPAS BH-201' &&
    i.mass_kg === 2850 &&
    i.payload_kg === 350 &&
    i.wing_area_m2 === 21.2 &&
    i.cruise_speed_ms === 38;

  if (hasOldModelResult) {
    return { input: isOldTapasDefault ? DEFAULT_UAV_INPUT : session.input, result: null, lastMission: session.lastMission };
  }
  if (!isOldTapasDefault) return session;
  return { input: DEFAULT_UAV_INPUT, result: null, lastMission: null };
}

export function UAVProvider({ children }: { children: ReactNode }) {
  const restored = useRef<PersistedSession | null>(null);
  if (restored.current === null) {
    restored.current = migrateSession(loadSession() ?? { input: DEFAULT_UAV_INPUT, result: null, lastMission: null });
  }

  const [input, setInput] = useState<UAVInput>(restored.current.input);
  const [result, setResult] = useState<PredictResponse | null>(restored.current.result);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMission, setLastMission] = useState<MissionComputeResponse | null>(restored.current.lastMission);

  useEffect(() => {
    saveSession({ input, result, lastMission });
  }, [input, result, lastMission]);

  const runPrediction = useCallback(async (i?: UAVInput) => {
    const payload = i ?? input;
    setLoading(true);
    setError(null);
    try {
      const res = await apiPredict(payload);
      setResult(res);
      setInput(payload);
      return res;
    } catch (e: any) {
      const msg = e?.response?.data?.detail
        ? JSON.stringify(e.response.data.detail)
        : e?.message || 'Prediction failed. Is the backend running?';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [input]);

  return (
    <UAVContext.Provider value={{ input, setInput, result, loading, error, runPrediction, lastMission, setLastMission }}>
      {children}
    </UAVContext.Provider>
  );
}

export function useUAV() {
  const ctx = useContext(UAVContext);
  if (!ctx) throw new Error('useUAV must be used within UAVProvider');
  return ctx;
}
