import { anilistConfig } from '../config/anilist.config.js';

/**
 * Retry failed requests with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  },
): Promise<T> {
  const config = {
    ...anilistConfig.retry,
    ...options,
  };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on auth errors or client errors (4xx except 429)
      if (error instanceof Error && error.name === 'AniListAuthError') {
        throw error;
      }

      if (attempt === config.maxAttempts) {
        break; // Exit loop, will throw below
      }

      // Calculate backoff delay
      const delay = Math.min(
        config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelay,
      );

      console.warn(
        `⚠️  Request failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
