import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Braces, MessageSquare, AlertCircle, Check } from 'lucide-react';

const Github = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

const Linkedin = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
    <rect x="2" y="9" width="4" height="12"></rect>
    <circle cx="4" cy="4" r="2"></circle>
  </svg>
);
import toast from 'react-hot-toast';
import useStore from '../../store/useStore';
import { submitBugReport } from '../../api';

export default function Footer() {
  const navigate = useNavigate();
  const accessToken = useStore((state) => state.accessToken);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: 'suggestion',
    subject: '',
    description: '',
  });

  const handleOpenReport = () => {
    if (!accessToken) {
      toast.error('Please log in to submit suggestions or report errors');
      navigate('/login');
      return;
    }
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.subject || !form.description) {
      toast.error('Please fill in all fields');
      return;
    }
    setSubmitting(true);
    try {
      await submitBugReport({
        subject: `[${form.type.toUpperCase()}] ${form.subject}`,
        description: form.description,
        severity: form.type === 'bug' ? 'high' : 'low',
        stepsToReproduce: 'N/A',
        expectedResult: 'N/A',
        actualResult: 'N/A',
        pageUrl: window.location.href,
        browser: navigator.userAgent.split(' ').slice(-2).join(' '),
      });
      toast.success('Thank you! Your feedback has been submitted.');
      setForm({ type: 'suggestion', subject: '', description: '' });
      setShowModal(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="footer-section glass" style={{ marginTop: 80, borderLeft: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: 0 }}>
      <div className="page-wrapper" style={{ padding: '60px 24px 30px' }}>
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 40, marginBottom: 50 }}>
          <div className="footer-col brand-col">
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text)', marginBottom: 20 }}>
              <Braces size={20} color="var(--blue)" />
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20 }}>meakly</span>
            </Link>
            <p className="text-muted" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Meakly brings core email workflows into one unified digital platform, making outreach structured, efficient, and transparent.
            </p>
          </div>

          <div className="footer-col">
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, color: 'var(--blue)' }}>Product</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <li><Link to="/" className="text-muted" style={{ transition: 'color 0.2s' }}>Who We Are</Link></li>
              <li><Link to="/pricing" className="text-muted">Pricing</Link></li>
              <li><Link to="/generate" className="text-muted">Generate Email</Link></li>
              <li><Link to="/history" className="text-muted">Campaign History</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, color: 'var(--blue)' }}>Resources</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
              <li><a href="#" className="text-muted" onClick={(e) => { e.preventDefault(); toast.success('Support center available 24/7'); }}>Support</a></li>
              <li><a href="#" className="text-muted" onClick={(e) => { e.preventDefault(); toast.success('Privacy Policy updated June 2026'); }}>Privacy Policy</a></li>
              <li><a href="#" className="text-muted" onClick={(e) => { e.preventDefault(); toast.success('Terms of Service active'); }}>Terms of Service</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, color: 'var(--blue)' }}>Feedback</h4>
            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              Have suggestions or noticed an error? Let us know directly.
            </p>
            <button className="btn btn-ghost btn-small" style={{ gap: 6 }} onClick={handleOpenReport}>
              <MessageSquare size={14} /> Submit Suggestion
            </button>
          </div>
        </div>

        <div className="divider" style={{ margin: '30px 0 20px' }} />

        <div className="footer-bottom" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <p className="text-faint" style={{ fontSize: 13 }}>
            Designed & Developed by <strong style={{ color: 'var(--text)' }}>Shaan Goswami</strong>
          </p>
          <div className="social-links" style={{ display: 'flex', gap: 16 }}>
            <a href="https://github.com/MORYASSHAN" target="_blank" rel="noopener noreferrer" className="icon-button" style={{ width: 32, height: 32 }} title="GitHub Profile">
              <Github size={16} />
            </a>
            <a href="https://www.linkedin.com/in/shaan-goswami-778729274/" target="_blank" rel="noopener noreferrer" className="icon-button" style={{ width: 32, height: 32 }} title="LinkedIn Profile">
              <Linkedin size={16} />
            </a>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-layer" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: 440, padding: 28, background: 'var(--bg-1)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={20} color="var(--blue)" /> Feedback & Reports
            </h3>
            <p className="text-muted" style={{ fontSize: 14, marginBottom: 20 }}>Help us improve Meakly. Submit a bug or suggest a feature.</p>
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className={`btn btn-full ${form.type === 'suggestion' ? 'btn-mint' : 'btn-ghost'}`} onClick={() => setForm(prev => ({ ...prev, type: 'suggestion' }))} style={{ flex: 1, minHeight: 38 }}>
                    Suggestion
                  </button>
                  <button type="button" className={`btn btn-full ${form.type === 'bug' ? 'btn-mint' : 'btn-ghost'}`} onClick={() => setForm(prev => ({ ...prev, type: 'bug' }))} style={{ flex: 1, minHeight: 38 }}>
                    Bug / Error
                  </button>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="report-subject">Subject</label>
                <input id="report-subject" value={form.subject} onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="e.g. Generation speed, typos, suggestions" required />
              </div>
              <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label" htmlFor="report-desc">Description</label>
                <textarea id="report-desc" rows="4" value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Please detail your feedback or steps to reproduce..." required />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={submitting}>Cancel</button>
                <button type="submit" className="btn btn-mint" disabled={submitting}>
                  {submitting ? <span className="spinner" /> : <Check size={16} />} Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </footer>
  );
}
