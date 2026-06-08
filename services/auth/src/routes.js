import { z } from 'zod';
import {
  callService,
  createError,
  createRandomToken,
  createTokenPair,
  hashToken,
  normalizePlan,
  parseDurationMs,
  readEnv,
  requireAuth,
  sendSuccess,
  validateBody,
  validateQuery,
  logger,
  verifyRefreshToken,
} from '@coldmailai/shared';
import { PasswordResetToken, RefreshToken, User, VerificationToken, hashVerificationSecret } from './models.js';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(200),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(320),
  token: z.string().min(20),
  newPassword: z.string().min(8).max(200),
});

const updatePlanSchema = z.object({
  userId: z.string().min(1),
  plan: z.enum(['free', 'pro', 'power']).default('free'),
  stripeCustomerId: z.string().nullable().optional(),
  stripeSubscriptionId: z.string().nullable().optional(),
  status: z.enum(['pending', 'active', 'disabled']).optional(),
});

const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(320).optional(),
  token: z.string().min(20).optional(),
});

function safeUser(user) {
  return user.toSafeObject ? user.toSafeObject() : {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    status: user.status,
    plan: user.plan,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    emailVerifiedAt: user.emailVerifiedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function authPayload(user) {
  return {
    sub: user._id.toString(),
    email: user.email,
    name: user.name,
    plan: user.plan,
    status: user.status,
  };
}

function refreshExpiryDate() {
  return new Date(Date.now() + parseDurationMs(readEnv('REFRESH_TOKEN_TTL', '30d'), 30 * 24 * 60 * 60 * 1000));
}

async function storeRefreshToken(userId, refreshToken) {
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiryDate(),
  });
}

