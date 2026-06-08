import { z } from 'zod';
import {
  createError,
  getMonthKey,
  getMonthWindow,
  getPlanLimit,
  normalizePlan,
  readEnv,
  requireAuth,
  requireInternalServiceAuth,
  sendSuccess,
  validateBody,
} from '@coldmailai/shared';
import { UsageBucket, buildUsageBucket } from './models.js';

const bootstrapSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email().max(320),
  plan: z.enum(['free', 'pro', 'power']).default('free'),
});

const planUpdateSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email().max(320).optional(),
  plan: z.enum(['free', 'pro', 'power']).default('free'),
});

async function ensureCurrentBucket({ userId, email, plan, forcePlan = false }) {
  const monthKey = getMonthKey();
  const bucket = await UsageBucket.findOne({ userId, monthKey });
  if (bucket) {
    if (email && bucket.email !== email) {
      bucket.email = email;
    }
    bucket.periodStart = getMonthWindow().start;
    bucket.periodEnd = getMonthWindow().end;
    if (forcePlan) {
      const normalizedPlan = normalizePlan(plan || bucket.plan);
      bucket.plan = normalizedPlan;
      bucket.limit = getPlanLimit(normalizedPlan);
    }
    await bucket.save();
    return bucket;
  }

  const previousBucket = await UsageBucket.findOne({ userId }).sort({ createdAt: -1 });
  const initialPlan = previousBucket ? previousBucket.plan : normalizePlan(plan);
  const initialEmail = previousBucket ? email || previousBucket.email : email;
  const created = await UsageBucket.create(
    buildUsageBucket({
      userId,
      email: initialEmail || 'unknown@local',
      plan: initialPlan,
    }),
  );
  return created;
}

async function getBucketOrCreate(userId, email, plan) {
  const bucket = await ensureCurrentBucket({ userId, email, plan });
  return bucket;
}

function usagePayload(bucket) {
  return bucket?.toPublicObject ? bucket.toPublicObject() : bucket;
}

async function reserveUsage({ userId, email, plan }) {
  const bucket = await getBucketOrCreate(userId, email, plan);
  const updated = await UsageBucket.findOneAndUpdate(
    {
      _id: bucket._id,
      $expr: {
        $lt: [{ $add: ['$used', '$reserved'] }, '$limit'],
      },
    },
    {
      $inc: { reserved: 1 },
      $set: { lastActivityAt: new Date() },
    },
    {
      new: true,
    },
  );

  if (!updated) {
    throw createError(429, 'Monthly email quota exceeded');
  }

  return updated;
}

async function commitUsage({ userId, email, plan }) {
  const bucket = await getBucketOrCreate(userId, email, plan);
  const updated = await UsageBucket.findOneAndUpdate(
    {
      _id: bucket._id,
      reserved: { $gt: 0 },
    },
    {
      $inc: { used: 1, reserved: -1 },
      $set: { lastActivityAt: new Date() },
    },
    {
      new: true,
    },
  );

  if (!updated) {
    throw createError(400, 'No reserved usage slot available to commit');
  }

  return updated;
}

async function releaseUsage({ userId, email, plan }) {
  const bucket = await getBucketOrCreate(userId, email, plan);
  const updated = await UsageBucket.findOneAndUpdate(
    {
      _id: bucket._id,
      reserved: { $gt: 0 },
    },
    {
      $inc: { reserved: -1 },
      $set: { lastActivityAt: new Date() },
    },
    {
      new: true,
    },
  );

  if (!updated) {
    throw createError(400, 'No reserved usage slot available to release');
  }

  return updated;
}

export function registerUsageRoutes(app) {
  app.get('/current', requireAuth, async (req, res, next) => {
    try {
      const bucket = await getBucketOrCreate(req.auth.sub, req.auth.email, req.auth.plan);
      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/check', requireAuth, async (req, res, next) => {
    try {
      const bucket = await getBucketOrCreate(req.auth.sub, req.auth.email, req.auth.plan);
      return sendSuccess(res, {
        usage: usagePayload(bucket),
        canGenerate: bucket.used + bucket.reserved < bucket.limit,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/reserve', requireAuth, async (req, res, next) => {
    try {
      const bucket = await reserveUsage({
        userId: req.auth.sub,
        email: req.auth.email,
        plan: req.auth.plan,
      });
      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/commit', requireAuth, async (req, res, next) => {
    try {
      const bucket = await commitUsage({
        userId: req.auth.sub,
        email: req.auth.email,
        plan: req.auth.plan,
      });
      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/release', requireAuth, async (req, res, next) => {
    try {
      const bucket = await releaseUsage({
        userId: req.auth.sub,
        email: req.auth.email,
        plan: req.auth.plan,
      });
      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/reset', requireAuth, async (req, res, next) => {
    try {
      await UsageBucket.deleteOne({
        userId: req.auth.sub,
        monthKey: getMonthKey(),
      });

      return sendSuccess(res, { reset: true });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/usage/bootstrap', requireInternalServiceAuth, validateBody(bootstrapSchema), async (req, res, next) => {
    try {
      const bucket = await getBucketOrCreate(req.validatedBody.userId, req.validatedBody.email, req.validatedBody.plan);
      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/internal/usage/current/:userId', requireInternalServiceAuth, async (req, res, next) => {
    try {
      const bucket = await getBucketOrCreate(req.params.userId);

      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/internal/usage/plan', requireInternalServiceAuth, validateBody(planUpdateSchema), async (req, res, next) => {
    try {
      const { userId, plan, email } = req.validatedBody;
      let bucket = await UsageBucket.findOne({ userId, monthKey: getMonthKey() });
      if (!bucket) {
        bucket = await UsageBucket.create(
          buildUsageBucket({
            userId,
            email: email || 'unknown@local',
            plan,
          }),
        );
      } else {
        bucket.plan = normalizePlan(plan);
        bucket.limit = getPlanLimit(bucket.plan);
        if (email && bucket.email !== email) {
          bucket.email = email;
        }
        bucket.lastActivityAt = new Date();
        await bucket.save();
      }

      return sendSuccess(res, { usage: usagePayload(bucket) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/internal/usage/:userId', requireInternalServiceAuth, async (req, res, next) => {
    try {
      await UsageBucket.deleteMany({ userId: req.params.userId });
      return sendSuccess(res, { deleted: true });
    } catch (error) {
      return next(error);
    }
  });
}
