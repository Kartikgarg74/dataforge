/* eslint-disable */
/**
 * Redis Cache
 *
 * Optional Redis-backed query cache for multi-instance deployments.
 * Falls back to in-memory LRU when Redis is not configured.
 * Requires: npm install redis
 */

let redisClient: any = null;
let redisConnected = false;

/**
 * Initialize Redis connection.
 * Call this on app startup if REDIS_URL is set.
 */
export async function initRedisCache(): Promise<boolean> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[cache] REDIS_URL not set, using in-memory LRU cache');
    return false;
  }

  try {
    const redis = await import('redis' as string);
    redisClient = redis.createClient({ url: redisUrl });

    redisClient.on('error', (err: Error) => {
      console.error('[cache] Redis error:', err.message);
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('[cache] Redis connected');
      redisConnected = true;
    });

    await redisClient.connect();
    return true;
  } catch (error: any) {
    console.error('[cache] Redis init failed:', error?.message || 'Unknown error');
    return false;
  }
}

/**
 * Check if Redis is available.
 */
export function isRedisAvailable(): boolean {
  return redisConnected && redisClient !== null;
}

/**
 * Get a cached value from Redis.
 */
export async function redisGet(key: string): Promise<string | null> {
  if (!isRedisAvailable()) return null;
  try {
    return await redisClient.get(`dataforge:${key}`);
  } catch {
    return null;
  }
}

/**
 * Set a cached value in Redis with TTL.
 */
export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await redisClient.setEx(`dataforge:${key}`, ttlSeconds, value);
  } catch {
    // Silently fail — cache is optional
  }
}

/**
 * Delete a cached value from Redis.
 */
export async function redisDel(key: string): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await redisClient.del(`dataforge:${key}`);
  } catch {
    // Silently fail
  }
}

/**
 * Clear all DataForge cache keys from Redis.
 */
export async function redisClearAll(): Promise<number> {
  if (!isRedisAvailable()) return 0;
  try {
    const keys = await redisClient.keys('dataforge:*');
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Get Redis cache statistics.
 */
export async function redisStats(): Promise<{
  connected: boolean;
  keyCount: number;
  memoryUsedBytes: number;
} | null> {
  if (!isRedisAvailable()) return null;
  try {
    const info = await redisClient.info('memory');
    const keys = await redisClient.keys('dataforge:*');
    const memMatch = info.match(/used_memory:(\d+)/);

    return {
      connected: true,
      keyCount: keys.length,
      memoryUsedBytes: memMatch ? parseInt(memMatch[1], 10) : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Disconnect Redis.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.disconnect();
    } catch {
      // ignore
    }
    redisClient = null;
    redisConnected = false;
  }
}
