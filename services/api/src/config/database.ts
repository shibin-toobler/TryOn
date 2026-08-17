import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => logger.info('mongo connected'));
  mongoose.connection.on('disconnected', () => logger.warn('mongo disconnected'));
  mongoose.connection.on('error', (err) => logger.error('mongo error', err));

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.connection.close();
}
