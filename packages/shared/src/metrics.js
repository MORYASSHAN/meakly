import client from 'prom-client';
import { normalizeRouteLabel } from './requestContext.js';

export const metricsRegistry = new client.Registry();

client.collectDefaultMetrics({
  register: metricsRegistry,
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of inbound HTTP requests in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const httpRequestTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total inbound HTTP requests',
  labelNames: ['service', 'method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const downstreamRequestDuration = new client.Histogram({
  name: 'downstream_request_duration_seconds',
  help: 'Duration of outbound service calls in seconds',
  labelNames: ['service', 'target', 'method', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export function recordHttpRequest({ service, method, route, statusCode, durationMs }) {
  const durationSeconds = durationMs / 1000;
  const normalizedRoute = normalizeRouteLabel(route || '/');
  httpRequestDuration
    .labels(service, method, normalizedRoute, String(statusCode))
    .observe(durationSeconds);
  httpRequestTotal
    .labels(service, method, normalizedRoute, String(statusCode))
    .inc();
}

export function recordDownstreamRequest({ service, target, method, statusCode, durationMs }) {
  const durationSeconds = durationMs / 1000;
  downstreamRequestDuration
    .labels(service, target, method, String(statusCode))
    .observe(durationSeconds);
}

export async function renderMetrics() {
  return metricsRegistry.metrics();
}

export function metricsContentType() {
  return metricsRegistry.contentType;
}
