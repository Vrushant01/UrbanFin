interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

class MemoryCache {
  private store: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Get a cached value by key.
   * Returns undefined if key doesn't exist or has expired.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set a key-value pair in cache with optional TTL in seconds.
   * Default TTL: 60 seconds.
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Invalidate specific keys or keys starting with a prefix.
   */
  invalidate(keyOrPrefix: string): void {
    if (this.store.has(keyOrPrefix)) {
      this.store.delete(keyOrPrefix);
    }
    // Also delete any matching prefix keys
    for (const key of this.store.keys()) {
      if (key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
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
}

export const cache = new MemoryCache();
