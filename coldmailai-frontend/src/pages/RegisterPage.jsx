import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Braces, Eye, EyeOff } from 'lucide-react';
import { register } from '../api';

const getStrength = (password) => {
  let score = 0;
  if (password.length > 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const strength = getStrength(password);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register(name, email, password);
      navigate('/verify-email', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
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
        <h1>Create account</h1>
        <p className="auth-sub">Get started with Meakly</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="register-name">Full Name</label>
            <input id="register-name" type="text" value={name} onChange={(event) => setName(event.target.value)} required autoComplete="name" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="register-email">Email</label>
            <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group input-wrap">
            <label className="form-label" htmlFor="register-password">Password</label>
            <input
              className="password-input"
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="new-password"
            />
            <button className="icon-button password-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPassword((value) => !value)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <div className="strength-bars" aria-label={`Password strength ${strength} out of 4`}>
              {[0, 1, 2, 3].map((index) => (
                <span className={`strength-bar ${index < strength ? 'active' : ''}`} key={index} />
              ))}
            </div>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </motion.div>
    </section>
  );
}
