import { z } from 'zod';
import Razorpay from 'razorpay';
import crypto from 'crypto';
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
  plan: z.enum(['pro']),
});

const plans = {
  free: {
    name: 'Free Plan',
    priceCents: 0,
    emailsPerMonth: 50,
    unlimited: false,
    tagline: '50 emails limit.',
    features: [
      '50 AI email generations limit',
      'Saved campaign history',
      'Usage metering',
    ],
  },
  pro: {
    name: 'Paid Plan',
    priceCents: 4900,
    emailsPerMonth: null,
    unlimited: true,
    tagline: 'Takes 3 business days to activate.',
    features: [
      'Unlimited AI email generations',
      'Requests sent directly to admin',
      'Priority manual activation (3 business days)',
      '24/7 dedicated support',
    ],
  },
};

function isMockRazorpay() {
  return readBoolEnv('MOCK_RAZORPAY', !Boolean(readEnv('RAZORPAY_KEY_ID', '')));
}

function getRazorpayClient() {
  const keyId = readEnv('RAZORPAY_KEY_ID', '');
  const keySecret = readEnv('RAZORPAY_KEY_SECRET', '');
  if (!keyId || !keySecret || isMockRazorpay()) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

function planIdForPlan(plan) {
  const normalized = normalizePlan(plan);
  if (normalized === 'pro') {
    return readEnv('RAZORPAY_PRO_PLAN_ID', 'plan_mock_pro');
  }
  if (normalized === 'power') {
    return readEnv('RAZORPAY_POWER_PLAN_ID', 'plan_mock_power');
  }
  return '';
}

function planFromPlanId(planId) {
  if (planId && planId === readEnv('RAZORPAY_POWER_PLAN_ID', 'plan_mock_power')) {
    return 'power';
  }
  if (planId && planId === readEnv('RAZORPAY_PRO_PLAN_ID', 'plan_mock_pro')) {
    return 'pro';
  }
  return 'free';
}

async function syncPlanAcrossServices({ req, userId, plan, email, razorpayCustomerId, razorpaySubscriptionId }) {
  const payload = {
    userId,
    email,
    plan,
    stripeCustomerId: razorpayCustomerId || null, // Keeping legacy parameter names for internal services compatibility
    stripeSubscriptionId: razorpaySubscriptionId || null,
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
  razorpayCustomerId,
  razorpaySubscriptionId,
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
        razorpayCustomerId: razorpayCustomerId || null,
        razorpaySubscriptionId: razorpaySubscriptionId || null,
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
    const eventId = event.id || `evt_${Date.now()}`;
    await BillingWebhookEvent.create({
      razorpayEventId: eventId,
      eventType: event.event || 'unknown',
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

async function handleSubscriptionChange(req, source, subscription) {
  const razorpayCustomerId = subscription.customer_id || null;
  const razorpaySubscriptionId = subscription.id || null;
  const metadata = subscription.notes || {};
  const userId = metadata.userId || null;
  const plan = normalizePlan(metadata.plan || planFromPlanId(subscription.plan_id));

  if (!userId) {
    throw createError(400, `Unable to resolve userId from ${source}`);
  }

  const periodStart = subscription.current_start
    ? new Date(subscription.current_start * 1000)
    : null;
  const periodEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : null;

  const email = metadata.email || 'unknown@local';

  await upsertBillingSubscription({
    userId,
    email,
    plan,
    razorpayCustomerId,
    razorpaySubscriptionId,
    priceId: subscription.plan_id || null,
    status: subscription.status || 'active',
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
  });

  await syncPlanAcrossServices({
    req,
    userId,
    plan,
    email,
    razorpayCustomerId,
    razorpaySubscriptionId,
  });
}

async function handleWebhookEvent(req, res, next) {
  try {
    const secret = readEnv('RAZORPAY_WEBHOOK_SECRET', '');
    const razorpay = getRazorpayClient();
    let event = req.body || {};

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});

    if (razorpay && secret && !isMockRazorpay()) {
      const signature = req.headers['x-razorpay-signature'];
      if (!signature) {
        throw createError(400, 'Missing Razorpay signature');
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== signature) {
        throw createError(400, 'Invalid Razorpay signature');
      }
    } else {
      if (!event.id) {
        event.id = `mock_${Date.now()}`;
      }
    }

    const shouldProcess = await saveWebhookEvent(event);
    if (!shouldProcess) {
      return sendSuccess(res, { received: true, duplicate: true });
    }

    const subscription = event.payload?.subscription?.entity;

    if (subscription) {
      if (['subscription.activated', 'subscription.charged'].includes(event.event)) {
        await handleSubscriptionChange(req, event.event, subscription);
      }

      if (['subscription.cancelled', 'subscription.halted'].includes(event.event)) {
        const userId = subscription.notes?.userId;
        if (userId) {
          await upsertBillingSubscription({
            userId,
            email: subscription.notes?.email || 'unknown@local',
            plan: 'free',
            razorpayCustomerId: subscription.customer_id || null,
            razorpaySubscriptionId: null,
            priceId: null,
            status: 'canceled',
            currentPeriodStart: null,
            currentPeriodEnd: null,
          });

          await syncPlanAcrossServices({
            req,
            userId,
            plan: 'free',
            razorpayCustomerId: subscription.customer_id || null,
            razorpaySubscriptionId: null,
          });
        }
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
          stripeCustomerId: billing.razorpayCustomerId, // compatibility
          stripeSubscriptionId: billing.razorpaySubscriptionId, // compatibility
          priceId: billing.priceId,
        }
      : {
          plan: profile?.plan || 'free',
          status: 'inactive',
          stripeCustomerId: profile?.stripeCustomerId || null, // compatibility
          stripeSubscriptionId: profile?.stripeSubscriptionId || null, // compatibility
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
      
      const notificationServiceUrl = readEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:5007');
      
      // Update subscription record to pending_paid state
      await upsertBillingSubscription({
        userId: req.auth.sub,
        email: req.auth.email,
        plan: 'free', // stays free usage limit until manual activation
        status: 'pending_paid',
      });
      
      // Trigger notification email to admin itsmoryasshan@gmail.com
      try {
        await callService({
          baseUrl: notificationServiceUrl,
          path: '/internal/notifications/email',
          method: 'POST',
          body: {
            to: 'itsmoryasshan@gmail.com',
            subject: `New Paid Plan Subscription Request - ${req.auth.email}`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h2>Paid Plan Request</h2>
                <p>A user has requested to upgrade to the Paid Plan ($49/month).</p>
                <ul>
                  <li><strong>User ID:</strong> ${req.auth.sub}</li>
                  <li><strong>Name:</strong> ${req.auth.name || 'N/A'}</li>
                  <li><strong>Email:</strong> ${req.auth.email}</li>
                  <li><strong>Requested At:</strong> ${new Date().toISOString()}</li>
                </ul>
                <p>Please review the request and activate their plan within 3 business days.</p>
              </div>
            `,
            text: `Paid Plan Request:\nUser ID: ${req.auth.sub}\nEmail: ${req.auth.email}\nRequested At: ${new Date().toISOString()}`,
            template: 'admin-notification',
          },
          callerService: 'billing-service',
          targetService: 'notification-service',
          requestId: req.requestId,
        });
      } catch (emailErr) {
        logger.error('Failed to send admin notification email', { error: emailErr.message });
      }

      // Trigger confirmation email to user letting them know payment was received and will be activated within 3 business days
      try {
        await callService({
          baseUrl: notificationServiceUrl,
          path: '/internal/notifications/email',
          method: 'POST',
          body: {
            to: req.auth.email,
            subject: 'We received your payment - ColdMail AI Pro',
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; margin-bottom: 20px;">Payment Received!</h2>
                <p>Hello ${req.auth.name || 'there'},</p>
                <p>Thank you for upgrading to <strong>ColdMail AI Pro</strong>! We have successfully received your subscription request / payment of <strong>$49/month</strong>.</p>
                <p>Since we verify and provision accounts manually to ensure maximum deliverability and dedicated priority support, your pro access will be activated within <strong>3 business days</strong>.</p>
                <p>We will send you another email with your login details and instructions as soon as your account is ready.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 0.875rem; color: #666;">
                  <p>Need help? Simply reply to this email or contact support at <a href="mailto:itsmoryasshan@gmail.com">itsmoryasshan@gmail.com</a>.</p>
                  <p>Best regards,<br/>The ColdMail AI Team</p>
                </div>
              </div>
            `,
            text: `Hello ${req.auth.name || 'there'},\n\nThank you for upgrading to ColdMail AI Pro! We have successfully received your payment of $49/month.\n\nYour access will be manually activated within 3 business days. We will send you an email as soon as it's ready.\n\nBest regards,\nColdMail AI Team`,
            template: 'payment-received',
          },
          callerService: 'billing-service',
          targetService: 'notification-service',
          requestId: req.requestId,
        });
      } catch (userEmailErr) {
        logger.error('Failed to send user payment confirmation email', { error: userEmailErr.message });
      }

      return sendSuccess(res, {
        message: 'Your request for the Paid Plan ($49/month) has been submitted! It will take up to 3 business days to process and activate your access. The administrator has been notified.',
        status: 'pending_paid',
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/portal', requireAuth, async (req, res, next) => {
    try {
      const current = await BillingSubscription.findOne({ userId: req.auth.sub });
      const subscriptionId = current?.razorpaySubscriptionId;

      if (!subscriptionId) {
        throw createError(404, 'No billing subscription has been created yet');
      }

      return sendSuccess(res, {
        message: 'Subscriptions can be cancelled or managed via dashboard or support.',
        subscriptionId,
        mock: true,
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
