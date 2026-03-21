/**
 * LRU Cache
 *
 * Generic least-recently-used cache with configurable max size (bytes) and TTL.
 * Tracks hit/miss counts for observability.
 */

interface CacheEntry<T> {
  value: T;
  sizeBytes: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  entries: number;
  sizeBytes: number;
  maxSizeBytes: number;
  hitRate: number;
}

export class LRUCache<T = unknown> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSizeBytes: number;
  private defaultTtlMs: number;
  private currentSizeBytes = 0;
  private hits = 0;
  private misses = 0;

  constructor(maxSizeBytes: number = 50 * 1024 * 1024, defaultTtlMs: number = 5 * 60 * 1000) {
    this.maxSizeBytes = maxSizeBytes;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get a value from the cache. Returns undefined on miss or expiry.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to end (most recently used) by re-inserting
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * Store a value in the cache.
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    const sizeBytes = this.estimateSize(value);
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);

    // Evict expired entries first
    this.evictExpired();

    // Evict LRU entries until we have space
    while (this.currentSizeBytes + sizeBytes > this.maxSizeBytes && this.cache.size > 0) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.delete(oldestKey);
      }
    }

    this.cache.set(key, { value, sizeBytes, expiresAt });
    this.currentSizeBytes += sizeBytes;
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key from the cache.
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    this.currentSizeBytes -= entry.sizeBytes;
    this.cache.delete(key);
    return true;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Number of entries currently in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  stats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      entries: this.cache.size,
      sizeBytes: this.currentSizeBytes,
      maxSizeBytes: this.maxSizeBytes,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  /**
   * Remove all expired entries.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.currentSizeBytes -= entry.sizeBytes;
        this.cache.delete(key);
      }
    }
  }

  /**
   * Estimate the size in bytes of a value using JSON serialization.
   */
  private estimateSize(value: T): number {
    try {
      const json = JSON.stringify(value);
      // Approximate: 2 bytes per character (UTF-16)
      return json.length * 2;
    } catch {
      return 1024; // fallback estimate
    }
  }
}
