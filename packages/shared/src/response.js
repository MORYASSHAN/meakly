export function sendSuccess(res, data, options = {}) {
  const statusCode = options.statusCode || 200;
  const payload = {
    success: true,
    data,
  };

  if (options.meta !== undefined) {
    payload.meta = options.meta;
  }

  return res.status(statusCode).json(payload);
}

export function sendError(res, statusCode, message, options = {}) {
  const payload = {
    success: false,
    message,
  };

  if (options.details !== undefined) {
    payload.errors = options.details;
  }

  return res.status(statusCode).json(payload);
}
