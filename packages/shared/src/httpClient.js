import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createError } from './errors.js';
import { recordDownstreamRequest } from './metrics.js';

export async function callService({
  baseUrl,
  path = '/',
  method = 'GET',
  body,
  headers = {},
  timeoutMs = 8000,
  requestId,
  callerService,
  targetService,
  serviceToken = process.env.SERVICE_INTERNAL_SECRET,
}) {
  if (!baseUrl) {
    throw createError(500, `Missing baseUrl for downstream call to ${targetService || baseUrl}`);
  }

  const url = new URL(path, baseUrl).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  const outboundRequestId = requestId || crypto.randomUUID();

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-request-id': outboundRequestId,
        ...(serviceToken ? { 'x-service-token': serviceToken } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsedBody = null;
    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = rawText;
      }
    }

    const durationMs = Math.round(performance.now() - startedAt);
    recordDownstreamRequest({
      service: callerService || 'unknown',
      target: targetService || new URL(baseUrl).host,
      method,
      statusCode: response.status,
      durationMs,
    });

    if (!response.ok) {
      const message = parsedBody?.message || `Downstream request failed with ${response.status}`;
      throw createError(response.status, message, {
        details: parsedBody?.errors || parsedBody,
      });
    }

    return {
      ok: true,
      status: response.status,
      data: parsedBody,
      latencyMs: durationMs,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      recordDownstreamRequest({
        service: callerService || 'unknown',
        target: targetService || new URL(baseUrl).host,
        method,
        statusCode: 504,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw createError(504, `Downstream request to ${targetService || baseUrl} timed out`);
    }

    if (typeof error.statusCode !== 'number') {
      recordDownstreamRequest({
        service: callerService || 'unknown',
        target: targetService || new URL(baseUrl).host,
        method,
        statusCode: 500,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
