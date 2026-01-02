/**
 * Cache configuration for ManVerse
 * Defines TTL (time-to-live) for different data types
 */

export const cacheConfig = {
  anilist: {
    // Completed manga change rarely (24 hours)
    completedTTL: 24 * 60 * 60 * 1000,
    // Ongoing manga update frequently (1 hour)
    ongoingTTL: 60 * 60 * 1000,
    // User lists (30 minutes - check for new additions)
    userListTTL: 30 * 60 * 1000,
  },
  provider: {
    // Provider manga metadata (1 hour)
    mangaDetailsTTL: 60 * 60 * 1000,
    // Chapter lists (30 minutes - new chapters appear)
    chapterListTTL: 30 * 60 * 1000,
  },
  scraper: {
    // Search results (1 hour - already implemented in ScraperCache)
    searchTTL: 60 * 60 * 1000,
  },
} as const;

/**
 * Get appropriate TTL for AniList manga based on status
 */
export function getAnilistTTL(status: string): number {
  const normalized = status.toUpperCase();

  if (normalized === 'FINISHED' || normalized === 'CANCELLED') {
    return cacheConfig.anilist.completedTTL;
  }

  return cacheConfig.anilist.ongoingTTL;
}
