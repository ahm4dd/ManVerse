import type { AniListClient } from '@manverse/anilist';
import {
  getNeedsSyncList,
  getSyncState,
  updateSyncState,
  clearSyncFlag,
  recordAnilistUpdate,
  recordLocalUpdate,
} from '../operations/sync.js';
import { getLibraryEntry } from '../operations/library.js';
import { getAnilistManga } from '../operations/anilist.js';
import { getMapping } from '../operations/mapping.js';

/**
 * Progress Sync Service
 * Handles bidirectional sync between local library and AniList
 */
export class ProgressSyncService {
  constructor(
    private anilistClient: AniListClient,
    private userId: number,
  ) {}

  /**
   * Push local progress to AniList
   * Updates AniList with user's local reading progress
   */
  async pushProgress(anilistId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const syncState = getSyncState(anilistId);
      
      if (!syncState) {
        return { success: false, error: 'No sync state found' };
      }

      // Find library entry
      const anilistManga = getAnilistManga(anilistId);
      if (!anilistManga) {
        return { success: false, error: 'AniList manga not cached' };
      }

      // Get all mappings to find library entry
      const mappings = []; // Would need to get from getAllMappings
      let libraryEntry = null;
      
      for (const mapping of mappings) {
        const entry = getLibraryEntry(mapping.provider, mapping.provider_manga_id);
        if (entry) {
          libraryEntry = entry;
          break;
        }
      }

      if (!libraryEntry) {
        return { success: false, error: 'No library entry found' };
      }

      // Convert local status to AniList status
      const anilistStatus = this.convertToAniListStatus(libraryEntry.status);

      // Update AniList
      await this.anilistClient.updateMangaList({
        mediaId: anilistId,
        status: anilistStatus,
        progress: libraryEntry.progress,
        score: libraryEntry.score ? Math.round(libraryEntry.score * 10) : undefined,
      });

      // Update sync state
      updateSyncState(anilistId, {
        local_progress: libraryEntry.progress,
        anilist_progress: libraryEntry.progress,
        local_status: libraryEntry.status,
        anilist_status: anilistStatus,
        local_score: libraryEntry.score,
        anilist_score: libraryEntry.score,
        last_synced: Date.now(),
        needs_sync: 0,
        sync_direction: null,
      });

      clearSyncFlag(anilistId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Pull progress from AniList to local
   * Updates local library with AniList progress
   */
  async pullProgress(anilistId: number): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Fetch from AniList
      const anilistEntry = await this.anilistClient.getUserList(this.userId);
      
      // Find the specific entry (simplified - would need proper filtering)
      const entry = anilistEntry.lists
        ?.flatMap(list => list.entries)
        .find(e => e.media?.id === anilistId);

      if (!entry || !entry.media) {
        return { success: false, error: 'Not in AniList library' };
      }

      // Record AniList update (this will update library via app logic)
      recordAnilistUpdate(
        anilistId,
        entry.progress || 0,
        this.convertFromAniListStatus(entry.status),
        entry.score ? entry.score / 10 : undefined,
      );

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync all pending items
   * Handles push, pull, and conflicts
   */
  async syncAll(strategy: 'prefer-local' | 'prefer-remote' = 'prefer-local'): Promise<{
    pushed: number;
    pulled: number;
    conflicts: number;
    errors: Array<{ anilistId: number; error: string }>;
  }> {
    const needsSync = getNeedsSyncList();
    
    let pushed = 0;
    let pulled = 0;
    let conflicts = 0;
    const errors: Array<{ anilistId: number; error: string }> = [];

    for (const state of needsSync) {
      try {
        if (state.sync_direction === 'push') {
          const result = await this.pushProgress(state.anilist_id);
          if (result.success) {
            pushed++;
          } else {
            errors.push({ anilistId: state.anilist_id, error: result.error || 'Push failed' });
          }
        } else if (state.sync_direction === 'pull') {
          const result = await this.pullProgress(state.anilist_id);
          if (result.success) {
            pulled++;
          } else {
            errors.push({ anilistId: state.anilist_id, error: result.error || 'Pull failed' });
          }
        } else if (state.sync_direction === 'conflict') {
          conflicts++;
          
          // Resolve based on strategy
          if (strategy === 'prefer-local') {
            const result = await this.pushProgress(state.anilist_id);
            if (result.success) pushed++;
            else errors.push({ anilistId: state.anilist_id, error: result.error || 'Conflict resolution failed' });
          } else {
            const result = await this.pullProgress(state.anilist_id);
            if (result.success) pulled++;
            else errors.push({ anilistId: state.anilist_id, error: result.error || 'Conflict resolution failed' });
          }
        }
      } catch (error) {
        errors.push({
          anilistId: state.anilist_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { pushed, pulled, conflicts, errors };
  }

  /**
   * Get sync status summary
   */
  getSyncStatus(): {
    totalNeedsSync: number;
    needsPush: number;
    needsPull: number;
    conflicts: number;
  } {
    const needsSync = getNeedsSyncList();

    return {
      totalNeedsSync: needsSync.length,
      needsPush: needsSync.filter(s => s.sync_direction === 'push').length,
      needsPull: needsSync.filter(s => s.sync_direction === 'pull').length,
      conflicts: needsSync.filter(s => s.sync_direction === 'conflict').length,
    };
  }

  /**
   * Convert local status to AniList status
   */
  private convert ToAniListStatus(localStatus: string): string {
    const mapping: Record<string, string> = {
      'reading': 'CURRENT',
      'completed': 'COMPLETED',
      'plan_to_read': 'PLANNING',
      'paused': 'PAUSED',
      'dropped': 'DROPPED',
    };

    return mapping[localStatus] || 'CURRENT';
  }

  /**
   * Convert AniList status to local status
   */
  private convertFromAniListStatus(anilistStatus: string): string {
    const mapping: Record<string, string> = {
      'CURRENT': 'reading',
      'COMPLETED': 'completed',
      'PLANNING': 'plan_to_read',
      'PAUSED': 'paused',
      'DROPPED': 'dropped',
    };

    return mapping[anilistStatus] || 'reading';
  }
}
