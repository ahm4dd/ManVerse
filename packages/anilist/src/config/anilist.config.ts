/**
 * AniList API configuration
 * Follows ManVerse configuration-driven pattern
 */

export const anilistConfig = {
  name: 'AniList',
  apiUrl: 'https://graphql.anilist.co',
  authUrl: 'https://anilist.co/api/v2/oauth',

  // OAuth settings
  oauth: {
    authorizeUrl: 'https://anilist.co/api/v2/oauth/authorize',
    tokenUrl: 'https://anilist.co/api/v2/oauth/token',
    redirectUri: 'http://localhost:8888/callback', // Local callback server
    scope: '', // AniList doesn't use scopes, token has full access
  },

  // Rate limiting (90 requests per minute)
  rateLimit: {
    maxRequests: 90,
    window: 60000, // 1 minute in ms
  },

  // Retry settings
  retry: {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000, // 10 seconds
    backoffMultiplier: 2,
  },

  // Caching TTLs (in seconds)
  cache: {
    token: 31536000, // 1 year (AniList tokens don't expire)
    userLists: 300, // 5 minutes
    mediaDetails: 3600, // 1 hour
    searchResults: 900, // 15 minutes
  },

  // Default query options
  defaults: {
    searchPerPage: 20,
    searchSort: ['SEARCH_MATCH'] as const,
  },
} as const;

export type AniListConfig = typeof anilistConfig;
