type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
};

export class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.value !== undefined && entry.expiresAt > Date.now()) {
      return entry.value;
    }
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
    return null;
  }

  delete(key: string) {
    this.store.delete(key);
  }

  async getOrLoad<T>(
    key: string,
    ttlMs: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (ttlMs <= 0) {
      return loader();
    }

    const now = Date.now();
    const existing = this.store.get(key) as CacheEntry<T> | undefined;
    if (existing?.value !== undefined && existing.expiresAt > now) {
      return existing.value;
    }
    if (existing?.inFlight) {
      return existing.inFlight;
    }

    const inFlight = loader()
      .then((value) => {
        this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
      })
      .catch((error) => {
        this.store.delete(key);
        throw error;
      });

    this.store.set(key, { inFlight, expiresAt: now + ttlMs });
    return inFlight;
  }
}
