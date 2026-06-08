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
import { registerBillingRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const app = createServiceApp({
  serviceName: 'billing-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
    stripeConfigured: Boolean(readEnv('STRIPE_SECRET_KEY', '')),
  }),
});

registerBillingRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('BILLING_PORT', '5006'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('BILLING_DB_NAME', 'coldmailai_billing');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'billing-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'billing-service', port: servicePort }, 'Billing service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'billing-service',
});
