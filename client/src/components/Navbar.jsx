import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, LayoutDashboard, Menu, X, Settings, LogOut, Key, Check, Eye, EyeOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import GlassCard from './GlassCard';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);

  const { state, dispatch, addToast } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const isLoggedIn = !!state.token;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    dispatch({ type: 'SET_MOBILE_MENU', payload: false });
  }, [location, dispatch]);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    addToast({
      type: 'info',
      title: 'Logged Out',
      message: 'You have been successfully signed out.',
    });
    navigate('/login');
  };

  const handleSaveKey = async (e) => {
    e.preventDefault();
    setSavingKey(true);

    try {
      // Save user key to DB
      await api.updateApiKey(groqKey);
      
      dispatch({ type: 'UPDATE_USER_KEY', payload: groqKey });
      
      addToast({
        type: 'success',
        title: 'API Key Saved',
        message: groqKey ? 'Groq API Key updated successfully.' : 'Groq API Key removed successfully.',
      });
      setSettingsOpen(false);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to update key',
        message: err.message || 'Server error occurred.',
      });
    } finally {
      setSavingKey(false);
    }
  };

  const userInitial = state.user?.email ? state.user.email[0].toUpperCase() : 'U';

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`} style={{ zIndex: 100 }}>
        <Link to={isLoggedIn ? "/dashboard" : "/"} className="nav-logo">
          <div className="nav-logo-icon">
            <Code2 />
          </div>
          <span className="nav-logo-text">CodeVista</span>
        </Link>

        {isLoggedIn && (
          <div className="nav-links">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              <LayoutDashboard style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'text-bottom' }} />
              Dashboard
            </NavLink>
            <NavLink
              to="/connect"
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              Connect
            </NavLink>
          </div>
        )}

        <div className="nav-actions">
          {isLoggedIn ? (
            <>
              {/* User profile initial badge */}
              <div 
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--gradient-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'var(--weight-bold)',
                  fontSize: 'var(--text-sm)',
                  color: 'white',
                  cursor: 'default',
                }}
                title={`Logged in as ${state.user?.email}`}
              >
                {userInitial}
              </div>

              {/* Settings button */}
              <button
                onClick={() => {
                  setGroqKey(state.groqApiKey || '');
                  setSettingsOpen(true);
                }}
                className="btn btn-ghost btn-icon"
                title="Configure custom Groq API Key"
                aria-label="Settings"
              >
                <Settings size={18} />
              </button>

              {/* Logout button */}
              <button
                onClick={handleLogout}
                className="btn btn-ghost btn-icon text-danger-light"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm" style={{ padding: '8px 16px' }}>
                Sign In
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}

          <button
            className="nav-mobile-toggle"
            onClick={() => dispatch({ type: 'SET_MOBILE_MENU', payload: !state.mobileMenuOpen })}
            aria-label="Toggle menu"
          >
            {state.mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile nav links */}
      <AnimatePresence>
        {state.mobileMenuOpen && (
          <motion.div
            className="nav-links-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ zIndex: 90 }}
          >
            {isLoggedIn ? (
              <>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', marginBottom: '12px' }}>
                  <div className="text-dim text-xs">Logged in as</div>
                  <div className="text-secondary font-semibold" style={{ wordBreak: 'break-all' }}>{state.user?.email}</div>
                </div>
                <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
                <NavLink to="/connect" className="nav-link">Connect Repository</NavLink>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_MOBILE_MENU', payload: false });
                    setGroqKey(state.groqApiKey || '');
                    setSettingsOpen(true);
                  }}
                  className="nav-link w-full text-left"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Configure Groq API Key
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_MOBILE_MENU', payload: false });
                    handleLogout();
                  }}
                  className="nav-link w-full text-left text-danger-light"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Sign In</Link>
                <Link to="/signup" className="nav-link" style={{ color: 'var(--primary-light)' }}>Create Account</Link>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal (BYOK Key Configuration) */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(5, 8, 22, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard
              variant="bordered"
              style={{
                width: '90%',
                maxWidth: '480px',
                padding: 'var(--sp-6)',
                position: 'relative',
              }}
              animate={true}
            >
              {/* Close button */}
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '16px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
                aria-label="Close settings"
              >
                <X size={20} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--sp-4)' }}>
                <Key className="text-primary-light" size={24} />
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)' }}>Settings</h2>
              </div>

              <p className="text-muted" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5, marginBottom: 'var(--sp-5)' }}>
                Configure your custom **Groq API Key**. When supplied, CodeVista will use this key directly to power codebase summaries, chat answers, and document generation. Leaving it blank falls back to the server's default key.
              </p>

              <form onSubmit={handleSaveKey} className="flex flex-col gap-4">
                <div>
                  <label className="input-label" htmlFor="settings-groq-key">
                    Groq API Key
                  </label>
                  <div className="input-with-icon">
                    <Key className="input-icon" />
                    <input
                      id="settings-groq-key"
                      type={showKey ? 'text' : 'password'}
                      className="input-field"
                      placeholder="gsk_••••••••••••••••••••"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      disabled={savingKey}
                      style={{ paddingRight: '2.5rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 0,
                      }}
                      title={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-end" style={{ marginTop: 'var(--sp-2)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setSettingsOpen(false)}
                    disabled={savingKey}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={savingKey}
                  >
                    {savingKey ? (
                      <div className="spinner" style={{ width: '16px', height: '16px' }} />
                    ) : (
                      <>
                        <Check size={16} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
