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
} from '@coldmailai/shared';
import { registerAiRoutes } from './routes.js';

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

const GROQ_MODEL = 'llama-3.3-70b-versatile';

const app = createServiceApp({
  serviceName: 'ai-service',
  healthCheck: async () => ({
    mongoReady: mongoose.connection.readyState === 1,
    groqConfigured: Boolean(readEnv('GROQ_API_KEY', '')),
    mockMode: readBoolEnv('MOCK_GROQ', !Boolean(readEnv('GROQ_API_KEY', ''))),
    provider: 'groq',
    baseURL: 'https://api.groq.com/openai/v1',
    model: readEnv('GROQ_MODEL', GROQ_MODEL),
  }),
});

registerAiRoutes(app);
attachStandardErrorHandlers(app);

const servicePort = Number.parseInt(readEnv('AI_PORT', '5004'), 10);
const mongoUri = readEnv('MONGO_URI', 'mongodb://127.0.0.1:27017');
const mongoDbName = readEnv('AI_DB_NAME', 'coldmailai_ai');

await connectMongo({
  uri: mongoUri,
  dbName: mongoDbName,
  serviceName: 'ai-service',
});

const server = app.listen(servicePort, () => {
  logger.info({ service: 'ai-service', port: servicePort }, 'AI service listening');
});

attachGracefulShutdown({
  server,
  serviceName: 'ai-service',
});
