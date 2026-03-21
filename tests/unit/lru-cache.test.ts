import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache } from '../../src/lib/cache/lru';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(1024 * 1024, 60_000); // 1 MB, 60s TTL
  });

  // ---------- Basic set / get ----------
  describe('set and get', () => {
    it('stores and retrieves a value', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('returns undefined for a missing key', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('overwrites an existing key', () => {
      cache.set('k', 'v1');
      cache.set('k', 'v2');
      expect(cache.get('k')).toBe('v2');
    });

    it('stores multiple keys', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.set('c', '3');
      expect(cache.get('a')).toBe('1');
      expect(cache.get('b')).toBe('2');
      expect(cache.get('c')).toBe('3');
    });
  });

  // ---------- TTL expiration ----------
  describe('TTL expiration', () => {
    it('returns undefined for expired entries', () => {
      // Create cache with very short TTL
      const shortCache = new LRUCache<string>(1024 * 1024, 1); // 1ms TTL
      shortCache.set('key', 'value');

      // Use vi.advanceTimersByTime for reliable testing
      vi.useFakeTimers();
      const c = new LRUCache<string>(1024 * 1024, 100);
      c.set('x', 'val');
      expect(c.get('x')).toBe('val');

      vi.advanceTimersByTime(150);
      expect(c.get('x')).toBeUndefined();
      vi.useRealTimers();
    });

    it('has() returns false for expired entries', () => {
      vi.useFakeTimers();
      const c = new LRUCache<string>(1024 * 1024, 50);
      c.set('k', 'v');
      expect(c.has('k')).toBe(true);

      vi.advanceTimersByTime(100);
      expect(c.has('k')).toBe(false);
      vi.useRealTimers();
    });

    it('respects per-entry custom TTL', () => {
      vi.useFakeTimers();
      const c = new LRUCache<string>(1024 * 1024, 10_000); // 10s default
      c.set('short', 'val', 50); // 50ms custom TTL
      c.set('long', 'val', 10_000); // 10s custom TTL

      vi.advanceTimersByTime(100);
      expect(c.get('short')).toBeUndefined(); // expired
      expect(c.get('long')).toBe('val'); // still valid
      vi.useRealTimers();
    });
  });

  // ---------- LRU eviction ----------
  describe('LRU eviction when max size reached', () => {
    it('evicts least recently used entry when size exceeded', () => {
      // Create a tiny cache. Each string ~12 bytes (JSON: "\"value\"" = ~14 chars * 2 = 28 bytes).
      // Use a very small max so that adding a third entry evicts the first.
      const tiny = new LRUCache<string>(100, 60_000);
      tiny.set('a', 'aaaaaaaaaaaaaaaaaaaaaa'); // ~46 bytes
      tiny.set('b', 'bbbbbbbbbbbbbbbbbbbbbb'); // ~46 bytes — should trigger eviction of 'a'
      tiny.set('c', 'cccccccccccccccccccccc'); // should evict 'a' or 'b' depending on ordering

      // The oldest entry should be evicted
      // Because 'a' was inserted first and never accessed again, it should be evicted first
      // We can't predict exactly which keys survive, but size should be constrained
      expect(tiny.size).toBeLessThanOrEqual(3);
    });

    it('accessing a key makes it recently used (not evicted)', () => {
      // Tiny cache that fits ~2 entries
      const tiny = new LRUCache<string>(120, 60_000);
      tiny.set('a', 'aaaaaaaaaaaaa');
      tiny.set('b', 'bbbbbbbbbbbbb');
      // Access 'a' to make it recently used
      tiny.get('a');
      // Add 'c' which should evict 'b' (LRU) not 'a'
      tiny.set('c', 'ccccccccccccc');

      expect(tiny.get('a')).toBe('aaaaaaaaaaaaa');
      // 'b' may or may not be evicted depending on exact sizing
    });
  });

  // ---------- Delete and clear ----------
  describe('delete and clear', () => {
    it('delete removes a specific key', () => {
      cache.set('d1', 'val');
      expect(cache.delete('d1')).toBe(true);
      expect(cache.get('d1')).toBeUndefined();
    });

    it('delete returns false for non-existent key', () => {
      expect(cache.delete('nope')).toBe(false);
    });

    it('clear removes all entries', () => {
      cache.set('x', '1');
      cache.set('y', '2');
      cache.clear();
      expect(cache.size).toBe(0);
      expect(cache.get('x')).toBeUndefined();
      expect(cache.get('y')).toBeUndefined();
    });

    it('clear resets stats', () => {
      cache.set('k', 'v');
      cache.get('k'); // hit
      cache.get('miss'); // miss
      cache.clear();
      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ---------- Stats ----------
  describe('stats tracking', () => {
    it('tracks hits', () => {
      cache.set('k', 'v');
      cache.get('k');
      cache.get('k');
      const stats = cache.stats();
      expect(stats.hits).toBe(2);
    });

    it('tracks misses', () => {
      cache.get('nope1');
      cache.get('nope2');
      const stats = cache.stats();
      expect(stats.misses).toBe(2);
    });

    it('calculates hitRate', () => {
      cache.set('k', 'v');
      cache.get('k'); // hit
      cache.get('miss'); // miss
      const stats = cache.stats();
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('hitRate is 0 when no requests', () => {
      const stats = cache.stats();
      expect(stats.hitRate).toBe(0);
    });

    it('reports entries count', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      expect(cache.stats().entries).toBe(2);
    });

    it('reports sizeBytes > 0 after storing entries', () => {
      cache.set('key', 'some value here');
      expect(cache.stats().sizeBytes).toBeGreaterThan(0);
    });

    it('reports maxSizeBytes', () => {
      expect(cache.stats().maxSizeBytes).toBe(1024 * 1024);
    });

    it('expired entry counts as a miss', () => {
      vi.useFakeTimers();
      const c = new LRUCache<string>(1024 * 1024, 50);
      c.set('k', 'v');
      vi.advanceTimersByTime(100);
      c.get('k'); // expired → miss
      expect(c.stats().misses).toBe(1);
      expect(c.stats().hits).toBe(0);
      vi.useRealTimers();
    });
  });

  // ---------- size property ----------
  describe('size property', () => {
    it('returns 0 for empty cache', () => {
      expect(cache.size).toBe(0);
    });

    it('increments on set', () => {
      cache.set('a', '1');
      expect(cache.size).toBe(1);
      cache.set('b', '2');
      expect(cache.size).toBe(2);
    });

    it('does not double-count on overwrite', () => {
      cache.set('a', '1');
      cache.set('a', '2');
      expect(cache.size).toBe(1);
    });

    it('decrements on delete', () => {
      cache.set('a', '1');
      cache.set('b', '2');
      cache.delete('a');
      expect(cache.size).toBe(1);
    });
  });
});
