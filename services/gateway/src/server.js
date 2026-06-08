import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  attachStandardErrorHandlers,
  callService,
  createError,
  createServiceApp,
  readEnv,
  sendSuccess,
  logger,
} from '@coldmailai/shared';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const SERVICE_ROUTES = [
  {
    prefix: '/api/v1/auth',
    target: readEnv('AUTH_SERVICE_URL', 'http://localhost:5001'),
    name: 'auth-service',
  },
  {
    prefix: '/api/v1/users',
    target: readEnv('USER_SERVICE_URL', 'http://localhost:5002'),
    name: 'user-service',
  },
  {
    prefix: '/api/v1/usage',
    target: readEnv('USAGE_SERVICE_URL', 'http://localhost:5003'),
    name: 'usage-service',
  },
  {
    prefix: '/api/v1/ai',
    target: readEnv('AI_SERVICE_URL', 'http://localhost:5004'),
    name: 'ai-service',
  },
  {
    prefix: '/api/v1/emails',
    target: readEnv('EMAIL_SERVICE_URL', 'http://localhost:5005'),
    name: 'email-service',
  },
  {
    prefix: '/api/v1/billing',
    target: readEnv('BILLING_SERVICE_URL', 'http://localhost:5006'),
    name: 'billing-service',
  },
];

function resolveRoute(pathname) {
  return SERVICE_ROUTES.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`));
}

function buildUpstreamPath(originalUrl, prefix) {
  const incomingUrl = new URL(originalUrl, 'http://gateway.local');
  const upstreamPath = incomingUrl.pathname.slice(prefix.length) || '/';
  return `${upstreamPath}${incomingUrl.search}`;
}

function copyRequestHeaders(req) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (
      key === 'host' ||
      key === 'connection' ||
      key === 'content-length' ||
      key === 'accept-encoding'
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
      continue;
    }

    if (value !== undefined) {
      headers[key] = value;
    }
  }

  headers['x-request-id'] = req.requestId;
  return headers;
}

async function forwardRequest(req, res, route) {
  const targetUrl = new URL(buildUpstreamPath(req.originalUrl, route.prefix), route.target).toString();
  const startedAt = performance.now();
  const method = req.method.toUpperCase();
  const body = ['GET', 'HEAD'].includes(method)
    ? undefined
    : req.rawBody || (req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined);

  const response = await fetch(targetUrl, {
    method,
    headers: copyRequestHeaders(req),
    body,
  });

  const durationMs = Math.round(performance.now() - startedAt);
  const raw = await response.arrayBuffer();
  const buffer = Buffer.from(raw);

  res.status(response.status);
  res.setHeader('x-upstream-service', route.name);
  res.setHeader('x-upstream-latency-ms', String(durationMs));

  for (const [key, value] of response.headers.entries()) {
    if (
      key === 'connection' ||
      key === 'content-length' ||
      key === 'transfer-encoding' ||
      key === 'keep-alive' ||
      key === 'proxy-authenticate' ||
      key === 'proxy-authorization' ||
      key === 'te' ||
      key === 'trailers' ||
      key === 'upgrade'
    ) {
      continue;
    }

    res.setHeader(key, value);
  }

  return res.send(buffer);
}

async function buildSystemHealth(req) {
  const checks = await Promise.allSettled(
    SERVICE_ROUTES.map(async (route) => {
      const result = await callService({
        baseUrl: route.target,
        path: '/health',
        method: 'GET',
        callerService: 'gateway',
        targetService: route.name,
        requestId: req.requestId,
      });

      return {
        service: route.name,
        target: route.target,
        status: 'up',
        latencyMs: result.latencyMs,
        data: result.data?.data || null,
      };
    }),
  );

  return checks.map((entry, index) => {
    const route = SERVICE_ROUTES[index];
    if (entry.status === 'fulfilled') {
      return entry.value;
    }

    return {
      service: route.name,
      target: route.target,
      status: 'down',
      error: entry.reason?.message || 'Unavailable',
      statusCode: entry.reason?.statusCode || 500,
    };
  });
}

const app = createServiceApp({
  serviceName: 'gateway',
  healthCheck: async () => ({
    routes: SERVICE_ROUTES.map((route) => ({
      service: route.name,
      target: route.target,
    })),
  }),
});

app.get('/', (req, res) => {
  return sendSuccess(res, {
    service: 'gateway',
    message: 'ColdMailAI gateway is running',
    version: '1.0.0',
  });
});

app.get('/api/v1/system/services', (req, res) => {
  return sendSuccess(res, {
    services: SERVICE_ROUTES.map((route) => ({
      service: route.name,
      prefix: route.prefix,
      target: route.target,
    })),
  });
});

app.get('/api/v1/system/health', async (req, res, next) => {
  try {
    const services = await buildSystemHealth(req);
    return sendSuccess(res, {
      gateway: {
        service: 'gateway',
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
      },
      services,
    });
  } catch (error) {
    return next(error);
  }
});

app.use('/api/v1', async (req, res, next) => {
  try {
    const route = resolveRoute(req.originalUrl);
    if (!route) {
      return next();
    }

    return await forwardRequest(req, res, route);
  } catch (error) {
    logger.error({ error, requestId: req.requestId }, 'Gateway proxy failed');
    return next(createError(error.statusCode || 502, error.message || 'Gateway proxy failed', { details: error.details }));
  }
});

attachStandardErrorHandlers(app);

const port = Number.parseInt(readEnv('GATEWAY_PORT', '5000'), 10);
const server = app.listen(port, () => {
  logger.info({ service: 'gateway', port }, 'Gateway listening');
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
