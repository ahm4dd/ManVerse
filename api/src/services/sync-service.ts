import type { MediaListStatus } from '@manverse/anilist';
import type { AuthUser } from '../../../shared/types.ts';
import {
  deleteLibraryEntry,
  getLibraryEntry,
  listSyncStates,
  upsertAnilistManga,
  upsertLibraryEntry,
  upsertSyncState,
} from '@manverse/database';
import { AniListService } from './anilist-service.ts';
import { mapMediaToDb, toUnixDate } from './library-mapper.ts';

export class SyncService {
  constructor(private anilist = new AniListService()) {}

  getStatus(userKey: string) {
    const pending = listSyncStates(userKey, { needsSync: true });
    return {
      pending: pending.length,
      items: pending,
    };
  }

  async syncAll(userKey: string, auth?: AuthUser) {
    const pending = listSyncStates(userKey, { needsSync: true });
    if (!auth?.anilistToken || auth.id === null || auth.id === undefined) {
      return {
        attempted: pending.length,
        synced: 0,
        failed: 0,
        skipped: pending.length,
      };
    }

    const removals = pending.filter((state) => state.local_status == null);
    const remoteEntryMap = new Map<number, number>();

    if (removals.length > 0) {
      const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
      for (const list of collection.lists) {
        for (const entry of list.entries) {
          remoteEntryMap.set(entry.mediaId, entry.id);
        }
      }
    }

    let synced = 0;
    let failed = 0;

    for (const state of pending) {
      const mediaId = state.anilist_id;
      const local = getLibraryEntry(userKey, mediaId);

      if (!local) {
        const entryId = remoteEntryMap.get(mediaId);
        if (entryId) {
          try {
            await this.anilist.removeFromList(auth.anilistToken, entryId);
          } catch {
            failed += 1;
            upsertSyncState({
              user_id: userKey,
              anilist_id: mediaId,
              local_status: null,
              local_progress: null,
              local_score: null,
              needs_sync: 1,
            });
            continue;
          }
        }

        upsertSyncState({
          user_id: userKey,
          anilist_id: mediaId,
          local_status: null,
          local_progress: null,
          local_score: null,
          anilist_status: null,
          anilist_progress: null,
          anilist_score: null,
          needs_sync: 0,
        });
        synced += 1;
        continue;
      }

      try {
        const remote = await this.anilist.updateEntry(auth.anilistToken, {
          mediaId,
          status: local.status as MediaListStatus,
          progress: local.progress ?? 0,
          score: local.score ?? undefined,
          notes: local.notes ?? undefined,
        });

        upsertLibraryEntry({
          user_id: userKey,
          anilist_id: mediaId,
          provider: local.provider ?? null,
          provider_manga_id: local.provider_manga_id ?? null,
          status: local.status,
          progress: local.progress ?? 0,
          score: local.score ?? null,
          notes: local.notes ?? null,
          anilist_entry_id: remote.id,
        });

        upsertSyncState({
          user_id: userKey,
          anilist_id: mediaId,
          local_status: local.status,
          local_progress: local.progress ?? 0,
          local_score: local.score ?? null,
          anilist_status: remote.status,
          anilist_progress: remote.progress ?? 0,
          anilist_score: remote.score ?? null,
          needs_sync: 0,
        });
        synced += 1;
      } catch {
        failed += 1;
        upsertSyncState({
          user_id: userKey,
          anilist_id: mediaId,
          local_status: local.status,
          local_progress: local.progress ?? 0,
          local_score: local.score ?? null,
          needs_sync: 1,
        });
      }
    }

    return {
      attempted: pending.length,
      synced,
      failed,
      skipped: 0,
    };
  }

  async pushOne(userKey: string, mediaId: number, auth?: AuthUser) {
    if (!auth?.anilistToken || auth.id === null || auth.id === undefined) {
      return { synced: false, reason: 'AUTH_REQUIRED' };
    }

    const local = getLibraryEntry(userKey, mediaId);
    if (!local) {
      const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
      const entryId = collection.lists
        .flatMap((list) => list.entries)
        .find((entry) => entry.mediaId === mediaId)?.id;

      if (entryId) {
        await this.anilist.removeFromList(auth.anilistToken, entryId);
      }

      upsertSyncState({
        user_id: userKey,
        anilist_id: mediaId,
        local_status: null,
        local_progress: null,
        local_score: null,
        anilist_status: null,
        anilist_progress: null,
        anilist_score: null,
        needs_sync: 0,
      });

      return { synced: true, removed: true };
    }

    const remote = await this.anilist.updateEntry(auth.anilistToken, {
      mediaId,
      status: local.status as MediaListStatus,
      progress: local.progress ?? 0,
      score: local.score ?? undefined,
      notes: local.notes ?? undefined,
    });

    upsertLibraryEntry({
      user_id: userKey,
      anilist_id: mediaId,
      provider: local.provider ?? null,
      provider_manga_id: local.provider_manga_id ?? null,
      status: local.status,
      progress: local.progress ?? 0,
      score: local.score ?? null,
      notes: local.notes ?? null,
      anilist_entry_id: remote.id,
    });

    upsertSyncState({
      user_id: userKey,
      anilist_id: mediaId,
      local_status: local.status,
      local_progress: local.progress ?? 0,
      local_score: local.score ?? null,
      anilist_status: remote.status,
      anilist_progress: remote.progress ?? 0,
      anilist_score: remote.score ?? null,
      needs_sync: 0,
    });

    return { synced: true };
  }

  async pullOne(userKey: string, mediaId: number, auth?: AuthUser) {
    if (!auth?.anilistToken) {
      return { synced: false, reason: 'AUTH_REQUIRED' };
    }

    const media = await this.anilist.getMangaDetailsForUser(auth.anilistToken, mediaId);
    if (!media?.mediaListEntry) {
      deleteLibraryEntry(userKey, mediaId);
      upsertSyncState({
        user_id: userKey,
        anilist_id: mediaId,
        local_status: null,
        local_progress: null,
        local_score: null,
        anilist_status: null,
        anilist_progress: null,
        anilist_score: null,
        needs_sync: 0,
      });
      return { synced: true, removed: true };
    }

    upsertAnilistManga(mapMediaToDb(media));
    const entry = media.mediaListEntry;

    upsertLibraryEntry({
      user_id: userKey,
      anilist_id: mediaId,
      status: entry.status,
      progress: entry.progress ?? 0,
      score: entry.score ?? null,
      notes: entry.notes ?? null,
      started_at: toUnixDate(entry.startedAt),
      completed_at: toUnixDate(entry.completedAt),
      anilist_entry_id: entry.id,
    });

    upsertSyncState({
      user_id: userKey,
      anilist_id: mediaId,
      local_status: entry.status,
      local_progress: entry.progress ?? 0,
      local_score: entry.score ?? null,
      anilist_status: entry.status,
      anilist_progress: entry.progress ?? 0,
      anilist_score: entry.score ?? null,
      needs_sync: 0,
    });

    return { synced: true };
  }
}
