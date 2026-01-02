import { AniListClient } from '@manverse/anilist';
import type { MediaListStatus } from '@manverse/anilist';
import {
  addToLibrary,
  updateProgress as dbUpdateProgress,
  updateScore as dbUpdateScore,
  toggleFavorite as dbToggleFavorite,
  removeFromLibrary as dbRemoveFromLibrary,
  getLibraryEntryById,
  getMapping,
} from '@manverse/database';
import type { UserLibraryDb, UserLibraryInput } from '@manverse/database';

/**
 * Library Service - CRUD operations for user's manga library
 * Uses correct database API signatures
 */
export class LibraryService {
  /**
   * Add manga to library
   * Correct API: takes UserLibraryInput object (not individual params)
   */
  addMangaToLibrary(
    provider: string,
    providerMangaId: number,
    status: 'reading' | 'completed' | 'plan_to_read' | 'paused' | 'dropped' = 'plan_to_read',
    anilistId?: number,
  ): number {
    const entry: UserLibraryInput = {
      provider,
      provider_manga_id: providerMangaId,
      anilist_id: anilistId || null,
      status,
      progress: 0,
      added_at: Date.now(),
    };

    // Correct: addToLibrary takes object, returns ID
    return addToLibrary(entry);
  }

  /**
   * Update reading progress
   */
  updateProgress(libraryId: number, progress: number): void {
    dbUpdateProgress(libraryId, progress);
  }

  /**
   * Update score (1-10)
   */
  updateScore(libraryId: number, score: number): void {
    if (score < 1 || score > 10) {
      throw new Error('Score must be between 1 and 10');
    }
    dbUpdateScore(libraryId, score);
  }

  /**
   * Toggle favorite status
   */
  toggleFavorite(libraryId: number): void {
    dbToggleFavorite(libraryId);
  }

  /**
   * Remove from library
   */
  removeFromLibrary(libraryId: number): void {
    dbRemoveFromLibrary(libraryId);
  }

  /**
   * Get library entry
   */
  getEntry(libraryId: number): UserLibraryDb | null {
    return getLibraryEntryById(libraryId);
  }

  /**
   * Sync progress to AniList
   */
  async syncProgressToAniList(client: AniListClient, libraryEntry: UserLibraryDb): Promise<void> {
    if (!libraryEntry.anilist_id) {
      throw new Error('No AniList ID mapped for this manga');
    }

    // Correct: AniList client methods take mediaId and individual values
    await client.updateProgress(libraryEntry.anilist_id, libraryEntry.progress);

    // Convert local status to AniList status
    const anilistStatus = this.convertToAniListStatus(libraryEntry.status);
    await client.updateStatus(libraryEntry.anilist_id, anilistStatus);

    // Update score if present (convert 1-10 to 0-100)
    if (libraryEntry.score) {
      await client.updateScore(libraryEntry.anilist_id, libraryEntry.score * 10);
    }
  }

  /**
   * Convert local status to AniList status
   */
  private convertToAniListStatus(status: string): MediaListStatus {
    const statusMap: Record<string, MediaListStatus> = {
      reading: 'CURRENT',
      plan_to_read: 'PLANNING',
      completed: 'COMPLETED',
      dropped: 'DROPPED',
      paused: 'PAUSED',
    };

    return statusMap[status] || 'PLANNING';
  }

  /**
   * Convert AniList status to local status
   */
  convertFromAniListStatus(
    anilistStatus: string,
  ): 'reading' | 'completed' | 'plan_to_read' | 'paused' | 'dropped' {
    const statusMap: Record<
      string,
      'reading' | 'completed' | 'plan_to_read' | 'paused' | 'dropped'
    > = {
      CURRENT: 'reading',
      PLANNING: 'plan_to_read',
      COMPLETED: 'completed',
      DROPPED: 'dropped',
      PAUSED: 'paused',
    };

    return statusMap[anilistStatus] || 'plan_to_read';
  }
}

// Singleton instance
export const libraryService = new LibraryService();
