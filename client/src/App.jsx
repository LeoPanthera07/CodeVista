import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Premium Fonts
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// Global Context Provider
import { AppProvider } from './context/AppContext';

// Shared Components
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';

// Pages
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import ConnectRepoPage from './pages/ConnectRepoPage';
import RepoAnalysisPage from './pages/RepoAnalysisPage';

// Simple page transition wrapper
function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}
    >
      {children}
    </motion.div>
  );
}

// Router content to support useLocation for transitions
function AppContent() {
  const location = useLocation();

  return (
    <>
      <Navbar />
      <ToastContainer />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageTransition>
                <LandingPage />
              </PageTransition>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PageTransition>
                <DashboardPage />
              </PageTransition>
            }
          />
          <Route
            path="/connect"
            element={
              <PageTransition>
                <ConnectRepoPage />
              </PageTransition>
            }
          />
          <Route
            path="/repo/:id"
            element={
              <PageTransition>
                <RepoAnalysisPage />
              </PageTransition>
            }
          />
          {/* Catch-all redirect to landing */}
          <Route
            path="*"
            element={
              <PageTransition>
                <LandingPage />
              </PageTransition>
            }
          />
        </Routes>
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  );
}
