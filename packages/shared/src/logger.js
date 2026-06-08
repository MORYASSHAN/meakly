import pino from 'pino';

const level = process.env.LOG_LEVEL || 'info';

export const logger = pino({
  level,
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createLogger(bindings = {}) {
  return logger.child(bindings);
}
