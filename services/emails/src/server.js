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
} from '@coldmailai/shared';
import { registerEmailRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'email-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
  }),
});

registerEmailRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('EMAIL_PORT', '5005'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('EMAIL_DB_NAME', 'coldmailai_emails');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'email-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'email-service', port: servicePort }, 'Email service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'email-service',
});