async function createEmailVerification(userId) {
  const token = createRandomToken(32);
  const tokenHash = hashVerificationSecret(token);
  await VerificationToken.create({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return token;
}

async function createPasswordReset(userId) {
  const token = createRandomToken(32);
  const tokenHash = hashToken(token);
  await PasswordResetToken.create({
    userId,
    tokenHash,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  return token;
}

async function provisionSupportingServices(user, req) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    name: user.name,
    plan: user.plan,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
  };

  const userServiceUrl = readEnv('USER_SERVICE_URL', 'http://localhost:5002');
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');
  const notificationServiceUrl = readEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:5007');
  const gatewayUrl = readEnv('GATEWAY_URL', 'http://localhost:5000');

  const [profileResult, usageResult] = await Promise.allSettled([
    callService({
      baseUrl: userServiceUrl,
      path: '/internal/profiles/bootstrap',
      method: 'POST',
      body: payload,
      callerService: 'auth-service',
      targetService: 'user-service',
      requestId: req.requestId,
    }),
    callService({
      baseUrl: usageServiceUrl,
      path: '/internal/usage/bootstrap',
      method: 'POST',
      body: payload,
      callerService: 'auth-service',
      targetService: 'usage-service',
      requestId: req.requestId,
    }),
  ]);

  if (profileResult.status === 'rejected' || usageResult.status === 'rejected') {
    const details = {
      profileError: profileResult.status === 'rejected' ? profileResult.reason?.message : null,
      usageError: usageResult.status === 'rejected' ? usageResult.reason?.message : null,
    };
    throw createError(503, 'Unable to provision new account across services', { details });
  }

  const verificationToken = await createEmailVerification(user._id);
  const verificationUrl = `${gatewayUrl}/api/v1/auth/verify-email?email=${encodeURIComponent(user.email)}&token=${encodeURIComponent(verificationToken)}`;

  await callService({
    baseUrl: notificationServiceUrl,
    path: '/internal/notifications/verify-email',
    method: 'POST',
    body: {
      email: user.email,
      name: user.name,
      verificationUrl,
    },
    callerService: 'auth-service',
    targetService: 'notification-service',
    requestId: req.requestId,
  }).catch((error) => {
    logger.warn({ error, requestId: req.requestId }, 'Verification email could not be sent');
  });

  return {
    verificationToken,
  };
}

async function cleanupAfterProvisioningFailure(userId, req) {
  const userServiceUrl = readEnv('USER_SERVICE_URL', 'http://localhost:5002');
  const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');

  await Promise.allSettled([
    callService({
      baseUrl: userServiceUrl,
      path: `/internal/profiles/${userId}`,
      method: 'DELETE',
      callerService: 'auth-service',
      targetService: 'user-service',
      requestId: req.requestId,
    }),
    callService({
      baseUrl: usageServiceUrl,
      path: `/internal/usage/${userId}`,
      method: 'DELETE',
      callerService: 'auth-service',
      targetService: 'usage-service',
      requestId: req.requestId,
    }),
  ]);
}

async function issueSessionTokens(user) {
  const tokenPair = createTokenPair(authPayload(user));
  await storeRefreshToken(user._id, tokenPair.refreshToken);
  return tokenPair;
}

async function removeRefreshToken(refreshToken) {
  const tokenHash = hashToken(refreshToken);
  await RefreshToken.findOneAndUpdate(
    { tokenHash },
    { $set: { revokedAt: new Date() } },
  );
}

async function verifyStoredRefreshToken(refreshToken) {
  const payload = verifyRefreshToken(refreshToken);
  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await RefreshToken.findOne({
    userId: payload.sub,
    tokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!tokenRecord) {
    throw createError(401, 'Refresh token has been revoked or expired');
  }

  return payload;
}

async function handleEmailVerification(req, res, next, input) {
  try {
    const parsed = verifyEmailSchema.safeParse(input);
    if (!parsed.success) {
      throw createError(400, 'Invalid verification payload', { details: parsed.error.flatten() });
    }

    const { email, token } = parsed.data;
    if (!email || !token) {
      throw createError(400, 'Email and token are required');
    }

    const user = await User.findOne({ email });
    if (!user) {
      throw createError(404, 'User not found');
    }

    const tokenHash = hashVerificationSecret(token);
    const verificationRecord = await VerificationToken.findOne({
      userId: user._id,
      tokenHash,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationRecord) {
      throw createError(400, 'Verification token is invalid or expired');
    }

    verificationRecord.usedAt = new Date();
    await verificationRecord.save();

    user.emailVerifiedAt = new Date();
    user.status = 'active';
    await user.save();

    return sendSuccess(res, {
      verified: true,
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

export function registerAuthRoutes(app) {
  app.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
      const { name, email, password } = req.validatedBody;
      const existing = await User.findOne({ email });
      if (existing) {
        throw createError(409, 'Email is already registered');
      }

      const user = new User({
        name,
        email,
        status: 'pending',
        plan: 'free',
      });
      user.password = password;
      await user.save();

      const verification = await provisionSupportingServices(user, req).catch(async (error) => {
        await Promise.allSettled([
          cleanupAfterProvisioningFailure(user._id.toString(), req),
          User.deleteOne({ _id: user._id }),
        ]);
        throw error;
      });

      const tokens = await issueSessionTokens(user);

      return sendSuccess(
        res,
        {
          user: safeUser(user),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          verificationTokenCreated: Boolean(verification?.verificationToken),
        },
        { statusCode: 201 },
      );
    } catch (error) {
      return next(error);
    }
  });

  app.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { email, password } = req.validatedBody;
      const user = await User.findOne({ email });
      if (!user) {
        throw createError(401, 'Invalid email or password');
      }

      if (user.status === 'disabled') {
        throw createError(403, 'Account is disabled');
      }

      const valid = await user.comparePassword(password);
      if (!valid) {
        throw createError(401, 'Invalid email or password');
      }

      user.lastLoginAt = new Date();
      if (user.status === 'pending') {
        user.status = 'active';
      }
      await user.save();

      const tokens = await issueSessionTokens(user);

      return sendSuccess(res, {
        user: safeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/refresh', validateBody(refreshSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.validatedBody;
      const payload = await verifyStoredRefreshToken(refreshToken);
      const user = await User.findById(payload.sub);
      if (!user) {
        throw createError(404, 'User not found');
      }

      await removeRefreshToken(refreshToken);
      const tokens = await issueSessionTokens(user);

      return sendSuccess(res, {
        user: safeUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/logout', validateBody(refreshSchema), async (req, res, next) => {
    try {
      const { refreshToken } = req.validatedBody;
      await removeRefreshToken(refreshToken);
      return sendSuccess(res, { loggedOut: true });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await User.findById(req.auth.sub);
      if (!user) {
        throw createError(404, 'User not found');
      }

      const userServiceUrl = readEnv('USER_SERVICE_URL', 'http://localhost:5002');
      const usageServiceUrl = readEnv('USAGE_SERVICE_URL', 'http://localhost:5003');

      const [profileResult, usageResult] = await Promise.allSettled([
        callService({
          baseUrl: userServiceUrl,
          path: `/internal/profiles/by-user-id/${user._id.toString()}`,
          method: 'GET',
          callerService: 'auth-service',
          targetService: 'user-service',
          requestId: req.requestId,
        }),
        callService({
          baseUrl: usageServiceUrl,
          path: `/internal/usage/current/${user._id.toString()}`,
          method: 'GET',
          callerService: 'auth-service',
          targetService: 'usage-service',
          requestId: req.requestId,
        }),
      ]);

      return sendSuccess(res, {
        user: safeUser(user),
        profile: profileResult.status === 'fulfilled' ? profileResult.value.data?.data || null : null,
        usage: usageResult.status === 'fulfilled' ? usageResult.value.data?.data || null : null,
        warnings: [
          profileResult.status === 'rejected' ? profileResult.reason?.message : null,
          usageResult.status === 'rejected' ? usageResult.reason?.message : null,
        ].filter(Boolean),
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/verify-email', validateQuery(verifyEmailSchema), async (req, res, next) => {
    return handleEmailVerification(req, res, next, req.validatedQuery);
  });

  app.post('/verify-email', validateBody(verifyEmailSchema), async (req, res, next) => {
    return handleEmailVerification(req, res, next, req.validatedBody);
  });

  app.post('/resend-verification', validateBody(forgotPasswordSchema), async (req, res, next) => {
    try {
      const { email } = req.validatedBody;
      const user = await User.findOne({ email });
      if (!user) {
        return sendSuccess(res, { sent: true });
      }

      const token = await createEmailVerification(user._id);
      const verificationUrl = `${readEnv('GATEWAY_URL', 'http://localhost:5000')}/api/v1/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

      await callService({
        baseUrl: readEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:5007'),
        path: '/internal/notifications/verify-email',
        method: 'POST',
        body: {
          email: user.email,
          name: user.name,
          verificationUrl,
        },
        callerService: 'auth-service',
        targetService: 'notification-service',
        requestId: req.requestId,
      }).catch((error) => {
        logger.warn({ error, requestId: req.requestId }, 'Unable to resend verification email');
      });

      return sendSuccess(res, { sent: true });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/forgot-password', validateBody(forgotPasswordSchema), async (req, res, next) => {
    try {
      const { email } = req.validatedBody;
      const user = await User.findOne({ email });
      if (!user) {
        return sendSuccess(res, { sent: true });
      }

      const token = await createPasswordReset(user._id);
      const resetUrl = `${readEnv('GATEWAY_URL', 'http://localhost:5000')}/api/v1/auth/reset-password?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

      await callService({
        baseUrl: readEnv('NOTIFICATION_SERVICE_URL', 'http://localhost:5007'),
        path: '/internal/notifications/password-reset',
        method: 'POST',
        body: {
          email: user.email,
          name: user.name,
          resetUrl,
        },
        callerService: 'auth-service',
        targetService: 'notification-service',
        requestId: req.requestId,
      }).catch((error) => {
        logger.warn({ error, requestId: req.requestId }, 'Unable to send password reset email');
      });

      return sendSuccess(res, { sent: true });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/reset-password', validateBody(resetPasswordSchema), async (req, res, next) => {
    try {
      const { email, token, newPassword } = req.validatedBody;
      const user = await User.findOne({ email });
      if (!user) {
        throw createError(404, 'User not found');
      }

      const tokenHash = hashToken(token);
      const resetRecord = await PasswordResetToken.findOne({
        userId: user._id,
        tokenHash,
        usedAt: null,
        expiresAt: { $gt: new Date() },
      });

      if (!resetRecord) {
        throw createError(400, 'Reset token is invalid or expired');
      }

      user.password = newPassword;
      await user.save();

      resetRecord.usedAt = new Date();
      await resetRecord.save();

      await RefreshToken.updateMany(
        { userId: user._id },
        { $set: { revokedAt: new Date() } },
      );

      return sendSuccess(res, { reset: true });
    } catch (error) {
      return next(error);
    }
  });

  app.patch('/internal/account/plan', async (req, res, next) => {
    try {
      const parsed = updatePlanSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createError(400, 'Invalid account plan payload', { details: parsed.error.flatten() });
      }

      const { userId, plan, stripeCustomerId, stripeSubscriptionId, status } = parsed.data;
      const update = {
        plan: normalizePlan(plan),
      };

      if (stripeCustomerId !== undefined) {
        update.stripeCustomerId = stripeCustomerId;
      }

      if (stripeSubscriptionId !== undefined) {
        update.stripeSubscriptionId = stripeSubscriptionId;
      }

      if (status) {
        update.status = status;
      }

      const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true });
      if (!user) {
        throw createError(404, 'User not found');
      }

      return sendSuccess(res, { user: safeUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/internal/auth/user/:userId', async (req, res, next) => {
    try {
      const user = await User.findById(req.params.userId);
      if (!user) {
        throw createError(404, 'User not found');
      }

      return sendSuccess(res, { user: safeUser(user) });
    } catch (error) {
      return next(error);
    }
  });
}
