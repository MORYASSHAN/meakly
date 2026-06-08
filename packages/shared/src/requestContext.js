import crypto from 'node:crypto';

export function requestContext(serviceName) {
  return (req, res, next) => {
    const incoming = req.headers['x-request-id'];
    const requestId = typeof incoming === 'string' && incoming.trim() ? incoming : crypto.randomUUID();
    req.requestId = requestId;
    req.serviceName = serviceName;
    res.setHeader('x-request-id', requestId);
    res.setHeader('x-service-name', serviceName);
    next();
  };
}

export function normalizeRouteLabel(url) {
  const pathname = url.split('?')[0] || '/';
  return pathname
    .replace(/[0-9a-fA-F]{24}/g, ':id')
    .replace(/[0-9a-fA-F-]{36}/g, ':id')
    .replace(/\b\d+\b/g, ':id');
}
