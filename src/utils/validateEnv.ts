import { logger } from './logger';
import { DB_URL as resolvedDbUrl } from '@/config';

export const validateEnvironment = (): void => {
  const requiredEnvVars = ['DB_DATABASE', 'NODE_ENV', 'PORT', 'REDIS_URL'];

  const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);
  const hasMongoUri =
    (process.env.DB_URL && process.env.DB_URL.trim() !== '') ||
    (process.env.DB_HOST && process.env.DB_DATABASE);
  if (!hasMongoUri) {
    missingVars.push('DB_URL (or DB_HOST+DB_DATABASE for fallback)');
  }

  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars);
    logger.error('Please check your .env file configuration');
  } else {
    logger.info('Environment variables validation passed');
  }

  logger.info('Primary Database URL:', resolvedDbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  // Log Atlas sync URL if configured
  if (process.env.ATLAS_DB_URL) {
    logger.info('Atlas Sync URL configured:', process.env.ATLAS_DB_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
  }
}
