import { z } from 'zod';
import Stripe from 'stripe';
import {
  callService,
  createError,
  getPlanLimit,
  getPlanSummary,
  isUnlimitedPlan,
  logger,
  normalizePlan,
  readBoolEnv,
  readEnv,
  requireAuth,
  requireInternalServiceAuth,
  sendSuccess,
  validateBody,
} from '@coldmailai/shared';
import { BillingSubscription, BillingWebhookEvent } from './models.js';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'power']),
});

const plans = {
  free: {
    name: 'free',
    priceCents: 0,
    emailsPerMonth: 5,
    unlimited: false,
  },
  pro: {
    name: 'pro',
    priceCents: 1499,
    emailsPerMonth: 100,
    unlimited: false,
  },
  power: {
    name: 'power',
    priceCents: 2999,
    emailsPerMonth: null,
    unlimited: true,
  },
};

function isMockStripe() {
  return readBoolEnv('MOCK_STRIPE', !Boolean(readEnv('STRIPE_SECRET_KEY', '')));
}

function getStripeClient() {
  const secretKey = readEnv('STRIPE_SECRET_KEY', '');
  if (!secretKey || isMockStripe()) {
    return null;
  }

  return new Stripe(secretKey);
}

function priceIdForPlan(plan) {
  const normalized = normalizePlan(plan);
  if (normalized === 'pro') {
    return readEnv('STRIPE_PRO_PRICE_ID', '');
  }
  if (normalized === 'power') {
    return readEnv('STRIPE_POWER_PRICE_ID', '');
  }
  return '';
}

function planFromPriceId(priceId) {
  if (priceId && priceId === readEnv('STRIPE_POWER_PRICE_ID', '')) {
    return 'power';
  }
  if (priceId && priceId === readEnv('STRIPE_PRO_PRICE_ID', '')) {
    return 'pro';
  }
  return 'free';
}

async function syncPlanAcrossServices({ req, userId, plan, email, stripeCustomerId, stripeSubscriptionId }) {
  const payload = {
    userId,
    email,
    plan,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
  };

  const authServiceUrl = readEnv('AUTH_SERVICE_URL', 'http://localhost:5001');
  const userServiceUrl = readEnv('USER_SERVICE_URL', 'http://localhost:5002');
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');

  await Promise.all([
    callService({
      baseUrl: authServiceUrl,
      path: '/internal/account/plan',
      method: 'PATCH',
      body: payload,
      callerService: 'billing-service',
      targetService: 'auth-service',
      requestId: req.requestId,
    }),
    callService({
      baseUrl: userServiceUrl,
      path: '/internal/profiles/plan',
      method: 'PATCH',
      body: payload,
      callerService: 'billing-service',
      targetService: 'user-service',
      requestId: req.requestId,
    }),
    callService({
      baseUrl: usageServiceUrl,
      path: '/internal/usage/plan',
      method: 'PATCH',
      body: payload,
      callerService: 'billing-service',
      targetService: 'usage-service',
      requestId: req.requestId,
    }),
  ]);
}

async function upsertBillingSubscription({
  userId,
  email,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  priceId,
  status,
  currentPeriodStart,
  currentPeriodEnd,
}) {
  return BillingSubscription.findOneAndUpdate(
    { userId },
    {
      $set: {
        userId,
        email,
        plan: normalizePlan(plan),
        status: status || 'active',
        stripeCustomerId: stripeCustomerId || null,
        stripeSubscriptionId: stripeSubscriptionId || null,
        priceId: priceId || null,
        currentPeriodStart: currentPeriodStart || null,
        currentPeriodEnd: currentPeriodEnd || null,
      },
    },
    {
      new: true,
      upsert: true,
    },
  );
}

async function saveWebhookEvent(event) {
  try {
    await BillingWebhookEvent.create({
      stripeEventId: event.id,
      eventType: event.type,
      processedAt: new Date(),
      status: 'processed',
      payload: event,
    });
    return true;
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      return false;
    }
    throw error;
  }
}

