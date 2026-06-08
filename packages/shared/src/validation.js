import { createError } from './errors.js';

export function validateBody(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        createError(400, 'Invalid request body', {
          details: parsed.error.flatten(),
        }),
      );
    }

    req.validatedBody = parsed.data;
    return next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return next(
        createError(400, 'Invalid request query', {
          details: parsed.error.flatten(),
        }),
      );
    }

    req.validatedQuery = parsed.data;
    return next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      return next(
        createError(400, 'Invalid route params', {
          details: parsed.error.flatten(),
        }),
      );
    }

    req.validatedParams = parsed.data;
    return next();
  };
}
