import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UAVProvider } from './context/UAVContext';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AnimatedBackground from './components/AnimatedBackground';

import Home from './pages/Home';
import UAVInputPage from './pages/UAVInputPage';
import PhysicsCalculatorPage from './pages/PhysicsCalculatorPage';
import MLPredictionPage from './pages/MLPredictionPage';
import FlightEnvelopeDashboard from './pages/FlightEnvelopeDashboard';
import ComparisonPage from './pages/ComparisonPage';
import PerformanceAnalysisPage from './pages/PerformanceAnalysisPage';
import UncertaintyAnalysisPage from './pages/UncertaintyAnalysisPage';
import DesignStudioPage from './pages/DesignStudioPage';
import FeatureImportancePage from './pages/FeatureImportancePage';
import SensitivityAnalysisPage from './pages/SensitivityAnalysisPage';
import BatchPredictionPage from './pages/BatchPredictionPage';
import ReportGenerationPage from './pages/ReportGenerationPage';
import AboutPage from './pages/AboutPage';
import { lazyRetry } from './lib/lazyRetry';

const MissionPlannerPage = lazy(() => lazyRetry(() => import('./pages/MissionPlannerPage'), 'MissionPlannerPage'));
const GlobalMissionMapPage = lazy(() => lazyRetry(() => import('./pages/GlobalMissionMapPage'), 'GlobalMissionMapPage'));
const CommandCenterPage = lazy(() => lazyRetry(() => import('./pages/CommandCenterPage'), 'CommandCenterPage'));

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6, position: 'absolute' }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/input" element={<UAVInputPage />} />
          <Route path="/physics" element={<PhysicsCalculatorPage />} />
          <Route path="/ml" element={<MLPredictionPage />} />
          <Route path="/dashboard" element={<FlightEnvelopeDashboard />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/performance" element={<PerformanceAnalysisPage />} />
          <Route path="/uncertainty" element={<UncertaintyAnalysisPage />} />
          <Route path="/design-studio" element={<DesignStudioPage />} />
          <Route path="/mission" element={<Suspense fallback={<div className="text-muted text-sm py-12 text-center">Loading Mission Planner…</div>}><MissionPlannerPage /></Suspense>} />
          <Route path="/missions" element={<Suspense fallback={<div className="text-muted text-sm py-12 text-center">Loading Mission Map…</div>}><GlobalMissionMapPage /></Suspense>} />
          <Route path="/command-center" element={<Suspense fallback={<div className="text-muted text-sm py-12 text-center">Loading Command Center…</div>}><CommandCenterPage /></Suspense>} />
          <Route path="/feature-importance" element={<FeatureImportancePage />} />
          <Route path="/sensitivity" element={<SensitivityAnalysisPage />} />
          <Route path="/batch" element={<BatchPredictionPage />} />
          <Route path="/report" element={<ReportGenerationPage />} />
          <Route path="/about" element={<AboutPage />} />

          {/* Backward-compatible redirects from the pre-redesign nav structure */}
          <Route path="/analysis/range" element={<Navigate to="/performance?tab=range" replace />} />
          <Route path="/analysis/endurance" element={<Navigate to="/performance?tab=endurance" replace />} />
          <Route path="/auto-design" element={<Navigate to="/design-studio?tab=auto-design" replace />} />
          <Route path="/failure-simulation" element={<Navigate to="/design-studio?tab=failure-sim" replace />} />
          <Route path="/saved-configs" element={<Navigate to="/report" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <UAVProvider>
        <div className="min-h-screen flex flex-col relative">
          <AnimatedBackground />
          <Navbar />
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
            <AnimatedRoutes />
          </main>
          <Footer />
        </div>
      </UAVProvider>
    </ThemeProvider>
  );
}
