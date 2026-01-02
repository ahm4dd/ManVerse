import { createMapping, getMappings, getMapping, saveProviderManga } from '@manverse/database';
import type { ProviderMangaInput } from '@manverse/database';

export class MappingService {
  /**
   * Create a mapping between AniList manga and provider manga
   */
  createMapping(
    anilistId: number,
    provider: string,
    providerMangaId: number,
    providerUrl: string,
    confidence: 'manual' | 'auto-high' | 'auto-low' = 'manual',
  ): number {
    return createMapping(anilistId, provider, providerMangaId, providerUrl, confidence);
  }

  /**
   * Get all mappings for an AniList manga
   */
  getMappings(anilistId: number) {
    return getMappings(anilistId);
  }

  /**
   * Get single mapping
   */
  getMapping(anilistId: number) {
    return getMapping(anilistId);
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
    // AsuraScans pattern
    const asuraMatch = url.match(/asuracomic\.net\/series\/([^\/]+)/i);
    if (asuraMatch) {
      return {
        provider: 'asura',
        mangaId: asuraMatch[1],
        isValid: true,
      };
    }

    // Reaper Scans pattern
    const reaperMatch = url.match(/reaperscans\.com\/series\/([^\/]+)/i);
    if (reaperMatch) {
      return {
        provider: 'reaper',
        mangaId: reaperMatch[1],
        isValid: true,
      };
    }

    // Flame Scans pattern
    const flameMatch = url.match(/flamescans\.org\/series\/([^\/]+)/i);
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
