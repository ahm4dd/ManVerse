import { anilistConfig } from '../config/anilist.config.js';
import { AniListRateLimitError } from '../types.js';

/**
 * Rate limiter for AniList API (90 requests per minute)
 * Implements sliding window rate limiting
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private config = {
    ...anilistConfig.rateLimit,
    maxRequests:
      getEnvNumber('ANILIST_RPM') ??
      getEnvNumber('ANILIST_RATE_LIMIT') ??
      anilistConfig.rateLimit.maxRequests,
    window:
      getEnvNumber('ANILIST_RATE_LIMIT_WINDOW_MS') ?? anilistConfig.rateLimit.window,
  };

  /**
   * Wait if necessary to comply with rate limits
   * @returns Promise that resolves when request can proceed
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than the window
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.config.window);

    // If we're at the limit, wait until oldest request expires
    if (this.timestamps.length >= this.config.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.config.window - (now - oldestTimestamp);

      if (waitTime > 0) {
        console.warn(`⏱️  Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Re-clean timestamps after waiting
      const afterWait = Date.now();
      this.timestamps = this.timestamps.filter(
        (timestamp) => afterWait - timestamp < this.config.window,
      );
    }

    // Record this request
    this.timestamps.push(Date.now());
  }

  /**
   * Get current request count in window
   */
  getRequestCount(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < this.config.window);
    return this.timestamps.length;
  }
}

function getEnvNumber(name: string): number | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}
