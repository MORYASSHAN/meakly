import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { performance } from 'node:perf_hooks';
import { logger } from './logger.js';
import { requestContext } from './requestContext.js';
import { createError, errorHandler, notFound } from './errors.js';
import { metricsContentType, metricsRegistry, recordHttpRequest } from './metrics.js';
import { sendSuccess } from './response.js';

function parseCorsOrigins(rawValue) {
  if (!rawValue) {
    return true;
  }

  const origins = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : true;
}

export function createServiceApp({
  serviceName,
  corsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS),
  healthCheck = async () => ({}),
} = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestContext(serviceName));
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        service: serviceName,
        requestId: req.requestId,
      }),
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );

  app.use((req, res, next) => {
    const startedAt = performance.now();
    res.on('finish', () => {
      recordHttpRequest({
        service: serviceName,
        method: req.method,
        route: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: performance.now() - startedAt,
      });
    });
    next();
  });

  app.get('/health', async (req, res, next) => {
    try {
      const dependencies = await healthCheck();
      return sendSuccess(res, {
        service: serviceName,
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
        dependencies,
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/metrics', async (req, res, next) => {
    try {
      res.setHeader('Content-Type', metricsContentType());
      return res.end(await metricsRegistry.metrics());
    } catch (error) {
      return next(error);
    }
  });

  return app;
}

export function attachStandardErrorHandlers(app) {
  app.use((req, res, next) => next(notFound(req)));
  app.use(errorHandler);
  return app;
}

export { createError };
