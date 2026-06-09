import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronDown, Rocket, Zap } from 'lucide-react';
import { createCheckout, getBillingStatus, getPlans } from '../api';
import useStore from '../store/useStore';

const faqs = [
  ['Can I cancel anytime?', 'Yes. Paid plans can be cancelled from the billing portal and remain active until the end of the billing period.'],
  ['What counts as one email?', 'Each successful AI generation counts as one email, including regenerated versions.'],
  ['Is there a free trial?', 'The free plan gives you a starter monthly allowance so you can test the workflow before upgrading.'],
  ['Do you offer refunds?', 'Refunds are handled case by case. Contact support with your billing email and plan details.'],
  ['Can I use the API?', 'API access is available on team and agency-oriented plans when enabled by your subscription.'],
];

const planIcon = (name = '') => {
  if (name.toLowerCase().includes('team') || name.toLowerCase().includes('agency')) return Building2;
  if (name.toLowerCase().includes('pro')) return Rocket;
  return Zap;
};

const normalizePlans = (data) => {
  const raw = data.plans || data.items || data.data || [];
  if (Array.isArray(raw)) return raw;
  return Object.entries(raw).map(([slug, plan]) => ({
    id: slug,
    slug,
    features: [
      plan.unlimited ? 'Unlimited AI email generations' : `${plan.emailsPerMonth} AI email generations per month`,
      'Saved campaign history',
      'Usage metering and plan sync',
    ],
    description: slug === 'power' ? 'For daily outbound teams.' : slug === 'pro' ? 'For serious prospecting.' : 'For testing Meakly.',
    ...plan,
  }));
};

const getPrice = (plan, period) => {
  const raw =
    plan.prices?.[period] ??
    plan[`${period}Price`] ??
    plan.price ??
    plan.amount ??
    plan.priceCents ??
    0;
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  const adjusted = period === 'annual' && !plan.prices?.annual && !plan.annualPrice ? value * 0.8 : value;
  if (adjusted > 999) return Math.round(adjusted / 100);
  return adjusted === 0 ? 0 : Math.round(adjusted);
};

