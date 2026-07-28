import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import ComparisonPage from './pages/ComparisonPage';
import PerformanceAnalysisPage from './pages/PerformanceAnalysisPage';
import UncertaintyAnalysisPage from './pages/UncertaintyAnalysisPage';
import BatchPredictionPage from './pages/BatchPredictionPage';

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
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/performance" element={<PerformanceAnalysisPage />} />
          <Route path="/uncertainty" element={<UncertaintyAnalysisPage />} />
          <Route path="/batch" element={<BatchPredictionPage />} />

          <Route path="/analysis/range" element={<Navigate to="/performance?tab=range" replace />} />
          <Route path="/analysis/endurance" element={<Navigate to="/performance?tab=endurance" replace />} />

          {/* Retired envelope and altitude-oriented screens. */}
          <Route path="/dashboard" element={<Navigate to="/performance" replace />} />
          <Route path="/command-center" element={<Navigate to="/performance" replace />} />
          <Route path="/mission" element={<Navigate to="/performance" replace />} />
          <Route path="/missions" element={<Navigate to="/performance" replace />} />
          <Route path="/design-studio" element={<Navigate to="/performance" replace />} />
          <Route path="/feature-importance" element={<Navigate to="/performance" replace />} />
          <Route path="/sensitivity" element={<Navigate to="/performance" replace />} />
          <Route path="/report" element={<Navigate to="/performance" replace />} />
          <Route path="/about" element={<Navigate to="/performance" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
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
