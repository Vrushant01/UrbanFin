interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
  createdAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  size: number;
  maxCapacity: number;
}

class LRUMemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();
  private maxCapacity: number;
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private evictions = 0;

  constructor(maxCapacity: number = 3000) {
    this.maxCapacity = maxCapacity;
  }

  /**
   * Get a cached value by key.
   * Promotes the entry to most recently used (MRU).
   * Returns undefined if key doesn't exist or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses++;
      return undefined;
    }

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order (delete & re-insert)
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a key-value pair in cache with optional TTL in seconds.
   * Evicts the least recently used item if capacity is reached.
   * Default TTL: 60 seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxCapacity) {
      // Evict least recently used (first item in Map iteration order)
      const lruKey = this.store.keys().next().value;
      if (lruKey !== undefined) {
        this.store.delete(lruKey);
        this.evictions++;
      }
    }

    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt, createdAt: Date.now() });
    this.sets++;
  }

  /**
   * Invalidate specific key or all keys starting with a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
    }
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Wrap an async operation with caching.
   * If cache hit, returns cached value immediately.
   * If cache miss, executes fetcher, caches result, and returns.
   */
  async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }
    const fresh = await fetcher();
    this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get total number of stored entries.
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Get current cache performance statistics.
   */
  getStats(): CacheStats {
    return {
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      evictions: this.evictions,
      size: this.store.size,
      maxCapacity: this.maxCapacity,
    };
  }
}

export const cache = new LRUMemoryCache(3000);

