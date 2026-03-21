/**
 * Query Result Cache
 *
 * Caches SQL query results using an LRU cache underneath.
 * Cache key = hash of (sql + params + connectorId).
 *
 * TTL policies:
 *   - Aggregate queries: 5 minutes
 *   - Dashboard widgets: configurable
 *   - Detail queries: 1 minute
 *   - Schema queries: 30 minutes
 */

import { LRUCache } from './lru';
import type { CacheStats } from './lru';

/** TTL presets in milliseconds */
export const CacheTTL = {
  AGGREGATE: 5 * 60 * 1000,       // 5 minutes
  DASHBOARD_DEFAULT: 5 * 60 * 1000, // 5 minutes (configurable per widget)
  DETAIL: 1 * 60 * 1000,           // 1 minute
  SCHEMA: 30 * 60 * 1000,          // 30 minutes
} as const;

/** Max cache size: 50 MB */
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

/** Singleton query cache instance */
const queryCache = new LRUCache<unknown>(MAX_CACHE_SIZE_BYTES, CacheTTL.AGGREGATE);

/**
 * Generate a cache key from SQL, params, and connector ID.
 * Uses a simple hash to produce a deterministic string key.
 */
export function makeCacheKey(sql: string, params?: unknown[], connectorId?: string): string {
  const raw = JSON.stringify({ sql, params: params ?? [], connectorId: connectorId ?? 'default' });
  // Simple DJB2-style hash for fast, deterministic key generation
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash + raw.charCodeAt(i)) | 0;
  }
  // Convert to unsigned hex string
  return `qc_${(hash >>> 0).toString(16)}`;
}

/**
 * Cache a query result.
 */
export function cacheQuery(key: string, result: unknown, ttlMs: number = CacheTTL.AGGREGATE): void {
  queryCache.set(key, result, ttlMs);
}

/**
 * Retrieve a cached query result.
 */
export function getCachedQuery<T = unknown>(key: string): T | undefined {
  return queryCache.get(key) as T | undefined;
}

/**
 * Invalidate a specific cached query.
 */
export function invalidateQuery(key: string): boolean {
  return queryCache.delete(key);
}

/**
 * Clear all cached query results.
 */
export function clearCache(): void {
  queryCache.clear();
}

/**
 * Get cache statistics (hits, misses, size, etc.).
 */
export function cacheStats(): CacheStats {
  return queryCache.stats();
}
