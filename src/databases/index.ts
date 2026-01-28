import { logger } from '@utils/logger';

import mongoose, { ConnectOptions } from 'mongoose';

import { DB_URL } from '@/config';


const mongooseOptions: ConnectOptions = {
  // Connection options
  connectTimeoutMS: 30000, // Increased timeout to 30 seconds
  socketTimeoutMS: 45000, // Socket timeout
  serverSelectionTimeoutMS: 30000, // Server selection timeout
  retryWrites: true,
  w: 'majority',
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 1, // Minimum number of connections in the pool
  maxIdleTimeMS: 30000, // Maximum time a connection can remain idle
};

// connecting mongoose to remote db cluster
const DB = async () => {
  console.log('DB_URL', DB_URL);
  try {
    // Check if DB_URL is properly configured
    if (!DB_URL || DB_URL === 'mongodb+srv://undefined:undefined@undefined/undefined') {
      throw new Error('Database URL is not properly configured. Please check your environment variables.');
    }

    await mongoose.connect(DB_URL, mongooseOptions);
    logger.info('Connected to MongoDB successfully!');
    
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
