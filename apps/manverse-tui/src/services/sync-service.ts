import { AniListClient } from '@manverse/anilist';
import {
  getNeedsSyncList,
  getSyncState,
  recordLocalUpdate,
  recordAnilistUpdate,
  getMapping,
  getLibraryEntry,
  updateProgress,
} from '@manverse/database';
import type { AniListSyncStateDb, UserLibraryDb } from '@manverse/database';
import { libraryService } from './library-service.js';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ anilistId: number; error: string }>;
}

export class SyncService {
  /**
   * Get list of manga that need syncing
   */
  getNeedsSyncList(): AniListSyncStateDb[] {
    return getNeedsSyncList();
  }

  /**
   * Sync single manga to AniList (push local changes)
   */
  async syncToAniList(
    client: AniListClient,
    anilistId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get sync state
      const syncState = getSyncState(anilistId);
      if (!syncState) {
        return { success: false, error: 'No sync state found' };
      }

      // Get mapping to find library entry
      const mapping = getMapping(anilistId);
      if (!mapping) {
        return { success: false, error: 'No mapping found' };
      }

      // Get library entry
      const libraryEntry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
      if (!libraryEntry) {
        return { success: false, error: 'Library entry not found' };
      }

      // Sync to AniList
      await libraryService.syncProgressToAniList(client, libraryEntry);

      // Record sync
      recordAnilistUpdate(anilistId, 'progress', libraryEntry.progress);
      recordAnilistUpdate(anilistId, 'status', libraryEntry.status);
      if (libraryEntry.score) {
        recordAnilistUpdate(anilistId, 'score', libraryEntry.score);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync from AniList (pull remote changes)
   */
  async syncFromAniList(
    client: AniListClient,
    anilistId: number,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get AniList entry
      const anilistEntry = await client.getUserMangaEntry(anilistId);
      if (!anilistEntry) {
        return { success: false, error: 'AniList entry not found' };
      }

      // Get mapping
      const mapping = getMapping(anilistId);
      if (!mapping) {
        return { success: false, error: 'No mapping found' };
      }

      // Update local library
      const libraryEntry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
      if (libraryEntry) {
        // Update progress
        updateProgress(libraryEntry.id, anilistEntry.progress || 0);

        // Record the sync
        recordLocalUpdate(anilistId, 'progress', anilistEntry.progress || 0);
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sync all pending manga
   */
  async syncAll(
    client: AniListClient,
    direction: 'push' | 'pull' | 'both' = 'push',
  ): Promise<SyncResult> {
    const needsSync = this.getNeedsSyncList();
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    for (const syncState of needsSync) {
      try {
        if (direction === 'push' || direction === 'both') {
          const pushResult = await this.syncToAniList(client, syncState.anilist_id);
          if (pushResult.success) {
            result.synced++;
          } else {
            result.failed++;
            result.errors.push({
              anilistId: syncState.anilist_id,
              error: pushResult.error || 'Unknown error',
            });
          }
        }

        if (direction === 'pull' || direction === 'both') {
          const pullResult = await this.syncFromAniList(client, syncState.anilist_id);
          if (!pullResult.success) {
            result.failed++;
            result.errors.push({
              anilistId: syncState.anilist_id,
              error: pullResult.error || 'Unknown error',
            });
          }
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          anilistId: syncState.anilist_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Resolve sync conflict - choose which version to keep
   */
  async resolveConflict(
    client: AniListClient,
    anilistId: number,
    resolution: 'keep-local' | 'keep-remote' | 'manual',
    manualValues?: Partial<UserLibraryDb>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (resolution === 'manual' && manualValues) {
        // Apply manual values
        const mapping = getMapping(anilistId);
        if (!mapping) {
          return { success: false, error: 'No mapping found' };
        }

        const libraryEntry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
        if (!libraryEntry) {
          return { success: false, error: 'Library entry not found' };
        }

        // Update local with manual values
        if (manualValues.progress !== undefined) {
          updateProgress(libraryEntry.id, manualValues.progress);
        }

        // Sync to AniList
        await this.syncToAniList(client, anilistId);
      } else if (resolution === 'keep-local') {
        await this.syncToAniList(client, anilistId);
      } else if (resolution === 'keep-remote') {
        await this.syncFromAniList(client, anilistId);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Singleton instance
export const syncService = new SyncService();
