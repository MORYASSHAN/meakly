import { disconnectMongo } from './db.js';
import { logger } from './logger.js';

export function attachGracefulShutdown({ server, serviceName, shutdownHooks = [] } = {}) {
  const close = async (signal) => {
    logger.info({ serviceName, signal }, 'Shutting down');

    for (const hook of shutdownHooks) {
      try {
        await hook();
      } catch (error) {
        logger.error({ serviceName, error }, 'Shutdown hook failed');
      }
    }

    try {
      await disconnectMongo();
    } catch (error) {
      logger.error({ serviceName, error }, 'Mongo disconnect failed');
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }

    process.exit(0);
  };

  process.on('SIGINT', () => close('SIGINT'));
  process.on('SIGTERM', () => close('SIGTERM'));
}
