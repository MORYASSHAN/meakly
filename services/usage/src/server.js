import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  attachGracefulShutdown,
  attachStandardErrorHandlers,
  connectMongo,
  createServiceApp,
  logger,
  readEnv,
  requireInternalServiceAuth,
} from '@coldmailai/shared';
import { registerUsageRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'usage-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
  }),
});

app.use('/internal', requireInternalServiceAuth);
registerUsageRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('USAGE_PORT', '5003'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('USAGE_DB_NAME', 'coldmailai_usage');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'usage-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'usage-service', port: servicePort }, 'Usage service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'usage-service',
});
