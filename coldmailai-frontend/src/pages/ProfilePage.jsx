import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertTriangle, Edit2, ExternalLink, Mail, Save, Star } from 'lucide-react';
import { getBillingPortal, getBillingStatus, getBugReports, getCurrentUsage, getProfile, getUsageInfo, submitBugReport, updateProfile } from '../api';
import useStore from '../store/useStore';

const defaultBugForm = () => ({
  subject: '',
  description: '',
  stepsToReproduce: '',
  expectedResult: '',
  actualResult: '',
  severity: 'low',
  pageUrl: window.location.href,
  browser: navigator.userAgent.split(' ').slice(-2).join(' '),
});

const FALLBACK_DATE = '1970-01-01T00:00:00.000Z';

const severityClass = (severity) => {
  if (severity === 'critical' || severity === 'high') return 'tag-red';
  if (severity === 'medium') return 'tag-yellow';
  return 'tag-blue';
};

export default function ProfilePage() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const usage = useStore((state) => state.usage);
  const setUsage = useStore((state) => state.setUsage);
  const [activeTab, setActiveTab] = useState('Profile');
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', companyName: '', jobTitle: '', website: '' });
  const [bugForm, setBugForm] = useState(defaultBugForm);
  const [bugReports, setBugReports] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submittingBug, setSubmittingBug] = useState(false);
  const [billingStatus, setBillingStatus] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getProfile();
        const profile = data.user || data.profile || data;
        if (active) {
          setUser(profile);
          setProfileForm({
            name: profile.name || '',
            email: profile.email || '',
            companyName: profile.companyName || '',
            jobTitle: profile.jobTitle || '',
            website: profile.website || '',
          });
        }
      } catch {
        if (active) toast.error('Could not load profile');
      }
      try {
        const data = await getBillingStatus();
        if (active) setBillingStatus(data);
      } catch {}
      try {
        const data = await getCurrentUsage();
        if (active) setUsage(data.usage || data);
      } catch {
        try {
          const data = await getUsageInfo();
          if (active) setUsage(data.usage || data);
        } catch {
          if (active) setUsage({ used: 0, limit: 50, plan: 'free' });
        }
      }
      try {
        const data = await getBugReports();
        if (active) setBugReports(data.reports || data.bugReports || data.items || data.data || []);
      } catch {
        if (active) setBugReports([]);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [setUsage, setUser]);

  const initials = useMemo(() => {
    const name = profileForm.name || user?.name || 'User';
    return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [profileForm.name, user]);

  const used = Number(usage?.used || 0);
  const limit = Number(usage?.limit || 25);
  const percent = Math.min(used / Math.max(limit, 1), 1);
  const dashOffset = 314 - 314 * percent;

  const updateProfileField = (field, value) => setProfileForm((current) => ({ ...current, [field]: value }));
  const updateBugField = (field, value) => setBugForm((current) => ({ ...current, [field]: value }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await updateProfile({
        name: profileForm.name,
        companyName: profileForm.companyName,
        jobTitle: profileForm.jobTitle,
        website: profileForm.website,
      });
      const profile = data.user || data.profile || { ...user, ...profileForm };
      setUser(profile);
      setEditMode(false);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  const openBilling = async () => {
    try {
      const data = await getBillingPortal();
      const url = data.url || data.portalUrl;
      if (url) window.location.href = url;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Billing portal unavailable');
    }
  };

  const sendBugReport = async (event) => {
    event.preventDefault();
    setSubmittingBug(true);
    try {
      const data = await submitBugReport(bugForm);
      const report = data.report || data.bugReport || { ...bugForm, id: Date.now(), created_at: new Date().toISOString() };
      setBugReports((current) => [report, ...current]);
      setBugForm(defaultBugForm());
      toast.success('Bug report submitted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not submit report');
    } finally {
      setSubmittingBug(false);
    }
  };

  return (
    <section className="profile-page">
      <aside className="profile-sidebar glass">
        <div className="profile-avatar">{initials}</div>
        <h1 className="profile-name">{profileForm.name || 'Your profile'}</h1>
        <p className="profile-email">{profileForm.email || user?.email}</p>
        <div style={{ marginTop: 12 }}>
          {billingStatus?.billing?.status === 'pending_paid' ? (
            <span className="tag tag-yellow" style={{ backgroundColor: '#eab308', color: '#000', borderColor: '#eab308' }}>Paid (Pending)</span>
          ) : (
            <span className={`tag ${(user?.plan || usage?.plan) === 'pro' ? 'tag-blue' : 'tag-mint'}`}>{user?.plan || usage?.plan || 'Free'}</span>
          )}
        </div>
        <div className="divider" />
        <div className="subject-label">
          {(user?.plan || usage?.plan) === 'free' || !(user?.plan || usage?.plan) ? 'Emails today' : 'Emails this month'}
        </div>
        <div className="usage-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" stroke="var(--bg-3)" strokeWidth="6" fill="none" />
            <circle cx="60" cy="60" r="50" stroke="var(--mint)" strokeWidth="6" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={dashOffset} fill="none" />
          </svg>
          <div className="usage-ring-center">{used}/{limit}</div>
        </div>
        <p className="text-faint" style={{ textAlign: 'center', fontSize: 13 }}>
          {(user?.plan || usage?.plan) === 'free' || !(user?.plan || usage?.plan) ? 'Resets daily' : 'Resets monthly'}
        </p>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 18 }} type="button" onClick={openBilling}>
          <ExternalLink size={16} /> Manage Billing
        </button>
      </aside>

      <main>
        <div className="tabs">
          {['Profile', 'Bug Reports'].map((tab) => (
            <button className={`tab-button ${activeTab === tab ? 'active' : ''}`} type="button" onClick={() => setActiveTab(tab)} key={tab}>
              {tab}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          {activeTab === 'Profile' ? (
            <motion.div className="tab-panel glass" key="profile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="tab-panel-head">
                <div>
                  <h2 className="panel-title">Profile</h2>
                  <p className="text-muted">Keep your sender identity sharp.</p>
                </div>
                <button className="btn btn-ghost btn-small" type="button" onClick={() => setEditMode((value) => !value)}>
                  <Edit2 size={16} /> {editMode ? 'Cancel' : 'Edit'}
                </button>
              </div>
              <form onSubmit={saveProfile}>
                <div className="field-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-name">Full Name</label>
                    <input id="profile-name" value={profileForm.name} disabled={!editMode} onChange={(event) => updateProfileField('name', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-email">Email</label>
                    <input id="profile-email" value={profileForm.email} disabled />
                  </div>
                </div>
                <div className="field-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-company">Company</label>
                    <input id="profile-company" value={profileForm.companyName} disabled={!editMode} onChange={(event) => updateProfileField('companyName', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="profile-title">Job Title</label>
                    <input id="profile-title" value={profileForm.jobTitle} disabled={!editMode} onChange={(event) => updateProfileField('jobTitle', event.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="profile-website">Website</label>
                  <input id="profile-website" value={profileForm.website} disabled={!editMode} onChange={(event) => updateProfileField('website', event.target.value)} />
                </div>
                {editMode && (
                  <button className="btn btn-mint" type="submit" disabled={saving}>
                    {saving ? <span className="spinner" /> : <Save size={16} />} Save
                  </button>
                )}
              </form>
              <div className="danger-zone">
                <h3><AlertTriangle size={17} /> Delete Account</h3>
                <p className="text-muted" style={{ margin: '8px 0 14px' }}>This will permanently delete your account.</p>
                <button className="btn btn-danger" type="button" disabled title="Contact support@meakly.com to delete your account">Delete Account</button>
              </div>
            </motion.div>
          ) : (
            <motion.div className="tab-panel glass" key="bugs" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="tab-panel-head">
                <div>
                  <h2 className="panel-title">Report a Bug</h2>
                  <p className="text-muted">Send the exact context to the team.</p>
                </div>
                <Star size={20} color="var(--yellow)" />
              </div>
              <form className="bug-form" onSubmit={sendBugReport}>
                <div className="field-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-subject">Subject</label>
                    <input id="bug-subject" value={bugForm.subject} onChange={(event) => updateBugField('subject', event.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-severity">Severity</label>
                    <select id="bug-severity" value={bugForm.severity} onChange={(event) => updateBugField('severity', event.target.value)}>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                      <option value="critical">critical</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bug-description">Description</label>
                  <textarea id="bug-description" rows="3" value={bugForm.description} onChange={(event) => updateBugField('description', event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="bug-steps">Steps To Reproduce</label>
                  <textarea id="bug-steps" rows="3" value={bugForm.stepsToReproduce} onChange={(event) => updateBugField('stepsToReproduce', event.target.value)} />
                </div>
                <div className="field-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-expected">Expected Result</label>
                    <input id="bug-expected" value={bugForm.expectedResult} onChange={(event) => updateBugField('expectedResult', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-actual">Actual Result</label>
                    <input id="bug-actual" value={bugForm.actualResult} onChange={(event) => updateBugField('actualResult', event.target.value)} />
                  </div>
                </div>
                <div className="field-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-url">Page URL</label>
                    <input id="bug-url" value={bugForm.pageUrl} onChange={(event) => updateBugField('pageUrl', event.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="bug-browser">Browser</label>
                    <input id="bug-browser" value={bugForm.browser} onChange={(event) => updateBugField('browser', event.target.value)} />
                  </div>
                </div>
                <button className="btn btn-mint" type="submit" disabled={submittingBug}>
                  {submittingBug ? <span className="spinner" /> : <Mail size={16} />} Submit Report
                </button>
              </form>
              <h3 className="panel-title" style={{ fontSize: 18, marginBottom: 14 }}>Your Reports</h3>
              <div className="reports-list">
                {bugReports.length === 0 && <p className="text-muted">No bug reports yet.</p>}
                {bugReports.map((report) => (
                  <article className="report-card glass" key={report.id || report.subject}>
                    <div className="report-row">
                      <strong>{report.subject}</strong>
                      <span className={`tag ${severityClass(report.severity)}`}>{report.severity || 'low'}</span>
                    </div>
                    <p className="report-desc">{report.description}</p>
                    <p className="text-faint" style={{ fontSize: 12, marginTop: 8 }}>{new Date(report.created_at || report.createdAt || FALLBACK_DATE).toLocaleDateString()}</p>
                  </article>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </section>
  );
}
