import { z } from 'zod';
import OpenAI from 'openai';
import {
  createError,
  readBoolEnv,
  readEnv,
  requireAuth,
  sendSuccess,
  validateBody,
} from '@coldmailai/shared';
import { AiRequestLog } from './models.js';

const generateSchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  myOffer: z.string().trim().min(1).max(4000),
  targetRole: z.string().trim().min(1).max(160),
  painPoint: z.string().trim().min(1).max(320),
  tone: z.string().trim().max(40).optional(),
  language: z.string().trim().max(20).optional(),
});

const rewriteSchema = z.object({
  subject: z.string().trim().min(1).max(240),
  emailBody: z.string().trim().min(1).max(6000),
  instruction: z.string().trim().min(1).max(1000),
});

const followUpSchema = z.object({
  subject: z.string().trim().min(1).max(240),
  emailBody: z.string().trim().min(1).max(6000),
  targetRole: z.string().trim().min(1).max(160),
  companyName: z.string().trim().min(1).max(160),
  painPoint: z.string().trim().min(1).max(320),
});

const SYSTEM_PROMPT = [
  'You are an elite B2B cold email copywriter.',
  'You write concise, personalized cold emails that get replies.',
  "Never use generic phrases like 'I hope this finds you well'.",
  'Be direct, specific, and human.',
  'Return only valid JSON with the requested fields.',
].join(' ');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

function getModelName() {
  return readEnv('GROQ_MODEL', GROQ_MODEL);
}

function isMockMode() {
  return readBoolEnv('MOCK_GROQ', !Boolean(readEnv('GROQ_API_KEY')));
}

function buildMockColdEmail({ companyName, myOffer, targetRole, painPoint }) {
  const subject = `Quick idea for ${companyName}`;
  return {
    subject,
    emailBody: `Hi ${targetRole},\n\nI noticed ${companyName} may be dealing with ${painPoint}. We help teams like yours with ${myOffer}.\n\nIf it is useful, I can send 2-3 ideas that could improve the result this month.\n\nBest,\nColdMailAI`,
    followUp1: `Just bumping this in case the note got buried. If ${painPoint} is still on your radar, I can share a short plan for ${companyName}.`,
    followUp2: `Last note from me. If improving ${painPoint} is a priority, happy to send a few concrete ideas tailored to ${companyName}.`,
  };
}

function buildMockRewrite({ subject, instruction, emailBody }) {
  return {
    subject: `${subject} - revised`,
    emailBody: `${emailBody}\n\nRewritten with focus: ${instruction}`,
  };
}

function buildMockFollowUps({ companyName, painPoint }) {
  return {
    followUp1: `Following up on my earlier note about ${companyName} and ${painPoint}. Happy to share a few quick ideas if helpful.`,
    followUp2: `Closing the loop here. If ${painPoint} is still a priority for ${companyName}, I can send a tighter recommendation.`,
  };
}

function extractJsonObject(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw createError(500, 'Empty response from model');
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw createError(500, 'Unable to parse model response as JSON', { details: text });
    }

    return JSON.parse(match[0]);
  }
}

function getGroqClient() {
  const apiKey = readEnv('GROQ_API_KEY', '');
  if (!apiKey || isMockMode()) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
  });
}

async function runGroqJson({
  userId,
  action,
  input,
  prompt,
  fallback,
  req,
}) {
  const startedAt = Date.now();
  const model = getModelName();
  const mock = isMockMode();
  const client = getGroqClient();

  if (!client) {
    const output = fallback();
    await AiRequestLog.create({
      userId,
      action,
      model,
      mock: true,
      input,
      output,
      latencyMs: Date.now() - startedAt,
      status: 'success',
    });

    return output;
  }

  try {
    const completion = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: prompt,
    });

    const content = completion.output_text || '';
    const parsed = extractJsonObject(content);

    await AiRequestLog.create({
      userId,
      action,
      model,
      mock,
      input,
      output: parsed,
      latencyMs: Date.now() - startedAt,
      status: 'success',
    });

    return parsed;
  } catch (error) {
    await AiRequestLog.create({
      userId,
      action,
      model,
      mock,
      input,
      output: null,
      latencyMs: Date.now() - startedAt,
      status: 'error',
      errorMessage: error.message,
    });

    throw createError(502, 'AI generation failed', {
      details: error.message,
    });
  }
}

async function handleGenerateColdEmail(req, res, next) {
  try {
    const { companyName, myOffer, targetRole, painPoint } = req.validatedBody;
    const prompt = [
      `Write a cold email campaign to a ${targetRole} at ${companyName}.`,
      `My offer: ${myOffer}.`,
      `Their likely pain point: ${painPoint}.`,
      'Return ONLY a JSON object with keys: subject, emailBody, followUp1, followUp2.',
      'No markdown, no explanation.',
    ].join(' ');

    const output = await runGroqJson({
      userId: req.auth.sub,
      action: 'generate-email',
      input: { companyName, myOffer, targetRole, painPoint },
      prompt,
      fallback: () => buildMockColdEmail({ companyName, myOffer, targetRole, painPoint }),
      req,
    });

    return sendSuccess(res, { email: output });
  } catch (error) {
    return next(error);
  }
}

async function handleRewriteEmail(req, res, next) {
  try {
    const { subject, emailBody, instruction } = req.validatedBody;
    const prompt = [
      `Rewrite this cold email with the following instruction: ${instruction}.`,
      'Return only JSON with keys: subject, emailBody.',
      `Current subject: ${subject}`,
      `Current emailBody: ${emailBody}`,
    ].join(' ');

    const output = await runGroqJson({
      userId: req.auth.sub,
      action: 'rewrite-email',
      input: { subject, emailBody, instruction },
      prompt,
      fallback: () => buildMockRewrite({ subject, emailBody, instruction }),
      req,
    });

    return sendSuccess(res, { email: output });
  } catch (error) {
    return next(error);
  }
}

async function handleGenerateFollowUps(req, res, next) {
  try {
    const { companyName, painPoint, targetRole, subject, emailBody } = req.validatedBody;
    const prompt = [
      `Generate two short follow-up emails for a cold outreach sequence.`,
      `Target role: ${targetRole}.`,
      `Company: ${companyName}.`,
      `Pain point: ${painPoint}.`,
      'Return only JSON with keys: followUp1, followUp2.',
      `Subject: ${subject}`,
      `Base email body: ${emailBody}`,
    ].join(' ');

    const output = await runGroqJson({
      userId: req.auth.sub,
      action: 'generate-followups',
      input: { companyName, painPoint, targetRole, subject },
      prompt,
      fallback: () => buildMockFollowUps({ companyName, painPoint }),
      req,
    });

    return sendSuccess(res, { followUps: output });
  } catch (error) {
    return next(error);
  }
}

export function registerAiRoutes(app) {
  app.post('/generate-email', requireAuth, validateBody(generateSchema), handleGenerateColdEmail);
  app.post('/rewrite-email', requireAuth, validateBody(rewriteSchema), handleRewriteEmail);
  app.post('/generate-followups', requireAuth, validateBody(followUpSchema), handleGenerateFollowUps);
}
