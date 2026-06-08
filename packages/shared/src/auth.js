import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createError } from './errors.js';

function readJwtSecret(kind) {
  const envKey = kind === 'refresh' ? 'JWT_REFRESH_SECRET' : 'JWT_ACCESS_SECRET';
  const secret = process.env[envKey];
  if (!secret) {
    throw new Error(`Missing environment variable: ${envKey}`);
  }
  return secret;
}

export function signAccessToken(payload, expiresIn = process.env.ACCESS_TOKEN_TTL || '15m') {
  return jwt.sign(payload, readJwtSecret('access'), {
    expiresIn,
    issuer: 'coldmailai',
    audience: 'coldmailai-api',
  });
}

export function signRefreshToken(payload, expiresIn = process.env.REFRESH_TOKEN_TTL || '30d') {
  return jwt.sign(payload, readJwtSecret('refresh'), {
    expiresIn,
    issuer: 'coldmailai',
    audience: 'coldmailai-refresh',
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, readJwtSecret('access'), {
    issuer: 'coldmailai',
    audience: 'coldmailai-api',
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, readJwtSecret('refresh'), {
    issuer: 'coldmailai',
    audience: 'coldmailai-refresh',
  });
}

export function createTokenPair(payload) {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export async function hashSecret(secret) {
  return bcrypt.hash(secret, 10);
}

export async function compareSecret(plainText, hashedValue) {
  return bcrypt.compare(plainText, hashedValue);
}

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : null;

  if (!token) {
    return next(createError(401, 'Missing bearer token'));
  }

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch (error) {
    return next(createError(401, 'Invalid or expired access token'));
  }
}

export function requireInternalServiceAuth(req, res, next) {
  const expected = process.env.SERVICE_INTERNAL_SECRET;
  if (!expected) {
    return next(createError(500, 'SERVICE_INTERNAL_SECRET is not configured'));
  }

  const provided = req.headers['x-service-token'];
  if (provided !== expected) {
    return next(createError(403, 'Forbidden'));
  }

  return next();
}
