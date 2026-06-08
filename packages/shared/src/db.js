import mongoose from 'mongoose';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectMongo({ uri, dbName, serviceName }) {
  if (!uri) {
    throw new Error(`Missing MongoDB URI for ${serviceName}`);
  }

  await mongoose.connect(uri, {
    dbName,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000,
  });

  logger.info({ serviceName, dbName }, 'MongoDB connected');
  return mongoose.connection;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

export function mongoHealth() {
  return {
    readyState: mongoose.connection.readyState,
    ready: isMongoReady(),
    name: mongoose.connection.name,
    host: mongoose.connection.host,
  };
}
