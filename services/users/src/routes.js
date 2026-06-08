import { z } from 'zod';
import {
  callService,
  createError,
  createServiceApp,
  getPlanLimit,
  normalizePlan,
  readEnv,
  requireAuth,
  requireInternalServiceAuth,
  sendSuccess,
  validateBody,
  validateParams,
} from '@coldmailai/shared';
import { BugReport, Profile, createProfilePlanFields } from './models.js';

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  companyName: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  website: z.string().trim().max(250).optional(),
  timezone: z.string().trim().max(80).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
  preferences: z
    .object({
      tone: z.string().trim().max(40).optional(),
      language: z.string().trim().max(20).optional(),
    })
    .partial()
    .optional(),
});

const bootstrapSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(2).max(80),
  plan: z.enum(['free', 'pro', 'power']).default('free'),
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
});

const planSyncSchema = z.object({
  userId: z.string().min(1),
  email: z.string().trim().email().max(320).optional(),
  plan: z.enum(['free', 'pro', 'power']).default('free'),
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
});

const bugReportSchema = z.object({
  subject: z.string().trim().min(3).max(140),
  description: z.string().trim().min(20).max(4000),
  stepsToReproduce: z.string().trim().max(4000).optional(),
  expectedResult: z.string().trim().max(2000).optional(),
  actualResult: z.string().trim().max(2000).optional(),
  pageUrl: z.string().trim().max(500).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  appVersion: z.string().trim().max(80).optional(),
  browser: z.string().trim().max(120).optional(),
  metadata: z.record(z.any()).optional(),
});

function profileResponse(profile) {
  return profile?.toPublicObject ? profile.toPublicObject() : profile;
}

function bugReportResponse(report) {
  return report?.toPublicObject ? report.toPublicObject() : report;
}

async function loadCurrentProfile(userId) {
  return Profile.findOne({ userId });
}

export function registerUserRoutes(app) {
  app.get('/me', requireAuth, async (req, res, next) => {
    try {
      const profile = await loadCurrentProfile(req.auth.sub);
      if (!profile) {
        throw createError(404, 'Profile not found');
      }

      return sendSuccess(res, { profile: profileResponse(profile) });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/me', requireAuth, validateBody(profileUpdateSchema), async (req, res, next) => {
    try {
      const profile = await loadCurrentProfile(req.auth.sub);
      if (!profile) {
        throw createError(404, 'Profile not found');
      }

      const updates = req.validatedBody;
      if (updates.name !== undefined) profile.name = updates.name;
      if (updates.companyName !== undefined) profile.companyName = updates.companyName;
      if (updates.jobTitle !== undefined) profile.jobTitle = updates.jobTitle;
      if (updates.website !== undefined) profile.website = updates.website;
      if (updates.timezone !== undefined) profile.timezone = updates.timezone;
      if (updates.avatarUrl !== undefined) profile.avatarUrl = updates.avatarUrl;
      if (updates.preferences !== undefined) {
        profile.preferences = {
          ...profile.preferences,
          ...updates.preferences,
        };
      }

      await profile.save();

      return sendSuccess(res, { profile: profileResponse(profile) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/me/subscription', requireAuth, async (req, res, next) => {
    try {
      const profile = await loadCurrentProfile(req.auth.sub);
      if (!profile) {
        throw createError(404, 'Profile not found');
      }

      return sendSuccess(res, {
        plan: profile.plan,
        monthlyLimit: profile.monthlyLimit,
        unlimited: profile.plan === 'power',
        stripeCustomerId: profile.stripeCustomerId,
        stripeSubscriptionId: profile.stripeSubscriptionId,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/me/usage', requireAuth, async (req, res, next) => {
    try {
      const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');
      const result = await callService({
        baseUrl: usageServiceUrl,
        path: `/internal/usage/current/${req.auth.sub}`,
        method: 'GET',
        callerService: 'user-service',
        targetService: 'usage-service',
        requestId: req.requestId,
      });

      return sendSuccess(res, { usage: result.data?.data || null });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/bug-reports', requireAuth, validateBody(bugReportSchema), async (req, res, next) => {
    try {
      const body = req.validatedBody;
      const report = await BugReport.create({
        userId: req.auth.sub,
        email: req.auth.email,
        name: req.auth.name || 'Unknown User',
        subject: body.subject,
        description: body.description,
        stepsToReproduce: body.stepsToReproduce || '',
        expectedResult: body.expectedResult || '',
        actualResult: body.actualResult || '',
        pageUrl: body.pageUrl || '',
        severity: body.severity,
        appVersion: body.appVersion || '',
        browser: body.browser || '',
        metadata: body.metadata || null,
      });

      return sendSuccess(res, { bugReport: bugReportResponse(report) }, { statusCode: 201 });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/me/bug-reports', requireAuth, async (req, res, next) => {
    try {
      const reports = await BugReport.find({ userId: req.auth.sub }).sort({ createdAt: -1 }).limit(100);
      return sendSuccess(res, {
        bugReports: reports.map(bugReportResponse),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/profiles/bootstrap', requireInternalServiceAuth, validateBody(bootstrapSchema), async (req, res, next) => {
    try {
      const body = req.validatedBody;
      const planFields = createProfilePlanFields(body.plan);

      const profile = await Profile.findOneAndUpdate(
        { userId: body.userId },
        {
          $set: {
            userId: body.userId,
            email: body.email,
            name: body.name,
            ...planFields,
            stripeCustomerId: body.stripeCustomerId ?? null,
            stripeSubscriptionId: body.stripeSubscriptionId ?? null,
          },
          $setOnInsert: {
            companyName: '',
            jobTitle: '',
            website: '',
            timezone: 'UTC',
            avatarUrl: '',
            preferences: {
              tone: 'direct',
              language: 'en',
            },
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      return sendSuccess(res, { profile: profileResponse(profile) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/internal/profiles/by-user-id/:userId', requireInternalServiceAuth, async (req, res, next) => {
    try {
      const profile = await Profile.findOne({ userId: req.params.userId });
      if (!profile) {
        throw createError(404, 'Profile not found');
      }

      return sendSuccess(res, { profile: profileResponse(profile) });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/internal/profiles/plan', requireInternalServiceAuth, async (req, res, next) => {
    try {
      const parsed = planSyncSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createError(400, 'Invalid plan payload', { details: parsed.error.flatten() });
      }

      const { userId, plan, email, stripeCustomerId, stripeSubscriptionId } = parsed.data;
      const profile = await Profile.findOneAndUpdate(
        { userId },
        {
          $set: {
            plan: normalizePlan(plan),
            monthlyLimit: getPlanLimit(plan),
            ...(email ? { email } : {}),
            ...(stripeCustomerId !== undefined ? { stripeCustomerId } : {}),
            ...(stripeSubscriptionId !== undefined ? { stripeSubscriptionId } : {}),
          },
          $setOnInsert: {
            userId,
            email: email || `unknown+${userId}@local`,
            name: 'Unknown User',
            companyName: '',
            jobTitle: '',
            website: '',
            timezone: 'UTC',
            avatarUrl: '',
            preferences: {
              tone: 'direct',
              language: 'en',
            },
          },
        },
        {
          new: true,
          upsert: true,
        },
      );

      return sendSuccess(res, { profile: profileResponse(profile) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/internal/profiles/:userId', requireInternalServiceAuth, async (req, res, next) => {
    try {
      await Profile.deleteOne({ userId: req.params.userId });
      return sendSuccess(res, { deleted: true });
    } catch (error) {
      return next(error);
    }
  });
}
