import { Link, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, LayoutDashboard, BookOpen, Menu, X } from 'lucide-react';

const Github = (props) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);
import { useApp } from '../context/AppContext';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { state, dispatch } = useApp();
  const location = useLocation();
  const isLanding = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    dispatch({ type: 'SET_MOBILE_MENU', payload: false });
  }, [location, dispatch]);

  return (
    <>
      <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <Code2 />
          </div>
          <span className="nav-logo-text">CodeVista</span>
        </Link>

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

        <div className="nav-actions">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-icon"
            aria-label="GitHub"
          >
            <Github size={20} />
          </a>
          {!isLanding && (
            <Link to="/connect" className="btn btn-primary btn-sm">
              <Code2 size={16} />
              Connect Repo
            </Link>
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

      <AnimatePresence>
        {state.mobileMenuOpen && (
          <motion.div
            className="nav-links-mobile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
            <NavLink to="/connect" className="nav-link">Connect Repository</NavLink>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="nav-link">
              GitHub
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
