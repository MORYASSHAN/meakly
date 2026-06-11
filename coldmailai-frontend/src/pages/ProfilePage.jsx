import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertTriangle, Edit2, ExternalLink, Save } from 'lucide-react';
import { getBillingPortal, getBillingStatus, getCurrentUsage, getProfile, getUsageInfo, updateProfile } from '../api';
import useStore from '../store/useStore';

export default function ProfilePage() {
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const usage = useStore((state) => state.usage);
  const setUsage = useStore((state) => state.setUsage);
  const [editMode, setEditMode] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', companyName: '', jobTitle: '', website: '' });
  const [saving, setSaving] = useState(false);
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
      } catch { }
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
  const limit = Number(usage?.limit || 50);
  const percent = Math.min(used / Math.max(limit, 1), 1);
  const dashOffset = 314 - 314 * percent;

  const updateProfileField = (field, value) => setProfileForm((current) => ({ ...current, [field]: value }));

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
      if (url) {
        window.location.href = url;
      } else {
        toast.success(data.message || 'Contact support to manage your subscription.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Billing portal unavailable');
    }
  };

  const planLabel = user?.plan || usage?.plan || 'Free';
  const isPending = billingStatus?.billing?.status === 'pending_paid';

  return (
    <section className="profile-page">
      <aside className="profile-sidebar glass">
        <div className="profile-avatar">{initials}</div>
        <h1 className="profile-name">{profileForm.name || 'Your profile'}</h1>
        <p className="profile-email">{profileForm.email || user?.email}</p>
        <div style={{ marginTop: 12 }}>
          {isPending ? (
            <span className="tag tag-yellow" style={{ backgroundColor: '#eab308', color: '#000', borderColor: '#eab308' }}>
              Paid (Pending Activation)
            </span>
          ) : (
            <span className={`tag ${planLabel.toLowerCase() === 'pro' || planLabel.toLowerCase() === 'power' ? 'tag-blue' : 'tag-mint'}`}>
              {planLabel}
            </span>
          )}
        </div>
        <div className="divider" />
        <div className="subject-label">
          {planLabel.toLowerCase() === 'free' ? 'Emails today' : 'Emails this month'}
        </div>
        <div className="usage-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" stroke="var(--bg-3)" strokeWidth="6" fill="none" />
            <circle cx="60" cy="60" r="50" stroke="var(--mint)" strokeWidth="6" strokeLinecap="round" strokeDasharray="314" strokeDashoffset={dashOffset} fill="none" />
          </svg>
          <div className="usage-ring-center">{used}/{limit}</div>
        </div>
        <p className="text-faint" style={{ textAlign: 'center', fontSize: 13 }}>
          {planLabel.toLowerCase() === 'free' ? 'Resets daily' : 'Resets monthly'}
        </p>
        <button className="btn btn-ghost btn-full" style={{ marginTop: 18 }} type="button" onClick={openBilling}>
          <ExternalLink size={16} /> Manage Billing
        </button>
      </aside>

      <main>
        <motion.div className="tab-panel glass" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
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
            <button className="btn btn-danger" type="button" disabled title="Contact support to delete your account">
              Delete Account
            </button>
          </div>
        </motion.div>
      </main>
    </section>
  );
}
