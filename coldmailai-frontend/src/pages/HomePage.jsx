import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, BrainCircuit, Clock3, History, LockKeyhole, Sparkles, Zap } from 'lucide-react';

const metrics = [
  { value: '50', label: 'Free emails/day', detail: 'Start generating cold campaigns instantly, no card required.' },
  { value: '∞', label: 'Paid plan', detail: 'Unlimited AI email generations for serious outbound teams.' },
  { value: '2s', label: 'Avg generation time', detail: 'Groq-powered LLM returns structured campaigns in seconds.' },
];

const capabilities = [
  {
    icon: BrainCircuit,
    title: 'AI-powered cold emails',
    text: 'Enter a company, role, offer and pain point. Meakly returns a complete cold email with subject, body, and two follow-ups.',
  },
  {
    icon: LockKeyhole,
    title: 'Account-grade foundation',
    text: 'Full auth, email verification, refresh tokens, usage quotas, billing, and profile — all live and service-backed.',
  },
  {
    icon: History,
    title: 'Campaign history',
    text: 'Every email you generate is saved. Filter by tone, goal, or recipient. Favorite the ones worth keeping.',
  },
];

const steps = [
  ['01', 'Target the account', 'Enter the company name, their role, your offer, and the pain point you solve.'],
  ['02', 'Generate in seconds', 'The AI returns a subject line, full email body, and two follow-up messages.'],
  ['03', 'Save & reuse', 'Every campaign lands in your history. Favorite, copy, or delete at any time.'],
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
  const stageLift = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const stageFade = useTransform(scrollYProgress, [0, 0.85], [1, 0.5]);

  return (
    <>
      {/* ── Hero ── */}
      <section
        className="home-hero meakly-hero"
        ref={heroRef}
        style={{ '--mx': `${pointer.x}%`, '--my': `${pointer.y}%` }}
        onPointerMove={(e) =>
          setPointer({
            x: Math.round((e.clientX / window.innerWidth) * 100),
            y: Math.round((e.clientY / window.innerHeight) * 100),
          })
        }
      >
        <div className="hero-noise" aria-hidden="true" />

        <motion.div style={{ y: stageLift, opacity: stageFade }} className="hero-orbit-bg" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
        </motion.div>

        <motion.div
          className="hero-copy hero-copy-centered"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <span className="hero-kicker">
            <Sparkles size={14} /> AI cold outreach, structured &amp; fast
          </span>
          <h1 className="meakly-title">meakly</h1>
          <p className="meakly-lede">
            Turn a company name, target role, and pain point into a complete cold email campaign — subject, body, and follow-ups — in seconds.
          </p>
          <div className="hero-actions hero-actions-centered">
            <Link className="btn btn-mint" to="/register">
              Start free <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-ghost" to="/pricing">
              View plans
            </Link>
          </div>
        </motion.div>

        {/* Live preview card */}
        <motion.div
          className="hero-preview-card glass"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6 }}
        >
          <div className="terminal-top">
            <span /><span /><span />
            <strong>campaign_output.json</strong>
          </div>
          <div className="preview-field">
            <span className="preview-label">company</span>
            <span className="preview-value">"Acme Corp"</span>
          </div>
          <div className="preview-field">
            <span className="preview-label">targetRole</span>
            <span className="preview-value">"Head of Sales"</span>
          </div>
          <div className="preview-field">
            <span className="preview-label">painPoint</span>
            <span className="preview-value">"low reply rates"</span>
          </div>
          <div className="terminal-output">
            <div><Zap size={15} /><span>subject</span></div>
            <p>A faster path to booked calls for Acme Corp</p>
          </div>
          <div className="preview-body-snippet">
            Hi [Name], I noticed Acme Corp is dealing with low reply rates…
          </div>
        </motion.div>
      </section>

      {/* ── Metrics ── */}
      <section className="meakly-metrics">
        {metrics.map((metric, index) => (
          <AnimatedMetric metric={metric} index={index} key={metric.label} />
        ))}
      </section>

      {/* ── Capabilities ── */}
      <section className="engine-section">
        <div className="section-eyebrow">
          <BrainCircuit size={15} /> what meakly does
        </div>
        <div className="engine-head">
          <h2 className="section-title">A full outreach engine, not just a text box.</h2>
          <p className="section-sub">
            Meakly is a complete cold email platform: AI generation, usage tracking, campaign history, billing, and profile — all wired together.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <motion.article className="capability-card" whileHover={{ y: -5 }} key={cap.title}>
                <Icon size={22} />
                <h3>{cap.title}</h3>
                <p>{cap.text}</p>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="workflow-section">
        <div className="workflow-visual" aria-hidden="true">
          <Sparkles size={34} />
          {['target', 'generate', 'save', 'reuse', 'scale'].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
        <div>
          <div className="section-eyebrow">
            <Clock3 size={15} /> how it works
          </div>
          <h2 className="section-title">Three steps to a sent campaign.</h2>
          <div className="timeline-list">
            {steps.map(([number, title, text]) => (
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
            <Link className="btn btn-mint" to="/register">
              Get started <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-ghost" to="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
