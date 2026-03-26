import { logger } from '@utils/logger';

import mongoose, { ConnectOptions } from 'mongoose';

import { DB_URL } from '@/config';


const mongooseOptions: ConnectOptions = {
  // Connection options optimized for local MongoDB
  connectTimeoutMS: 10000,
  socketTimeoutMS: 30000,
  serverSelectionTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 15,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
};

function warnIfPrimaryDbLooksLikeAtlas(uri: string): void {
  const u = uri.trim();
  if (!u) return;
  if (u.startsWith('mongodb+srv://') || /\.mongodb\.net\b/i.test(u)) {
    logger.warn(
      '[DB] DB_URL looks like Atlas. Terminal and REST should write to the local replica set; use docker-compose DB_URL=mongodb://mongodb:27017/... or Atlas will get app writes directly (sync-service expects local as source).',
    );
  }
}

// connecting mongoose — primary URI from DB_URL (local rs in Docker; Atlas only via sync-service)
const DB = async () => {
  console.log('DB_URL', DB_URL);
  try {
    // Check if DB_URL is properly configured
    if (!DB_URL) {
      throw new Error('Database URL is not properly configured. Please check your environment variables.');
    }

    warnIfPrimaryDbLooksLikeAtlas(DB_URL);

    await mongoose.connect(DB_URL, mongooseOptions);
    logger.info('Connected to MongoDB successfully (terminal + API use this URI).');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

  } catch (err) {
    logger.error('Failed to connect to MongoDB:', err);
    // Don't throw error to prevent app crash, let it retry
  }
};

export default DB;
