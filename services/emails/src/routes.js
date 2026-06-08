import { z } from 'zod';
import {
  callService,
  createError,
  logger,
  readEnv,
  requireAuth,
  sendSuccess,
  validateBody,
  validateParams,
} from '@coldmailai/shared';
import { Email } from './models.js';

const generateSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  myOffer: z.string().trim().min(1).max(4000),
  targetRole: z.string().trim().min(1).max(160),
  painPoint: z.string().trim().min(1).max(320),
});

const paramsSchema = z.object({
  id: z.string().min(1),
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';

function emailPayload(email) {
  return email?.toPublicObject ? email.toPublicObject() : email;
}

async function reserveQuota(req) {
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');
  return callService({
    baseUrl: usageServiceUrl,
    path: '/reserve',
    method: 'POST',
    headers: {
      authorization: req.headers.authorization || '',
    },
    callerService: 'email-service',
    targetService: 'usage-service',
    requestId: req.requestId,
    serviceToken: '',
  });
}

async function commitQuota(req) {
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');
  return callService({
    baseUrl: usageServiceUrl,
    path: '/commit',
    method: 'POST',
    headers: {
      authorization: req.headers.authorization || '',
    },
    callerService: 'email-service',
    targetService: 'usage-service',
    requestId: req.requestId,
    serviceToken: '',
  });
}

async function releaseQuota(req) {
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');
  return callService({
    baseUrl: usageServiceUrl,
    path: '/release',
    method: 'POST',
    headers: {
      authorization: req.headers.authorization || '',
    },
    callerService: 'email-service',
    targetService: 'usage-service',
    requestId: req.requestId,
    serviceToken: '',
  });
}

async function generateAIEmail(req, body) {
  const aiServiceUrl = readEnv('AI_SERVICE_URL', 'http://localhost:5004');
  return callService({
    baseUrl: aiServiceUrl,
    path: '/generate-email',
    method: 'POST',
    headers: {
      authorization: req.headers.authorization || '',
    },
    body,
    callerService: 'email-service',
    targetService: 'ai-service',
    requestId: req.requestId,
    serviceToken: '',
  });
}

export function registerEmailRoutes(app) {
  app.post('/generate', requireAuth, validateBody(generateSchema), async (req, res, next) => {
    try {
      const input = req.validatedBody;
      const reserveResult = await reserveQuota(req);
      const reservedUsage = reserveResult.data?.data?.usage || null;

      let aiResult;
      try {
        aiResult = await generateAIEmail(req, input);
      } catch (error) {
        await releaseQuota(req).catch((releaseError) => {
          logger.warn({ error: releaseError, requestId: req.requestId }, 'Failed to release reserved usage after AI failure');
        });
        throw error;
      }

      const output = aiResult.data?.data?.email;
      if (!output) {
        throw createError(502, 'AI service returned an empty payload');
      }

      const email = await Email.create({
        userId: req.auth.sub,
        input,
        output,
        aiModel: readEnv('GROQ_MODEL', GROQ_MODEL),
        aiLatencyMs: aiResult.latencyMs || 0,
      });

      try {
        await commitQuota(req);
      } catch (commitError) {
        await Email.deleteOne({ _id: email._id });
        await releaseQuota(req).catch((releaseError) => {
          logger.warn({ error: releaseError, requestId: req.requestId }, 'Failed to release reserved usage after commit failure');
        });
        throw commitError;
      }

      return sendSuccess(res, {
        email: emailPayload(email),
        usage: reservedUsage,
      }, { statusCode: 201 });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/', requireAuth, async (req, res, next) => {
    try {
      const emails = await Email.find({ userId: req.auth.sub }).sort({ createdAt: -1 });
      return sendSuccess(res, {
        emails: emails.map(emailPayload),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/:id', requireAuth, validateParams(paramsSchema), async (req, res, next) => {
    try {
      const email = await Email.findOne({
        _id: req.validatedParams.id,
        userId: req.auth.sub,
      });
      if (!email) {
        throw createError(404, 'Email not found');
      }

      return sendSuccess(res, { email: emailPayload(email) });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/:id', requireAuth, validateParams(paramsSchema), async (req, res, next) => {
    try {
      const result = await Email.deleteOne({
        _id: req.validatedParams.id,
        userId: req.auth.sub,
      });

      if (result.deletedCount === 0) {
        throw createError(404, 'Email not found');
      }

      return sendSuccess(res, { deleted: true });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/:id/favorite', requireAuth, validateParams(paramsSchema), async (req, res, next) => {
    try {
      const email = await Email.findOne({
        _id: req.validatedParams.id,
        userId: req.auth.sub,
      });

      if (!email) {
        throw createError(404, 'Email not found');
      }

      email.isFavorited = !email.isFavorited;
      await email.save();

      return sendSuccess(res, { email: emailPayload(email) });
    } catch (error) {
      return next(error);
    }
  });
}
