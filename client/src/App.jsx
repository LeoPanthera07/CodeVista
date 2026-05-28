import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

// Premium Fonts
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';

// Global Context Provider
import { AppProvider, useApp } from './context/AppContext';

// Shared Components
import Navbar from './components/Navbar';
import ToastContainer from './components/Toast';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
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

// Route Guard for Private / Protected routes
function ProtectedRoute({ children }) {
  const { state } = useApp();
  if (!state.token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

// Route Guard for Public-Only routes (like login/signup)
function PublicOnlyRoute({ children }) {
  const { state } = useApp();
  if (state.token) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Router content to support useLocation for transitions
function AppContent() {
  const location = useLocation();
  const { state } = useApp();

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
            path="/login"
            element={
              <PageTransition>
                <PublicOnlyRoute>
                  <LoginPage />
                </PublicOnlyRoute>
              </PageTransition>
            }
          />
          <Route
            path="/signup"
            element={
              <PageTransition>
                <PublicOnlyRoute>
                  <SignupPage />
                </PublicOnlyRoute>
              </PageTransition>
            }
          />
          <Route
            path="/dashboard"
            element={
              <PageTransition>
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              </PageTransition>
            }
          />
          <Route
            path="/connect"
            element={
              <PageTransition>
                <ProtectedRoute>
                  <ConnectRepoPage />
                </ProtectedRoute>
              </PageTransition>
            }
          />
          <Route
            path="/repo/:id"
            element={
              <PageTransition>
                <ProtectedRoute>
                  <RepoAnalysisPage />
                </ProtectedRoute>
              </PageTransition>
            }
          />
          {/* Catch-all redirect based on login status */}
          <Route
            path="*"
            element={
              <Navigate to={state.token ? "/dashboard" : "/"} replace />
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
