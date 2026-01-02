import { createMapping, getMapping, getAllMappings, saveProviderManga } from '@manverse/database';
import type { ProviderMangaInput } from '@manverse/database';

/**
 * Mapping Service - Manage AniList-to-provider mappings
 * Uses correct database API signatures
 */
export class MappingService {
  /**
   * Create a mapping between AniList manga and provider manga
   * Correct API: createMapping(anilistId, provider, providerMangaId, confidence?)
   */
  createMapping(
    anilistId: number,
    provider: string,
    providerMangaId: number,
    confidence: 'manual' | 'auto-high' | 'auto-low' = 'manual',
  ): void {
    // Correct: 3-4 args (not 5!)
    createMapping(anilistId, provider, providerMangaId, confidence);
  }

  /**
   * Get mapping for a specific provider
   * Correct API: getMapping(anilistId, provider) - takes 2 args!
   */
  getMapping(anilistId: number, provider: string) {
    return getMapping(anilistId, provider);
  }

  /**
   * Get all mappings for an AniList manga
   */
  getAllMappings(anilistId: number) {
    return getAllMappings(anilistId);
  }

  /**
   * Save provider manga details
   */
  saveProviderManga(manga: ProviderMangaInput): number {
    return saveProviderManga(manga);
  }

  /**
   * Parse provider URL to extract provider and manga ID
   */
  parseProviderUrl(url: string): {
    provider: string;
    mangaId: string;
    isValid: boolean;
  } | null {
    // AsuraScans pattern (no need to escape forward slashes in regex)
    const asuraMatch = url.match(/asuracomic\.net\/series\/([^/]+)/i);
    if (asuraMatch) {
      return {
        provider: 'asura',
        mangaId: asuraMatch[1],
        isValid: true,
      };
    }

    // Reaper Scans pattern
    const reaperMatch = url.match(/reaperscans\.com\/series\/([^/]+)/i);
    if (reaperMatch) {
      return {
        provider: 'reaper',
        mangaId: reaperMatch[1],
        isValid: true,
      };
    }

    // Flame Scans pattern
    const flameMatch = url.match(/flamescans\.org\/series\/([^/]+)/i);
    if (flameMatch) {
      return {
        provider: 'flame',
        mangaId: flameMatch[1],
        isValid: true,
      };
    }

    return null;
  }

  /**
   * Validate provider URL
   */
  isValidProviderUrl(url: string): boolean {
    const parsed = this.parseProviderUrl(url);
    return parsed !== null && parsed.isValid;
  }
}

// Singleton instance
export const mappingService = new MappingService();
