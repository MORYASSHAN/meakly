import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Mail, RefreshCw, XCircle } from 'lucide-react';
import { resendVerification, verifyEmail } from '../api';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const token = searchParams.get('token');
  const [status, setStatus] = useState(token ? 'verifying' : 'pending');
  const [error, setError] = useState('');
  const email = location.state?.email || '';

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    verifyEmail(token)
      .then(() => {
        if (active) setStatus('success');
      })
      .catch((err) => {
        if (active) {
          setError(err.response?.data?.message || 'Verification failed');
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [location.state?.email, token]);

  const resend = async () => {
    try {
      await resendVerification(email);
      setStatus('resend-sent');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend verification link');
      setStatus('error');
    }
  };

  const content = {
    pending: {
      icon: <Mail size={40} color="var(--blue)" />,
      title: 'Check your inbox',
      body: `We sent a verification link${email ? ` to ${email}` : ''}.`,
      action: <button className="btn btn-ghost" type="button" onClick={resend} disabled={!email}><RefreshCw size={16} /> Resend link</button>,
    },
    verifying: {
      icon: <span className="spinner" style={{ width: 40, height: 40 }} />,
      title: 'Verifying your email...',
      body: 'This usually takes a second.',
      action: null,
    },
    success: {
      icon: <CheckCircle2 size={40} color="var(--mint)" />,
      title: 'Email verified!',
      body: 'Your account is now active.',
      action: <Link className="btn btn-mint" to="/generate">Go generate</Link>,
    },
    error: {
      icon: <XCircle size={40} color="var(--red)" />,
      title: 'Verification failed',
      body: error,
      action: <button className="btn btn-ghost" type="button" onClick={resend} disabled={!email}><RefreshCw size={16} /> Resend link</button>,
    },
    'resend-sent': {
      icon: <CheckCircle2 size={40} color="var(--mint)" />,
      title: 'Link resent!',
      body: 'Check your inbox again.',
      action: <Link className="btn btn-ghost" to="/login">Back to login</Link>,
    },
  }[status];

  return (
    <section className="verify-page">
      <motion.div className="verify-card glass" key={status} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div className="verify-icon">{content.icon}</div>
        <h1>{content.title}</h1>
        <p className="text-muted">{content.body}</p>
        <div className="verify-actions">{content.action}</div>
      </motion.div>
    </section>
  );
}
