import mongoose from 'mongoose';

import { env } from '@config/env';
import { logger } from '@config/logger';

const dropLegacySlugIndexes = async () => {
  if (!mongoose.connection.db) {
    return;
  }

  const collections = ['products', 'brands', 'categories', 'colors', 'sizes'] as const;

  for (const collectionName of collections) {
    try {
      await mongoose.connection.db.collection(collectionName).dropIndex('slug_1');
      logger.info(`Dropped legacy MongoDB index ${collectionName}.slug_1`);
    } catch (error) {
      const err = error as { code?: number; message?: string };
      const message = err?.message ?? '';

      // Ignore "index not found" errors.
      if (err?.code === 27 || message.toLowerCase().includes('index not found')) {
        continue;
      }

      logger.warn(
        `Could not drop legacy index ${collectionName}.slug_1: ${message || String(error)}`
      );
    }
  }
};

const assertReplicaSetIfRequired = async () => {
  if (!env.mongoRequireReplicaSet || !mongoose.connection.db) {
    return;
  }

  const adminDb = mongoose.connection.db.admin();

  try {
    const helloResult = await adminDb.command({ hello: 1 });

    if (!helloResult.setName) {
      throw new Error('MongoDB replica set is required for transactions');
    }
  } catch (error) {
    throw new Error(`Replica set validation failed: ${(error as Error).message}`);
  }
};

export const connectMongo = async () => {
  await mongoose.connect(env.MONGODB_URI);
  await assertReplicaSetIfRequired();
  await dropLegacySlugIndexes();
  logger.info('MongoDB connected');
};

export const disconnectMongo = async () => {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
};

export const getMongoHealth = () => {
  return mongoose.connection.readyState === 1 ? 'up' : 'down';
};
