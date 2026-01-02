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
import type { AniListSyncStateDb } from '@manverse/database';
import { libraryService } from './library-service.js';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ anilistId: number; error: string }>;
}

/**
 * Sync Service - Bidirectional AniList sync
 * CORRECT APIs: recordLocalUpdate(id, progress, status?, score?)
 */
export class SyncService {
  getNeedsSyncList(): AniListSyncStateDb[] {
    return getNeedsSyncList();
  }

  async syncToAniList(
    client: AniListClient,
    anilistId: number,
    provider: string = 'asura',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const syncState = getSyncState(anilistId);
      if (!syncState) {
        return { success: false, error: 'No sync state found' };
      }

      const mapping = getMapping(anilistId, provider);
      if (!mapping) {
        return { success: false, error: 'No mapping found' };
      }

      const libraryEntry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
      if (!libraryEntry) {
        return { success: false, error: 'Library entry not found' };
      }

      await libraryService.syncProgressToAniList(client, libraryEntry);

      // CORRECT: recordAnilistUpdate(anilistId, progress, status?, score?)
      recordAnilistUpdate(
        anilistId,
        libraryEntry.progress,
        libraryEntry.status,
        libraryEntry.score || undefined,
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async syncFromAniList(
    client: AniListClient,
    anilistId: number,
    provider: string = 'asura',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const anilistDetails = await client.getMangaDetails(anilistId);
      const user = await client.getCurrentUser();
      const userList = await client.getUserMangaList(user.id);

      // FIXED: Added optional chaining for media
      const listEntry = userList.find((entry) => entry.media?.id === anilistId);

      if (!listEntry) {
        return { success: false, error: 'Not in user list on AniList' };
      }

      const mapping = getMapping(anilistId, provider);
      if (!mapping) {
        return { success: false, error: 'No mapping found' };
      }

      const libraryEntry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
      if (libraryEntry) {
        updateProgress(libraryEntry.id, listEntry.progress || 0);

        // CORRECT: recordLocalUpdate(anilistId, progress, status?, score?)
        recordLocalUpdate(
          anilistId,
          listEntry.progress || 0,
          listEntry.status || undefined,
          listEntry.score || undefined,
        );
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

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

  async resolveConflict(
    client: AniListClient,
    anilistId: number,
    resolution: 'keep-local' | 'keep-remote',
    provider: string = 'asura',
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (resolution === 'keep-local') {
        return await this.syncToAniList(client, anilistId, provider);
      } else {
        return await this.syncFromAniList(client, anilistId, provider);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const syncService = new SyncService();
