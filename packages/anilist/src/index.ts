/**
 * @manverse/anilist - AniList API integration for ManVerse
 *
 * Provides OAuth authentication, manga search, user list management,
 * and favorites functionality.
 *
 * @example
 * ```typescript
 * import { AniListClient } from '@manverse/anilist'.js'
 *
 * // Guest mode (search only)
 * const client = AniListClient.create()
 * const results = await client.searchManga('Solo Leveling')
 *
 * // Authenticated mode
 * const authClient = AniListClient.create({
 *   clientId: process.env.ANILIST_CLIENT_ID,
 *   clientSecret: process.env.ANILIST_CLIENT_SECRET,
 * })
 * await authClient.authenticate()
 * const user = await authClient.getCurrentUser()
 * ```
 */

export { AniListClient, type IAniListClient } from './client.js';
export { AniListAuth, type AuthOptions } from './auth.js';
export * from './types.js';
export { anilistConfig } from './config/anilist.config.js';
