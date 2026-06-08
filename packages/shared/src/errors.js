export class AppError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}

export function createError(statusCode, message, options = {}) {
  return new AppError(statusCode, message, options);
}

export function notFound(req) {
  return new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`);
}

export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.expose === false ? 'Internal server error' : err.message || 'Internal server error';
  const payload = {
    success: false,
    message,
    requestId: req.requestId,
  };

  if (err.details) {
    payload.errors = err.details;
  }

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}
