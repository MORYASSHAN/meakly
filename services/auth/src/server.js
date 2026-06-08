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
import { registerAuthRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'auth-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
  }),
});

app.use('/internal', requireInternalServiceAuth);
registerAuthRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('AUTH_PORT', '5001'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('AUTH_DB_NAME', 'coldmailai_auth');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'auth-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'auth-service', port: servicePort }, 'Auth service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'auth-service',
});
