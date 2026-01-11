import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class ScraperCache {
  private cacheDir: string;

  constructor(private namespace: string) {
    // Store cache in a user-writable location (AppImage resources are read-only).
    const baseDir =
      process.env.XDG_CACHE_HOME ||
      process.env.APPDATA ||
      path.join(os.homedir(), '.cache');
    this.cacheDir = path.join(baseDir, 'manverse', this.namespace);
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch {
      // Fall back to a temp directory if the cache dir cannot be created.
      this.cacheDir = path.join(os.tmpdir(), 'manverse', this.namespace);
      try {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
      } catch {
        // Ignore failures; cache writes will fail gracefully.
      }
    }
  }

  /**
   * Generates a safe filename from a key
   */
  private getKeyPath(key: string): string {
    const hash = createHash('md5').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  /**
   * Retrieve item from cache
   */
  get<T>(key: string): T | null {
    const filePath = this.getKeyPath(key);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      if (Date.now() - entry.timestamp > entry.ttl) {
        // Expired
        fs.unlinkSync(filePath);
        return null;
      }

      return entry.data;
    } catch {
      // Invalid cache file
      return null;
    }
  }

  /**
   * Save item to cache
   * @param ttl Default 1 hour (3600000ms)
   */
  set<T>(key: string, data: T, ttl: number = 60 * 60 * 1000): void {
    const filePath = this.getKeyPath(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    try {
      fs.writeFileSync(filePath, JSON.stringify(entry));
    } catch (e) {
      console.warn('Failed to write to cache:', e);
    }
  }

  /**
   * Helper to wrap an async function with caching
   */
  async wrap<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached) {
      return cached;
    }

    const data = await fetcher();
    this.set(key, data, ttl);
    return data;
  }
}
