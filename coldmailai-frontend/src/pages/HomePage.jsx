import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import useStore from '../store/useStore';
import toast from 'react-hot-toast';
import { submitBugReport } from '../api';
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Clock3,
  DatabaseZap,
  Fingerprint,
  Gauge,
  LockKeyhole,
  Radar,
  Sparkles,
  TerminalSquare,
  Workflow,
} from 'lucide-react';

const metrics = [
  { value: '5', label: 'free monthly generations', detail: 'quota reserved before AI work starts' },
  { value: '100', label: 'pro monthly generations', detail: 'usage synced across billing and profile services' },
  { value: '∞', label: 'power plan ceiling', detail: 'for teams running daily prospecting loops' },
];

const serviceNodes = [
  ['auth', 'JWT sessions, verification, refresh rotation'],
  ['users', 'profile, preferences, feedback reports'],
  ['usage', 'reserve, commit, release quota control'],
  ['emails', 'saved outputs, favorites, history'],
  ['ai', 'Groq-compatible JSON campaign generation'],
  ['billing', 'Stripe checkout, portal, plan sync'],
];

const capabilities = [
  {
    icon: BrainCircuit,
    title: 'Campaign intelligence',
    text: 'Meakly turns company context, role, offer, and pain point into concise cold email campaigns with follow-ups.',
  },
  {
    icon: Gauge,
    title: 'Quota-aware speed',
    text: 'The workflow reserves usage before generation, commits only after success, and releases capacity when AI fails.',
  },
  {
    icon: LockKeyhole,
    title: 'Account-grade foundation',
    text: 'Registration, verification, refresh tokens, plans, history, profiles, and bug reports are already service-backed.',
  },
];

const timeline = [
  ['01', 'Identify the account', 'Name the company, target role, offer, and pain point.'],
  ['02', 'Generate the angle', 'The AI service returns a subject, body, and follow-up sequence as structured JSON.'],
  ['03', 'Save the signal', 'Every result lands in history with usage, plan, and profile context intact.'],
];

function AnimatedMetric({ metric, index }) {
  return (
    <motion.article
      className="metric-tile"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ delay: index * 0.08 }}
    >
      <strong>{metric.value}</strong>
      <span>{metric.label}</span>
      <p>{metric.detail}</p>
    </motion.article>
  );
}

export default function HomePage() {
  const heroRef = useRef(null);
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const stageLift = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const stageFade = useTransform(scrollYProgress, [0, 0.85], [1, 0.45]);

  const accessToken = useStore((state) => state.accessToken);
  const [submittingHome, setSubmittingHome] = useState(false);
  const [homeForm, setHomeForm] = useState({
    type: 'suggestion',
    subject: '',
    description: '',
  });

  const handleHomeSubmit = async (event) => {
    event.preventDefault();
    if (!homeForm.subject || !homeForm.description) {
      toast.error('Please fill in all fields');
      return;
    }
    if (homeForm.description.length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }
    setSubmittingHome(true);
    try {
      await submitBugReport({
        subject: `[${homeForm.type.toUpperCase()}] ${homeForm.subject}`,
        description: homeForm.description,
        severity: homeForm.type === 'bug' ? 'high' : 'low',
        stepsToReproduce: 'N/A',
        expectedResult: 'N/A',
        actualResult: 'N/A',
        pageUrl: window.location.href,
        browser: navigator.userAgent.split(' ').slice(-2).join(' '),
      });
      toast.success('Thank you! Your feedback has been submitted.');
      setHomeForm({ type: 'suggestion', subject: '', description: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setSubmittingHome(false);
    }
  };

  useEffect(() => {
    const onMove = (event) => {
      setPointer({
        x: Math.round((event.clientX / window.innerWidth) * 100),
        y: Math.round((event.clientY / window.innerHeight) * 100),
      });
    };

    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <>
      <section
        className="home-hero meakly-hero"
        ref={heroRef}
        style={{ '--mx': `${pointer.x}%`, '--my': `${pointer.y}%` }}
      >
        <div className="hero-noise" aria-hidden="true" />
        <motion.div className="hero-orbit" style={{ y: stageLift, opacity: stageFade }} aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core">
            <span>meakly</span>
            <small>outreach engine</small>
          </div>
          {serviceNodes.map(([name], index) => (
            <span className={`service-dot service-dot-${index + 1}`} key={name}>
              {name}
            </span>
          ))}
        </motion.div>

        <div className="meakly-hero-grid">
          <motion.div
            className="hero-copy"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="hero-kicker">
              <Radar size={15} /> AI cold outreach command layer
            </span>
            <h1 className="meakly-title">meakly</h1>
            <p className="meakly-lede">
              A dark, fast outreach workbench for generating precise cold email campaigns, tracking usage, and turning saved replies into an operating system for growth.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-mint" to="/register">
                Start generating <ArrowRight size={17} />
              </Link>
              <Link className="btn btn-ghost" to="/pricing">
                View plans
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="command-panel"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
          >
            <div className="terminal-top">
              <span />
              <span />
              <span />
              <strong>campaign.json</strong>
            </div>
            <div className="terminal-line">
              <span className="terminal-key">companyName</span>
              <span className="terminal-value">"Northstar Labs"</span>
            </div>
            <div className="terminal-line">
              <span className="terminal-key">targetRole</span>
              <span className="terminal-value">"Head of Revenue"</span>
            </div>
            <div className="terminal-line">
              <span className="terminal-key">painPoint</span>
              <span className="terminal-value">"manual prospect research"</span>
            </div>
            <div className="terminal-output">
              <div>
                <Fingerprint size={18} />
                <span>subject</span>
              </div>
              <p>Quick idea for Northstar Labs</p>
            </div>
            <div className="terminal-stack">
              {serviceNodes.map(([name, detail]) => (
                <div className="stack-row" key={name}>
                  <span>{name}</span>
                  <small>{detail}</small>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="hero-status-strip" aria-label="Meakly system summary">
          <span><BadgeCheck size={15} /> auth ready</span>
          <span><DatabaseZap size={15} /> usage metered</span>
          <span><Sparkles size={15} /> AI-backed</span>
        </div>
      </section>

      <section className="meakly-metrics">
        {metrics.map((metric, index) => (
          <AnimatedMetric metric={metric} index={index} key={metric.label} />
        ))}
      </section>

      <section className="engine-section">
        <div className="section-eyebrow">
          <TerminalSquare size={16} /> built from the services up
        </div>
        <div className="engine-head">
          <h2 className="section-title">Not a pretty shell. A real outreach machine.</h2>
          <p className="section-sub">
            The interface now mirrors the backend: authenticated generation, saved email history, monthly usage, plan upgrades, profile controls, and bug reporting.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => {
            const Icon = capability.icon;
            return (
              <motion.article className="capability-card" whileHover={{ y: -5 }} key={capability.title}>
                <Icon size={22} />
                <h3>{capability.title}</h3>
                <p>{capability.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      <section className="workflow-section">
        <div className="workflow-visual" aria-hidden="true">
          <Workflow size={34} />
          {serviceNodes.slice(0, 5).map(([name]) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div>
          <div className="section-eyebrow">
            <Clock3 size={16} /> cinematic, but operational
          </div>
          <h2 className="section-title">A campaign path you can feel.</h2>
          <div className="timeline-list">
            {timeline.map(([number, title, text]) => (
              <article className="timeline-item" key={number}>
                <strong>{number}</strong>
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="hero-actions workflow-actions">
            <Link className="btn btn-mint" to="/generate">
              Open generator <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-ghost" to="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
