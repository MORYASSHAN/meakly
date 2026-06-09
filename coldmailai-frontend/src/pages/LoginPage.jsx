import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Braces, Eye, EyeOff } from 'lucide-react';
import { login } from '../api';
import useStore from '../store/useStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setToken = useStore((state) => state.setToken);
  const setUser = useStore((state) => state.setUser);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await login(email, password);
      setToken(data.accessToken);
      setUser(data.user || data.account || null);
      navigate('/generate');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="blue-orb" />
      <motion.div className="auth-card glass" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Link className="logo auth-logo" to="/">
          <span className="logo-mark wordmark-mark" aria-hidden="true"><Braces size={17} /></span>
          <span className="logo-text" style={{ opacity: 1 }}>
            meakly
          </span>
        </Link>
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group input-wrap">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              className="password-input"
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
            <button className="icon-button password-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Sign up</Link>
        </p>
      </motion.div>
    </section>
  );
}
