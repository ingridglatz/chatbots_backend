const Redis = require('ioredis');
const logger = require('../utils/logger');

let redis;

const getRedisClient = () => {
  if (redis) return redis;
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis: tentativa de reconexão #${times} em ${delay}ms`);
      return delay;
    },
    enableOfflineQueue: true,
    lazyConnect: false,
  });
  redis.on('connect', () => logger.info('Redis conectado'));
  redis.on('error', (err) => logger.error('Erro no Redis', { error: err.message }));
  redis.on('reconnecting', () => logger.warn('Redis: reconectando...'));
  return redis;
};

const get = async (key) => {
  const client = getRedisClient();
  const value = await client.get(key);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return value; }
};

const set = async (key, value, ttlSeconds = null) => {
  const client = getRedisClient();
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (ttlSeconds) {
    await client.set(key, serialized, 'EX', ttlSeconds);
  } else {
    await client.set(key, serialized);
  }
};

const del = async (key) => {
  const client = getRedisClient();
  await client.del(key);
};

const testConnection = async () => {
  const client = getRedisClient();
  await client.ping();
  return true;
};

module.exports = { getRedisClient, get, set, del, testConnection };
