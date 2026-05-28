import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import GlassCard from '../components/GlassCard';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { dispatch, addToast } = useApp();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.signup(email.trim(), password.trim());
      
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: {
          token: res.token,
          user: res.user,
        },
      });

      addToast({
        type: 'success',
        title: 'Account created!',
        message: `Welcome to CodeVista! Successfully registered as ${res.user.email}.`,
      });

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to register account. Email might be already in use.');
      addToast({
        type: 'error',
        title: 'Registration failed',
        message: err.message || 'Check your details and try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper flex items-center justify-center" style={{ minHeight: 'calc(100vh - var(--nav-height))', position: 'relative', overflow: 'hidden' }}>
      {/* Decorative dynamic glows */}
      <div 
        style={{
          position: 'absolute',
          top: '20%',
          left: '70%',
          width: '400px',
          height: '400px',
          background: 'var(--gradient-glow)',
          transform: 'translate(-50%, -50%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      <div 
        style={{
          position: 'absolute',
          bottom: '10%',
          left: '15%',
          width: '500px',
          height: '500px',
          background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 60%)',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <div className="container" style={{ maxWidth: '440px', zIndex: 1, padding: 'var(--sp-4)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <span className="hero-text-glow" style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-extrabold)', letterSpacing: '-0.03em' }}>
              CodeVista
            </span>
          </Link>
          <p className="text-muted" style={{ marginTop: 'var(--sp-2)', fontSize: 'var(--text-sm)' }}>
            Create your account to start mapping and exploring codebases
          </p>
        </div>

        <GlassCard variant="bordered" style={{ padding: 'var(--sp-6)' }}>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: 'var(--sp-3)',
                background: 'var(--danger-bg)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--danger-light)',
                fontSize: 'var(--text-xs)',
                marginBottom: 'var(--sp-4)',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="input-label" htmlFor="signup-email">
                Email Address
              </label>
              <div className="input-with-icon">
                <Mail className="input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  className="input-field"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="signup-password">
                Password
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" />
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
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
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="input-label" htmlFor="signup-confirm-password">
                Confirm Password
              </label>
              <div className="input-with-icon">
                <Lock className="input-icon" />
                <input
                  id="signup-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading || !email || !password || !confirmPassword}
              style={{ marginTop: 'var(--sp-2)', position: 'relative' }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                  <div className="spinner" style={{ width: '16px', height: '16px' }} />
                  <span>Registering...</span>
                </div>
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: 'var(--sp-6)', textAlign: 'center', fontSize: 'var(--text-xs)' }}>
            <span className="text-muted">Already have an account? </span>
            <Link to="/login" className="link-hover" style={{ color: 'var(--primary-light)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