export default function PricingPage() {
  const navigate = useNavigate();
  const accessToken = useStore((state) => state.accessToken);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [billingStatus, setBillingStatus] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null);
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getPlans();
        if (active) setPlans(normalizePlans(data));
      } catch {
        if (active) setPlans([]);
      } finally {
        if (active) setLoading(false);
      }
      if (accessToken) {
        try {
          const status = await getBillingStatus();
          if (active) setBillingStatus(status);
        } catch {
          if (active) setBillingStatus(null);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [accessToken]);

  const currentPlanId = billingStatus?.planId || billingStatus?.plan?.id || billingStatus?.plan;
  const highlightedId = useMemo(() => {
    const pro = plans.find((plan) => plan.slug === 'pro' || plan.name?.toLowerCase().includes('pro'));
    return pro?.id;
  }, [plans]);

  const checkout = async (plan) => {
    if (!accessToken) {
      navigate('/register');
      return;
    }
    if (plan.free || getPrice(plan, billingPeriod) === 0) return;
    setCheckingOut(plan.id);
    try {
      const data = await createCheckout(plan.slug || plan.id || plan.name);
      const url = data.url || data.checkoutUrl;
      if (url) {
        window.location.href = url;
      } else if (data.message) {
        toast.success(data.message, { duration: 6000 });
        try {
          const status = await getBillingStatus();
          setBillingStatus(status);
        } catch {}
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upgrade request failed');
    } finally {
      setCheckingOut(null);
    }
  };

  return (
    <section className="pricing-page">
      <header className="pricing-header">
        <span className="hero-badge">Simple pricing</span>
        <h1 className="page-title" style={{ marginTop: 18 }}>Pay for what you use.</h1>
        <p className="section-sub centered" style={{ marginTop: 14 }}>Start free. Scale when you&apos;re ready. No contracts.</p>
        <div className="billing-toggle">
          <motion.span className="toggle-indicator" animate={{ left: billingPeriod === 'monthly' ? 4 : 'calc(50% + 2px)' }} />
          <button className={`toggle-pill ${billingPeriod === 'monthly' ? 'active' : ''}`} type="button" onClick={() => setBillingPeriod('monthly')}>Monthly</button>
          <button className={`toggle-pill ${billingPeriod === 'annual' ? 'active' : ''}`} type="button" onClick={() => setBillingPeriod('annual')}>Annual <span className="tag tag-mint">Save 20%</span></button>
        </div>
      </header>

      <div className="plans-grid">
        {loading && [0, 1, 2].map((item) => <div className="skeleton" style={{ width: 320, height: 430, borderRadius: 'var(--radius-lg)' }} key={item} />)}
        {!loading && plans.length === 0 && <div className="center-state">No plans available yet.</div>}
        {!loading && plans.map((plan) => {
          const Icon = planIcon(plan.name);
          const highlighted = plan.highlighted || plan.id === highlightedId;
          const isCurrent = currentPlanId === plan.id || currentPlanId === plan.slug || currentPlanId === plan.name;
          const isPending = plan.id === 'pro' && billingStatus?.billing?.status === 'pending_paid';
          const price = getPrice(plan, billingPeriod);
          const features = plan.features || plan.limits || ['AI cold email generation', 'Saved history', 'Usage analytics'];
          return (
            <motion.article className={`plan-card ${highlighted ? 'highlighted' : ''}`} whileHover={{ y: -4 }} key={plan.id || plan.name}>
              {isCurrent ? (
                <span className="current-badge">Current plan</span>
              ) : isPending ? (
                <span className="popular-badge" style={{ backgroundColor: '#eab308', color: '#000', borderColor: '#eab308' }}>Pending Approval</span>
              ) : highlighted ? (
                <span className="popular-badge">Most Popular</span>
              ) : null}
              <Icon size={24} color={highlighted ? 'var(--mint)' : 'var(--blue)'} />
              <div className="plan-name" style={{ marginTop: 18 }}>{plan.name || 'Plan'}</div>
              <div className="plan-price">
                <span className="price-number">{price === 0 ? 'Free' : `$${price}`}</span>
                {price !== 0 && <span className="text-muted">/{billingPeriod === 'annual' ? 'yr' : 'mo'}</span>}
              </div>
              <p className="text-muted">{plan.description || plan.tagline || 'Focused outreach without noisy extras.'}</p>
              <div className="divider" />
              <ul className="plan-features">
                {features.map((feature) => (
                  <li key={String(feature)}>
                    <Check size={16} />
                    <span>{typeof feature === 'string' ? feature : `${feature.name || feature.key}: ${feature.value || feature.limit || 'Included'}`}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="btn btn-ghost btn-full" disabled type="button">Current plan</button>
              ) : isPending ? (
                <button className="btn btn-ghost btn-full" disabled type="button" style={{ borderColor: '#eab308', color: '#eab308', cursor: 'default' }}>Pending Activation</button>
              ) : (
                <button className={`btn btn-full ${highlighted ? 'btn-mint' : 'btn-ghost'}`} type="button" onClick={() => checkout(plan)} disabled={checkingOut === plan.id}>
                  {checkingOut === plan.id && <span className="spinner" />}
                  {plan.cta || (price === 0 ? 'Get started' : 'Upgrade')}
                </button>
              )}
            </motion.article>
          );
        })}
      </div>

      <div className="faq">
        <h2 className="section-title centered" style={{ marginBottom: 20 }}>Questions</h2>
        {faqs.map(([question, answer], index) => (
          <div className="faq-item" key={question}>
            <button className="faq-question" type="button" onClick={() => setOpenFaq((current) => (current === index ? -1 : index))}>
              <span>{question}</span>
              <ChevronDown size={18} style={{ transform: openFaq === index ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </button>
            <AnimatePresence>
              {openFaq === index && (
                <motion.div className="faq-answer" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <div className="faq-answer-inner">{answer}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
