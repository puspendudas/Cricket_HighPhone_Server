import { logger } from './logger';

export const validateEnvironment = (): void => {
  const requiredEnvVars = [
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'DB_DATABASE',
    'NODE_ENV',
    'PORT'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables:', missingVars);
    logger.error('Please check your .env file configuration');
  } else {
    logger.info('Environment variables validation passed');
  }

  // Log database URL (without password for security)
  const dbUrl = process.env.DB_URL || `mongodb+srv://${process.env.DB_USER}:***@${process.env.DB_HOST}/${process.env.DB_DATABASE}`;
  logger.info('Database URL configured:', dbUrl.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));
}
