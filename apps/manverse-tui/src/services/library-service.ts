import { AniListClient } from '@manverse/anilist';
import {
  addToLibrary,
  updateProgress as dbUpdateProgress,
  updateScore as dbUpdateScore,
  toggleFavorite as dbToggleFavorite,
  removeFromLibrary as dbRemoveFromLibrary,
  getLibraryEntry,
} from '@manverse/database';
import type { UserLibraryDb } from '@manverse/database';

export class LibraryService {
  /**
   * Add manga to library
   */
  addMangaToLibrary(
    provider: string,
    providerMangaId: number,
    status: 'reading' | 'completed' | 'plan_to_read' | 'paused' | 'dropped' = 'plan_to_read',
    anilistId?: number,
  ): number {
    return addToLibrary(provider, providerMangaId, status, anilistId);
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
    return getLibraryEntry(libraryId);
  }

  /**
   * Sync progress to AniList
   */
  async syncProgressToAniList(client: AniListClient, libraryEntry: UserLibraryDb): Promise<void> {
    if (!libraryEntry.anilist_id) {
      throw new Error('No AniList ID mapped for this manga');
    }

    // Update progress
    await client.updateProgress(libraryEntry.anilist_id, libraryEntry.progress);

    // Update status
    const anilistStatus = this.convertToAniListStatus(libraryEntry.status);
    await client.updateStatus(libraryEntry.anilist_id, anilistStatus);

    // Update score if present
    if (libraryEntry.score) {
      // Convert 1-10 to 1-100
      await client.updateScore(libraryEntry.anilist_id, libraryEntry.score * 10);
    }
  }

  /**
   * Convert local status to AniList status
   */
  private convertToAniListStatus(
    status: string,
  ): 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' {
    const statusMap: Record<string, 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED'> = {
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
