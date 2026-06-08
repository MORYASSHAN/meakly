import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  attachGracefulShutdown,
  attachStandardErrorHandlers,
  connectMongo,
  createServiceApp,
  logger,
  readBoolEnv,
  readEnv,
  requireInternalServiceAuth,
} from '@coldmailai/shared';
import { registerNotificationRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'notification-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
    gmailConfigured: Boolean(readEnv('GMAIL_USER', '')) && Boolean(readEnv('GMAIL_APP_PASSWORD', '')),
    mockMode: readBoolEnv('MOCK_GMAIL', !(Boolean(readEnv('GMAIL_USER', '')) && Boolean(readEnv('GMAIL_APP_PASSWORD', '')))),
    provider: 'gmail-smtp',
  }),
});

app.use('/internal', requireInternalServiceAuth);
registerNotificationRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('NOTIFICATION_PORT', '5007'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('NOTIFICATION_DB_NAME', 'coldmailai_notifications');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'notification-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'notification-service', port: servicePort }, 'Notification service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'notification-service',
});