async function handleSubscriptionChange(req, source, eventOrSession) {
  const stripeCustomerId = eventOrSession.customer || eventOrSession.customer_id || null;
  const stripeSubscriptionId = eventOrSession.subscription || eventOrSession.id || null;
  const metadata = eventOrSession.metadata || {};
  const userId = metadata.userId || eventOrSession.client_reference_id || eventOrSession.client_reference_id || null;
  const plan = normalizePlan(metadata.plan || planFromPriceId(eventOrSession?.items?.data?.[0]?.price?.id || eventOrSession?.display_items?.[0]?.price?.id));

  if (!userId) {
    throw createError(400, `Unable to resolve userId from ${source}`);
  }

  const periodStart = eventOrSession.current_period_start
    ? new Date(eventOrSession.current_period_start * 1000)
    : null;
  const periodEnd = eventOrSession.current_period_end
    ? new Date(eventOrSession.current_period_end * 1000)
    : null;

  const email = metadata.email || eventOrSession.customer_email || eventOrSession.customer_details?.email || eventOrSession.billing_email || 'unknown@local';

  await upsertBillingSubscription({
    userId,
    email,
    plan,
    stripeCustomerId,
    stripeSubscriptionId,
    priceId: eventOrSession.items?.data?.[0]?.price?.id || metadata.priceId || null,
    status: eventOrSession.status || 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  await syncPlanAcrossServices({
    req,
    userId,
    plan,
    email,
    stripeCustomerId,
    stripeSubscriptionId,
  });
}

async function handleWebhookEvent(req, res, next) {
  try {
    const secret = readEnv('STRIPE_WEBHOOK_SECRET', '');
    const stripe = getStripeClient();
    let event;

    if (stripe && secret && !isMockStripe()) {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        throw createError(400, 'Missing Stripe signature');
      }
      event = stripe.webhooks.constructEvent(req.rawBody, signature, secret);
    } else {
      const bodyText = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
      event = JSON.parse(bodyText || '{}');
      if (!event.id) {
        event.id = `mock_${Date.now()}`;
      }
    }

    const shouldProcess = await saveWebhookEvent(event);
    if (!shouldProcess) {
      return sendSuccess(res, { received: true, duplicate: true });
    }

    if (event.type === 'checkout.session.completed') {
      await handleSubscriptionChange(req, 'checkout.session.completed', event.data.object);
    }

    if (event.type === 'customer.subscription.updated') {
      await handleSubscriptionChange(req, 'customer.subscription.updated', event.data.object);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const userId = subscription.metadata?.userId || subscription.client_reference_id;
      if (userId) {
        await upsertBillingSubscription({
          userId,
          email: subscription.metadata?.email || subscription.customer_email || 'unknown@local',
          plan: 'free',
          stripeCustomerId: subscription.customer || null,
          stripeSubscriptionId: null,
          priceId: null,
          status: 'canceled',
          currentPeriodStart: null,
          currentPeriodEnd: null,
        });

        await syncPlanAcrossServices({
          req,
          userId,
          plan: 'free',
          stripeCustomerId: subscription.customer || null,
          stripeSubscriptionId: null,
        });
      }
    }

    return sendSuccess(res, { received: true });
  } catch (error) {
    return next(error);
  }
}

async function getCurrentBilling(req) {
  const userId = req.auth.sub;
  const profileServiceUrl = readEnv('USER_SERVICE_URL', 'http://localhost:5002');
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');

  const [profileResult, usageResult] = await Promise.allSettled([
    callService({
      baseUrl: profileServiceUrl,
      path: `/internal/profiles/by-user-id/${userId}`,
      method: 'GET',
      callerService: 'billing-service',
      targetService: 'user-service',
      requestId: req.requestId,
    }),
    callService({
      baseUrl: usageServiceUrl,
      path: '/current',
      method: 'GET',
      headers: {
        authorization: req.headers.authorization || '',
      },
      callerService: 'billing-service',
      targetService: 'usage-service',
      requestId: req.requestId,
      serviceToken: '',
    }),
  ]);

  const billing = await BillingSubscription.findOne({ userId });
  const profile = profileResult.status === 'fulfilled' ? profileResult.value.data?.data?.profile || null : null;
  const usage = usageResult.status === 'fulfilled' ? usageResult.value.data?.data?.usage || null : null;

  return {
    billing: billing
      ? {
          plan: billing.plan,
          status: billing.status,
          stripeCustomerId: billing.stripeCustomerId,
          stripeSubscriptionId: billing.stripeSubscriptionId,
          priceId: billing.priceId,
        }
      : {
          plan: profile?.plan || 'free',
          status: 'inactive',
          stripeCustomerId: profile?.stripeCustomerId || null,
          stripeSubscriptionId: profile?.stripeSubscriptionId || null,
          priceId: null,
        },
    profile,
    usage,
  };
}

function isPowerOrPro(plan) {
  const normalized = normalizePlan(plan);
  return normalized === 'pro' || normalized === 'power';
}

export function registerBillingRoutes(app) {
  app.get('/plans', (req, res) => {
    return sendSuccess(res, {
      plans,
      current: getPlanSummary('free'),
    });
  });

  app.post('/checkout', requireAuth, validateBody(checkoutSchema), async (req, res, next) => {
    try {
      const { plan } = req.validatedBody;
      if (!isPowerOrPro(plan)) {
        throw createError(400, 'Only pro and power plans can be purchased');
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return sendSuccess(res, {
          url: `https://mock.stripe.local/checkout?plan=${plan}&userId=${encodeURIComponent(req.auth.sub)}`,
          mock: true,
        });
      }

      const priceId = priceIdForPlan(plan);
      if (!priceId) {
        throw createError(500, `Missing Stripe price ID for ${plan}`);
      }

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: readEnv('STRIPE_SUCCESS_URL', 'http://localhost:5000/api/v1/billing/status?success=true'),
        cancel_url: readEnv('STRIPE_CANCEL_URL', 'http://localhost:5000/api/v1/billing/status?canceled=true'),
        customer_email: req.auth.email,
        metadata: {
          userId: req.auth.sub,
          plan,
          email: req.auth.email,
        },
        subscription_data: {
          metadata: {
            userId: req.auth.sub,
            plan,
            email: req.auth.email,
          },
        },
      });

      return sendSuccess(res, {
        url: checkoutSession.url,
        id: checkoutSession.id,
        mock: false,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/portal', requireAuth, async (req, res, next) => {
    try {
      const current = await BillingSubscription.findOne({ userId: req.auth.sub });
      const customerId = current?.stripeCustomerId;

      if (!customerId) {
        throw createError(404, 'No billing customer has been created yet');
      }

      const stripe = getStripeClient();
      if (!stripe) {
        return sendSuccess(res, {
          url: `https://mock.stripe.local/portal?customerId=${encodeURIComponent(customerId)}`,
          mock: true,
        });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: readEnv('STRIPE_SUCCESS_URL', 'http://localhost:5000/api/v1/billing/status'),
      });

      return sendSuccess(res, {
        url: portalSession.url,
        mock: false,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/status', requireAuth, async (req, res, next) => {
    try {
      const current = await getCurrentBilling(req);
      const usage = current.usage;
      const planName = current.billing.plan;
      return sendSuccess(res, {
        plan: planName,
        unlimited: isUnlimitedPlan(planName),
        emailsPerMonth: isUnlimitedPlan(planName) ? null : getPlanLimit(planName),
        billing: current.billing,
        profile: current.profile,
        usage,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/webhook', async (req, res, next) => {
    return handleWebhookEvent(req, res, next);
  });
}
