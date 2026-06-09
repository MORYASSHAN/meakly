import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Check, ChevronDown, Copy, RefreshCw, Sparkles, Zap } from 'lucide-react';
import { generateEmail, getCurrentUsage } from '../api';
import useStore from '../store/useStore';

const tones = ['Professional', 'Friendly', 'Direct', 'Bold', 'Conversational'];
const goals = ['Book a demo', 'Partnership', 'Sales pitch', 'Job inquiry', 'Networking', 'Investor pitch'];
const thoughts = ['personalizing...', 'analyzing...', 'crafting subject...', 'optimizing tone...', 'checking spam...', 'finalizing...'];

const emptyForm = {
  recipientName: '',
  recipientEmail: '',
  recipientCompany: '',
  recipientRole: '',
  myName: '',
  myOffer: '',
  painPoint: '',
  targetRole: '',
  tone: 'Professional',
  goal: 'Book a demo',
  companyName: '',
  additionalContext: '',
};

const normalizeGenerated = (data) => {
  const email = data.email || data.generatedEmail || data.result || data;
  const output = email.output || data.output || {};
  const input = email.input || data.input || {};
  return {
    id: email.id || data.id || Date.now(),
    subject: email.subject || output.subject || data.subject || 'Your AI-generated cold email',
    body: email.body || email.emailBody || output.emailBody || email.content || data.body || data.emailBody || data.content || data.emailText || '',
    followUp1: email.followUp1 || output.followUp1 || data.followUp1 || '',
    followUp2: email.followUp2 || output.followUp2 || data.followUp2 || '',
    recipientName: email.recipientName || data.recipientName || '',
    recipientCompany: email.recipientCompany || data.recipientCompany || input.companyName || '',
    tone: email.tone || data.tone || input.tone || '',
    goal: email.goal || data.goal || '',
    created_at: email.created_at || email.createdAt || email.created_at || new Date().toISOString(),
    isFavorite: Boolean(email.isFavorite || email.isFavorited),
  };
};

