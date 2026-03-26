import Redis from 'ioredis';
import { REDIS_URL } from '@/config';
import { logger } from '@utils/logger';

let client: Redis | null = null;

/**
 * Singleton ioredis client for match cache and other app Redis usage.
 * Socket.IO uses separate `redis` (node-redis) clients for @socket.io/redis-adapter.
 */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 20,
    });
    client.on('connect', () => logger.info('[Redis/ioredis] connecting'));
    client.on('ready', () => logger.info('[Redis/ioredis] ready'));
    client.on('error', (err) => logger.error('[Redis/ioredis] error', err));
    client.on('close', () => logger.warn('[Redis/ioredis] connection closed'));
  }
  return client;
}

export async function quitRedis(): Promise<void> {
  if (client) {
    try {
      await client.quit();
    } catch (e) {
      logger.warn('[Redis/ioredis] quit error', e);
    }
    client = null;
    logger.info('[Redis/ioredis] disconnected');
  }
}
