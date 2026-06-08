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
import { registerUserRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'user-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
  }),
});

app.use('/internal', requireInternalServiceAuth);
registerUserRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('USER_PORT', '5002'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('USER_DB_NAME', 'coldmailai_users');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'user-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'user-service', port: servicePort }, 'User service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'user-service',
});