export default function GeneratePage() {
  const [form, setForm] = useState(emptyForm);
  const [copied, setCopied] = useState(false);
  const isGenerating = useStore((state) => state.isGenerating);
  const generatedEmail = useStore((state) => state.generatedEmail);
  const usage = useStore((state) => state.usage);
  const setIsGenerating = useStore((state) => state.setIsGenerating);
  const setGeneratedEmail = useStore((state) => state.setGeneratedEmail);
  const setUsage = useStore((state) => state.setUsage);
  const addEmail = useStore((state) => state.addEmail);

  useEffect(() => {
    let active = true;
    getCurrentUsage()
      .then((data) => {
        if (active) setUsage(data.usage || data);
      })
      .catch(() => {
        if (active) setUsage({ used: 0, limit: 50, plan: 'free' });
      });
    return () => {
      active = false;
    };
  }, [setUsage]);

  const usagePercent = useMemo(() => {
    const used = Number(usage?.used || 0);
    const limit = Number(usage?.limit || 1);
    return Math.min((used / limit) * 100, 100);
  }, [usage]);

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'recipientRole' && !current.targetRole) next.targetRole = value;
      if (field === 'recipientCompany' && !current.companyName) next.companyName = value;
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsGenerating(true);
    try {
      const data = await generateEmail(form);
      const normalized = normalizeGenerated(data);
      setGeneratedEmail(normalized);
      addEmail(normalized);
      toast.success('Email generated');
      const nextUsage = data.usage || data.currentUsage;
      if (nextUsage) setUsage(nextUsage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not generate email');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyEmail = async () => {
    if (!generatedEmail) return;
    await navigator.clipboard.writeText(`Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
    setCopied(true);
    toast.success('Copied to clipboard');
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="generate-page">
      <motion.aside className="panel" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}>
        <div className="panel-header">
          <h1 className="panel-title">Meakly Generator</h1>
          <span className="tag tag-mint">
            <Zap size={13} /> Live
          </span>
        </div>

        <div className="usage-widget">
          <div className="usage-line">
            <span>{usage?.plan?.toLowerCase() === 'free' ? 'Free (daily)' : (usage?.plan || 'Free')} usage</span>
            <span>{usage?.used ?? 0}/{usage?.limit ?? 50}</span>
          </div>
          <div className="usage-track">
            <div className="usage-fill" style={{ width: `${usagePercent}%` }} />
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field-row">
            <div className="form-group">
              <label className="form-label" htmlFor="recipient-name">Recipient Name</label>
              <input id="recipient-name" value={form.recipientName} onChange={(event) => updateField('recipientName', event.target.value)} placeholder="Sarah Chen" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="recipient-email">Recipient Email</label>
              <input id="recipient-email" type="email" value={form.recipientEmail} onChange={(event) => updateField('recipientEmail', event.target.value)} placeholder="sarah@company.com" />
            </div>
          </div>
          <div className="field-row">
            <div className="form-group">
              <label className="form-label" htmlFor="recipient-company">Company</label>
              <input id="recipient-company" value={form.recipientCompany} onChange={(event) => updateField('recipientCompany', event.target.value)} placeholder="Acme Corp" required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="recipient-role">Their Role</label>
              <input id="recipient-role" value={form.recipientRole} onChange={(event) => updateField('recipientRole', event.target.value)} placeholder="Head of Growth" />
            </div>
          </div>
          <div className="field-row">
            <div className="form-group">
              <label className="form-label" htmlFor="my-name">Your Name</label>
              <input id="my-name" value={form.myName} onChange={(event) => updateField('myName', event.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="my-offer">Your Offer / Value Prop</label>
              <input id="my-offer" value={form.myOffer} onChange={(event) => updateField('myOffer', event.target.value)} placeholder="AI-powered outreach tool" required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pain-point">Their Pain Point</label>
            <input id="pain-point" value={form.painPoint} onChange={(event) => updateField('painPoint', event.target.value)} placeholder="low reply rates" required />
          </div>
          <div className="field-row">
            <div className="form-group">
              <label className="form-label" htmlFor="target-role">Target Role</label>
              <input id="target-role" value={form.targetRole} onChange={(event) => updateField('targetRole', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="company-name">Company Name</label>
              <input id="company-name" value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
            </div>
          </div>
          <div className="field-row">
            <div className="form-group input-wrap">
              <label className="form-label" htmlFor="tone">Tone</label>
              <select id="tone" value={form.tone} onChange={(event) => updateField('tone', event.target.value)}>
                {tones.map((tone) => <option key={tone}>{tone}</option>)}
              </select>
              <ChevronDown className="input-icon" size={16} style={{ left: 'auto', right: 12 }} />
            </div>
            <div className="form-group input-wrap">
              <label className="form-label" htmlFor="goal">Goal</label>
              <select id="goal" value={form.goal} onChange={(event) => updateField('goal', event.target.value)}>
                {goals.map((goal) => <option key={goal}>{goal}</option>)}
              </select>
              <ChevronDown className="input-icon" size={16} style={{ left: 'auto', right: 12 }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="additional-context">Additional Context</label>
            <textarea id="additional-context" rows="3" value={form.additionalContext} onChange={(event) => updateField('additionalContext', event.target.value)} placeholder="Recent funding, hiring plans, tech stack, or trigger event" />
          </div>
          <div className="form-actions">
            {isGenerating && (
              <div className="thoughts" aria-hidden="true">
                {thoughts.map((thought, index) => (
                  <span className="thought-pill" style={{ marginLeft: `${(index - 3) * 12}px`, animationDelay: `${index * 0.22}s` }} key={thought}>
                    {thought}
                  </span>
                ))}
              </div>
            )}
            <button className="btn btn-mint btn-full" type="submit" disabled={isGenerating}>
              {isGenerating ? <RefreshCw size={18} className="spin-icon" /> : <Sparkles size={18} />}
              {isGenerating ? 'Generating...' : 'Generate Email'}
            </button>
          </div>
        </form>
      </motion.aside>

      <motion.section className="panel output-panel" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }}>
        <div className="panel-header">
          <h2 className="panel-title">Campaign Output</h2>
          {generatedEmail && (
            <div className="email-toolbar">
              <button className="btn btn-ghost btn-small" type="button" onClick={copyEmail}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="btn btn-ghost btn-small" type="button" onClick={handleSubmit} disabled={isGenerating}>
                <RefreshCw size={16} />
                Regenerate
              </button>
            </div>
          )}
        </div>
        <AnimatePresence mode="wait">
          {generatedEmail ? (
            <motion.div className="email-shell" key={generatedEmail.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -18 }}>
              <div className="subject-box">
                <div className="subject-label">Subject</div>
                <div className="subject-text">{generatedEmail.subject}</div>
              </div>
              <pre className="email-body">{generatedEmail.body}</pre>
            </motion.div>
          ) : (
            <motion.div className="output-empty" key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Sparkles size={38} />
              <h2 className="panel-title">Ready when you are</h2>
              <p>Fill in the account signal and Meakly will generate the campaign here.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </section>
  );
}
