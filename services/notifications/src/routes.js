import { z } from 'zod';
import nodemailer from 'nodemailer';
import {
  createError,
  readBoolEnv,
  readEnv,
  requireInternalServiceAuth,
  sendSuccess,
  validateBody,
} from '@coldmailai/shared';
import { NotificationLog } from './models.js';

const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(80),
  verificationUrl: z.string().trim().url(),
});

const passwordResetSchema = z.object({
  email: z.string().trim().email().max(320),
  name: z.string().trim().min(1).max(80),
  resetUrl: z.string().trim().url(),
});

const genericEmailSchema = z.object({
  to: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(240),
  html: z.string().trim().min(1),
  text: z.string().trim().min(1).optional(),
  template: z.string().trim().min(1).max(80),
});

function isMockMailer() {
  const hasCredentials = Boolean(readEnv('GMAIL_USER', '')) && Boolean(readEnv('GMAIL_APP_PASSWORD', ''));

  return readBoolEnv('MOCK_GMAIL', !hasCredentials);
}

function getMailerClient() {
  const user = readEnv('GMAIL_USER', '');
  const appPassword = readEnv('GMAIL_APP_PASSWORD', '');

  if (!user || !appPassword || isMockMailer()) {
    return null;
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user,
      pass: appPassword,
    },
  });
}

function normalizeMailResult(info) {
  return {
    messageId: info?.messageId || null,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    response: info?.response || null,
  };
}

async function writeLog(entry) {
  return NotificationLog.create(entry);
}

async function deliverEmail({ to, subject, html, text, template, req }) {
  const mailer = getMailerClient();
  const startedAt = Date.now();

  if (!mailer) {
    const info = normalizeMailResult({
      messageId: `mock_${Date.now()}`,
      accepted: [to],
      rejected: [],
      response: 'mock',
    });

    await writeLog({
      to,
      template,
      subject,
      provider: 'mock',
      providerMessageId: info.messageId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      payload: { html, text },
    });

    return info;
  }

  try {
    const user = readEnv('GMAIL_USER', '');
    const response = await mailer.sendMail({
      from: `ColdMailAI <${user}>`,
      to,
      subject,
      html,
      text,
    });
    const info = normalizeMailResult(response);

    await writeLog({
      to,
      template,
      subject,
      provider: 'gmail-smtp',
      providerMessageId: info.messageId,
      status: 'success',
      latencyMs: Date.now() - startedAt,
      payload: { html, text },
    });

    return info;
  } catch (error) {
    await writeLog({
      to,
      template,
      subject,
      provider: 'gmail-smtp',
      providerMessageId: null,
      status: 'error',
      latencyMs: Date.now() - startedAt,
      payload: { html, text },
      errorMessage: error.message,
    });

    throw createError(502, 'Unable to send email notification', {
      details: error.message,
    });
  }
}

function renderVerifyEmail({ name, verificationUrl }) {
  return {
    subject: 'Verify your ColdMailAI email',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to ColdMailAI, ${name}</h2>
        <p>Verify your email address to finish setting up your account.</p>
        <p><a href="${verificationUrl}">Verify email</a></p>
        <p>If the button does not work, copy this URL into your browser:</p>
        <p>${verificationUrl}</p>
      </div>
    `,
    text: `Welcome to ColdMailAI, ${name}. Verify your email: ${verificationUrl}`,
  };
}

function renderPasswordReset({ name, resetUrl }) {
  return {
    subject: 'Reset your ColdMailAI password',
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Password reset requested for ${name}</h2>
        <p>Use the link below to reset your password.</p>
        <p><a href="${resetUrl}">Reset password</a></p>
        <p>If the button does not work, copy this URL into your browser:</p>
        <p>${resetUrl}</p>
      </div>
    `,
    text: `Password reset requested for ${name}. Reset here: ${resetUrl}`,
  };
}

export function registerNotificationRoutes(app) {
  app.post('/internal/notifications/verify-email', requireInternalServiceAuth, validateBody(verifyEmailSchema), async (req, res, next) => {
    try {
      const payload = req.validatedBody;
      const email = await deliverEmail({
        to: payload.email,
        template: 'verify-email',
        ...renderVerifyEmail(payload),
        req,
      });

      return sendSuccess(res, { sent: true, result: email || null });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/notifications/password-reset', requireInternalServiceAuth, validateBody(passwordResetSchema), async (req, res, next) => {
    try {
      const payload = req.validatedBody;
      const email = await deliverEmail({
        to: payload.email,
        template: 'password-reset',
        ...renderPasswordReset(payload),
        req,
      });

      return sendSuccess(res, { sent: true, result: email || null });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/internal/notifications/email', requireInternalServiceAuth, validateBody(genericEmailSchema), async (req, res, next) => {
    try {
      const payload = req.validatedBody;
      const email = await deliverEmail({
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        template: payload.template,
        req,
      });

      return sendSuccess(res, { sent: true, result: email || null });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/internal/notifications/logs', requireInternalServiceAuth, async (req, res, next) => {
    try {
      const logs = await NotificationLog.find().sort({ createdAt: -1 }).limit(100);
      return sendSuccess(res, {
        logs,
      });
    } catch (error) {
      return next(error);
    }
  });
}
