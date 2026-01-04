import type { AniListUserStats, MediaListCollection, MediaListStatus, MediaListEntry } from '@manverse/anilist';
import type { AuthUser } from '../../../shared/types.ts';
import {
  countLibraryEntries,
  deleteLibraryEntry,
  getAnilistMangaById,
  getLibraryEntry,
  listLibraryEntries,
  upsertAnilistManga,
  upsertLibraryEntry,
  upsertSyncState,
  type AnilistMangaRecord,
} from '@manverse/database';
import { AniListService } from './anilist-service.ts';
import { mapMediaToDb, toUnixDate } from './library-mapper.ts';

const STATUS_LABELS: Record<string, string> = {
  CURRENT: 'Current',
  PLANNING: 'Planning',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
  DROPPED: 'Dropped',
  REPEATING: 'Repeating',
};

function parseGenres(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }
}

function isStubAnilistRecord(record: AnilistMangaRecord | null): boolean {
  if (!record) return true;
  const hasText =
    Boolean(record.title_english) ||
    Boolean(record.title_native) ||
    Boolean(record.description) ||
    Boolean(record.banner_image) ||
    Boolean(record.cover_large) ||
    Boolean(record.cover_medium) ||
    Boolean(record.status) ||
    Boolean(record.format) ||
    Boolean(record.country_of_origin);
  const hasNumbers =
    record.chapters !== null ||
    record.volumes !== null ||
    record.average_score !== null ||
    record.popularity !== null ||
    record.favourites !== null ||
    record.updated_at !== null;
  const hasGenres = Boolean(record.genres && record.genres.trim().length > 0);

  return !hasText && !hasNumbers && !hasGenres;
}

function mapEntryToMediaList(entry: ReturnType<typeof listLibraryEntries>[number]): MediaListEntry | null {
  if (!entry.media || !entry.entry.anilist_id) return null;
  const media = entry.media;
  return {
    id: entry.entry.id,
    mediaId: entry.entry.anilist_id,
    status: entry.entry.status as MediaListStatus,
    score: entry.entry.score ?? null,
    progress: Math.floor(entry.entry.progress ?? 0),
    progressVolumes: null,
    repeat: 0,
    priority: null,
    notes: entry.entry.notes ?? null,
    startedAt: { year: null, month: null, day: null },
    completedAt: { year: null, month: null, day: null },
    updatedAt: entry.entry.updated_at ?? undefined,
    createdAt: entry.entry.created_at ?? undefined,
    media: {
      id: media.id,
      title: {
        romaji: media.title_romaji,
        english: media.title_english ?? null,
        native: media.title_native ?? null,
      },
      description: media.description ?? null,
      coverImage: {
        extraLarge: media.cover_large ?? undefined,
        large: media.cover_medium ?? undefined,
      },
      bannerImage: media.banner_image ?? undefined,
      status: media.status ?? undefined,
      format: media.format ?? undefined,
      chapters: media.chapters ?? undefined,
      volumes: media.volumes ?? undefined,
      genres: parseGenres(media.genres),
      averageScore: media.average_score ?? undefined,
      popularity: media.popularity ?? undefined,
      favourites: media.favourites ?? undefined,
      updatedAt: media.updated_at ?? undefined,
      countryOfOrigin: media.country_of_origin ?? undefined,
      siteUrl: `https://anilist.co/manga/${media.id}`,
      startDate: undefined,
      endDate: undefined,
    },
  };
}

function storeCollection(userKey: string, collection: MediaListCollection) {
  for (const list of collection.lists) {
    for (const entry of list.entries) {
      if (!entry.media) continue;
      upsertAnilistManga(mapMediaToDb(entry.media));
      upsertLibraryEntry({
        user_id: userKey,
        anilist_id: entry.media.id,
        status: entry.status,
        progress: entry.progress ?? 0,
        score: entry.score ?? null,
        notes: entry.notes ?? null,
        started_at: toUnixDate(entry.startedAt),
        completed_at: toUnixDate(entry.completedAt),
        anilist_entry_id: entry.id,
        created_at: entry.createdAt ?? null,
        updated_at: entry.updatedAt ?? null,
      });
      upsertSyncState({
        user_id: userKey,
        anilist_id: entry.media.id,
        local_status: entry.status,
        local_progress: entry.progress ?? 0,
        local_score: entry.score ?? null,
        anilist_status: entry.status,
        anilist_progress: entry.progress ?? 0,
        anilist_score: entry.score ?? null,
        needs_sync: 0,
      });
    }
  }
}

function flattenCollection(collection: MediaListCollection): MediaListEntry[] {
  const entries: MediaListEntry[] = [];
  for (const list of collection.lists) {
    for (const entry of list.entries) {
      if (!entry.media) continue;
      entries.push(entry);
    }
  }
  return entries;
}

function mapAnilistStats(source: AniListUserStats) {
  const history = source.stats?.activityHistory ?? source.stats?.mangaActivityHistory ?? [];
  const manga = source.statistics?.manga;
  const chaptersRead = manga?.chaptersRead ?? 0;
  const minutesRead = chaptersRead * 5;
  const genres = (manga?.genres ?? []).map((genre) => ({
    ...genre,
    minutesRead: (genre.chaptersRead ?? 0) * 5,
  }));

  return {
    stats: {
      mangaActivityHistory: history,
    },
    statistics: {
      manga: {
        count: manga?.count ?? 0,
        chaptersRead,
        volumesRead: manga?.volumesRead ?? 0,
        meanScore: manga?.meanScore ?? null,
        standardDeviation: manga?.standardDeviation ?? null,
        minutesRead,
        genres,
        statuses: manga?.statuses ?? [],
        formats: manga?.formats ?? [],
        countries: manga?.countries ?? [],
      },
    },
  };
}

function buildActivityHistory(entries: ReturnType<typeof listLibraryEntries>): Array<{
  date: number;
  amount: number;
  level: number;
}> {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const updatedAt = entry.entry.updated_at;
    if (!updatedAt) continue;
    const day = Math.floor(updatedAt / 86400) * 86400;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const history = [];
  const now = new Date();
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - i);
    const unix = Math.floor(date.getTime() / 1000);
    const amount = counts.get(unix) ?? 0;
    const level = amount === 0 ? 0 : amount > 12 ? 4 : amount > 7 ? 3 : amount > 3 ? 2 : 1;
    history.unshift({ date: unix, amount, level });
  }
  return history;
}

function buildActivityHistoryFromList(entries: MediaListEntry[]): Array<{
  date: number;
  amount: number;
  level: number;
}> {
  const counts = new Map<number, number>();
  for (const entry of entries) {
    const updatedAt = entry.updatedAt;
    if (!updatedAt) continue;
    const day = Math.floor(updatedAt / 86400) * 86400;
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const history = [];
  const now = new Date();
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - i);
    const unix = Math.floor(date.getTime() / 1000);
    const amount = counts.get(unix) ?? 0;
    const level = amount === 0 ? 0 : amount > 12 ? 4 : amount > 7 ? 3 : amount > 3 ? 2 : 1;
    history.unshift({ date: unix, amount, level });
  }
  return history;
}

function buildStats(entries: ReturnType<typeof listLibraryEntries>) {
  const scores: number[] = [];
  const genres = new Map<string, { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }>();
  const statuses = new Map<
    string,
    { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }
  >();
  const formats = new Map<string, number>();
  const countries = new Map<string, number>();

  let chaptersRead = 0;

  for (const entry of entries) {
    const media = entry.media;
    if (!media) continue;
    const score = entry.entry.score;
    const progress = entry.entry.progress ?? 0;
    chaptersRead += progress;

    if (typeof score === 'number') {
      scores.push(score);
    }

    const status = entry.entry.status;
    const statusBucket = statuses.get(status) ?? {
      count: 0,
      scoreTotal: 0,
      scoreCount: 0,
      chaptersRead: 0,
    };
    statusBucket.count += 1;
    statusBucket.chaptersRead += progress;
    if (typeof score === 'number') {
      statusBucket.scoreTotal += score;
      statusBucket.scoreCount += 1;
    }
    statuses.set(status, statusBucket);

    const genreList = parseGenres(media.genres);
    for (const genre of genreList) {
      const bucket = genres.get(genre) ?? {
        count: 0,
        scoreTotal: 0,
        scoreCount: 0,
        chaptersRead: 0,
      };
      bucket.count += 1;
      bucket.chaptersRead += progress;
      if (typeof score === 'number') {
        bucket.scoreTotal += score;
        bucket.scoreCount += 1;
      }
      genres.set(genre, bucket);
    }

    if (media.format) {
      formats.set(media.format, (formats.get(media.format) ?? 0) + 1);
    }
    if (media.country_of_origin) {
      countries.set(media.country_of_origin, (countries.get(media.country_of_origin) ?? 0) + 1);
    }
  }

  const meanScore =
    scores.length > 0 ? scores.reduce((acc, value) => acc + value, 0) / scores.length : null;
  const standardDeviation =
    scores.length > 1
      ? Math.sqrt(
          scores.reduce((sum, value) => sum + Math.pow(value - (meanScore ?? 0), 2), 0) / scores.length,
        )
      : null;

  return {
    count: entries.length,
    chaptersRead,
    volumesRead: 0,
    meanScore,
    standardDeviation,
    minutesRead: chaptersRead * 5,
    genres: Array.from(genres.entries()).map(([genre, bucket]) => ({
      genre,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      minutesRead: bucket.chaptersRead * 5,
      chaptersRead: bucket.chaptersRead,
    })),
    statuses: Array.from(statuses.entries()).map(([status, bucket]) => ({
      status,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      chaptersRead: bucket.chaptersRead,
    })),
    formats: Array.from(formats.entries()).map(([format, count]) => ({ format, count })),
    countries: Array.from(countries.entries()).map(([country, count]) => ({ country, count })),
  };
}

function buildStatsFromList(entries: MediaListEntry[]) {
  const scores: number[] = [];
  const genres = new Map<string, { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }>();
  const statuses = new Map<
    string,
    { count: number; scoreTotal: number; scoreCount: number; chaptersRead: number }
  >();
  const formats = new Map<string, number>();
  const countries = new Map<string, number>();

  let chaptersRead = 0;
  let volumesRead = 0;

  for (const entry of entries) {
    const media = entry.media;
    if (!media) continue;
    const score = entry.score ?? null;
    const progress = entry.progress ?? 0;
    const progressVolumes = entry.progressVolumes ?? 0;
    chaptersRead += progress;
    volumesRead += progressVolumes;

    if (typeof score === 'number') {
      scores.push(score);
    }

    const status = entry.status;
    const statusBucket = statuses.get(status) ?? {
      count: 0,
      scoreTotal: 0,
      scoreCount: 0,
      chaptersRead: 0,
    };
    statusBucket.count += 1;
    statusBucket.chaptersRead += progress;
    if (typeof score === 'number') {
      statusBucket.scoreTotal += score;
      statusBucket.scoreCount += 1;
    }
    statuses.set(status, statusBucket);

    const genreList = media.genres ?? [];
    for (const genre of genreList) {
      const bucket = genres.get(genre) ?? {
        count: 0,
        scoreTotal: 0,
        scoreCount: 0,
        chaptersRead: 0,
      };
      bucket.count += 1;
      bucket.chaptersRead += progress;
      if (typeof score === 'number') {
        bucket.scoreTotal += score;
        bucket.scoreCount += 1;
      }
      genres.set(genre, bucket);
    }

    if (media.format) {
      formats.set(media.format, (formats.get(media.format) ?? 0) + 1);
    }
    if (media.countryOfOrigin) {
      countries.set(media.countryOfOrigin, (countries.get(media.countryOfOrigin) ?? 0) + 1);
    }
  }

  const meanScore =
    scores.length > 0 ? scores.reduce((acc, value) => acc + value, 0) / scores.length : null;
  const standardDeviation =
    scores.length > 1
      ? Math.sqrt(
          scores.reduce((sum, value) => sum + Math.pow(value - (meanScore ?? 0), 2), 0) /
            scores.length,
        )
      : null;

  return {
    count: entries.length,
    chaptersRead,
    volumesRead,
    meanScore,
    standardDeviation,
    minutesRead: chaptersRead * 5,
    genres: Array.from(genres.entries()).map(([genre, bucket]) => ({
      genre,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      minutesRead: bucket.chaptersRead * 5,
      chaptersRead: bucket.chaptersRead,
    })),
    statuses: Array.from(statuses.entries()).map(([status, bucket]) => ({
      status,
      count: bucket.count,
      meanScore: bucket.scoreCount ? bucket.scoreTotal / bucket.scoreCount : null,
      chaptersRead: bucket.chaptersRead,
    })),
    formats: Array.from(formats.entries()).map(([format, count]) => ({ format, count })),
    countries: Array.from(countries.entries()).map(([country, count]) => ({ country, count })),
  };
}

export class LibraryService {
  constructor(private anilist = new AniListService()) {}

  private async seedFromAnilist(userKey: string, auth: AuthUser) {
    if (!auth.anilistToken || auth.id === null || auth.id === undefined) {
      return;
    }

    const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
    storeCollection(userKey, collection);
  }

  private async ensureSeeded(userKey: string, auth?: AuthUser) {
    if (!auth?.anilistToken || auth.id === null || auth.id === undefined) {
      return;
    }

    const existingCount = countLibraryEntries(userKey);
    let needsSeed = existingCount === 0;

    if (!needsSeed) {
      const entries = listLibraryEntries(userKey);
      const missingMedia = entries.some((entry) => !entry.media && entry.entry.anilist_id);
      if (missingMedia) {
        needsSeed = true;
      }
    }

    if (!needsSeed) {
      return;
    }

    await this.seedFromAnilist(userKey, auth);
  }

  private async ensureMediaCached(mediaId: number, accessToken?: string): Promise<void> {
    const existing = getAnilistMangaById(mediaId);
    if (existing && !isStubAnilistRecord(existing)) return;

    try {
      const media = accessToken
        ? await this.anilist.getMangaDetailsForUser(accessToken, mediaId)
        : await this.anilist.getMangaDetails(mediaId);
      upsertAnilistManga(mapMediaToDb(media));
    } catch (error) {
      console.warn('Failed to refresh AniList media details:', error);
    }
  }

  async list(userKey: string, status?: MediaListStatus, auth?: AuthUser) {
    await this.ensureSeeded(userKey, auth);
    let entries = listLibraryEntries(userKey, status);
    const stubIds = entries
      .filter((entry) => entry.entry.anilist_id && isStubAnilistRecord(entry.media))
      .map((entry) => entry.entry.anilist_id)
      .slice(0, 5);

    if (stubIds.length > 0) {
      for (const mediaId of stubIds) {
        await this.ensureMediaCached(mediaId, auth?.anilistToken);
      }
      entries = listLibraryEntries(userKey, status);
    }

    if (
      entries.length === 0 &&
      auth?.anilistToken &&
      auth.id !== null &&
      auth.id !== undefined
    ) {
      const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken, status);
      storeCollection(userKey, collection);
      entries = listLibraryEntries(userKey, status);
      if (entries.length === 0) {
        return collection;
      }
    }
    const grouped: Record<string, MediaListEntry[]> = {};

    for (const entry of entries) {
      const mapped = mapEntryToMediaList(entry);
      if (!mapped) continue;
      const key = mapped.status;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(mapped);
    }

    const lists = Object.entries(grouped).map(([statusKey, items]) => ({
      name: STATUS_LABELS[statusKey] ?? statusKey,
      entries: items,
    }));

    return { lists };
  }

  async add(
    userKey: string,
    input: { mediaId: number; status: MediaListStatus; progress?: number; score?: number; notes?: string },
    auth?: AuthUser,
  ) {
    await this.ensureMediaCached(input.mediaId, auth?.anilistToken);
    const localEntry = upsertLibraryEntry({
      user_id: userKey,
      anilist_id: input.mediaId,
      status: input.status,
      progress: input.progress ?? 0,
      score: input.score ?? null,
      notes: input.notes ?? null,
    });

    if (auth?.anilistToken && auth.id !== null && auth.id !== undefined) {
      try {
        const remoteEntry = await this.anilist.updateEntry(auth.anilistToken, {
          mediaId: input.mediaId,
          status: input.status,
          progress: input.progress,
          score: input.score,
          notes: input.notes,
        });
        upsertLibraryEntry({
          user_id: userKey,
          anilist_id: input.mediaId,
          status: input.status,
          progress: input.progress ?? localEntry.progress ?? 0,
          score: input.score ?? localEntry.score ?? null,
          notes: input.notes ?? localEntry.notes ?? null,
          anilist_entry_id: remoteEntry.id,
        });
        upsertSyncState({
          user_id: userKey,
          anilist_id: input.mediaId,
          local_status: input.status,
          local_progress: input.progress ?? localEntry.progress ?? 0,
          local_score: input.score ?? localEntry.score ?? null,
          anilist_status: remoteEntry.status,
          anilist_progress: remoteEntry.progress,
          anilist_score: remoteEntry.score ?? null,
          needs_sync: 0,
        });
      } catch {
        upsertSyncState({
          user_id: userKey,
          anilist_id: input.mediaId,
          local_status: input.status,
          local_progress: input.progress ?? localEntry.progress ?? 0,
          local_score: input.score ?? localEntry.score ?? null,
          needs_sync: 1,
        });
      }
    }

    return localEntry;
  }

  async update(
    userKey: string,
    mediaId: number,
    input: { status?: MediaListStatus; progress?: number; score?: number; notes?: string },
    auth?: AuthUser,
  ) {
    const existing = getLibraryEntry(userKey, mediaId);
    const status = input.status ?? (existing?.status as MediaListStatus) ?? 'CURRENT';
    const progress = input.progress ?? existing?.progress ?? 0;
    const score = input.score ?? existing?.score ?? null;
    const notes = input.notes ?? existing?.notes ?? null;

    await this.ensureMediaCached(mediaId, auth?.anilistToken);
    const localEntry = upsertLibraryEntry({
      user_id: userKey,
      anilist_id: mediaId,
      status,
      progress,
      score,
      notes,
      anilist_entry_id: existing?.anilist_entry_id ?? null,
    });

    if (auth?.anilistToken && auth.id !== null && auth.id !== undefined) {
      try {
        const remoteEntry = await this.anilist.updateEntry(auth.anilistToken, {
          mediaId,
          status,
          progress,
          score: score ?? undefined,
          notes: notes ?? undefined,
        });
        upsertLibraryEntry({
          user_id: userKey,
          anilist_id: mediaId,
          status,
          progress,
          score,
          notes,
          anilist_entry_id: remoteEntry.id,
        });
        upsertSyncState({
          user_id: userKey,
          anilist_id: mediaId,
          local_status: status,
          local_progress: progress,
          local_score: score,
          anilist_status: remoteEntry.status,
          anilist_progress: remoteEntry.progress,
          anilist_score: remoteEntry.score ?? null,
          needs_sync: 0,
        });
      } catch {
        upsertSyncState({
          user_id: userKey,
          anilist_id: mediaId,
          local_status: status,
          local_progress: progress,
          local_score: score,
          needs_sync: 1,
        });
      }
    }

    return localEntry;
  }

  async remove(userKey: string, mediaId: number, auth?: AuthUser) {
    const existing = getLibraryEntry(userKey, mediaId);
    const deleted = deleteLibraryEntry(userKey, mediaId);

    if (!auth?.anilistToken || auth.id === null || auth.id === undefined) {
      return { deleted };
    }

    try {
      let entryId = existing?.anilist_entry_id ?? null;
      if (!entryId) {
        const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
        for (const list of collection.lists) {
          const found = list.entries.find((entry) => entry.mediaId === mediaId);
          if (found) {
            entryId = found.id;
            break;
          }
        }
      }

      if (entryId) {
        await this.anilist.removeFromList(auth.anilistToken, entryId);
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
      }
    } catch {
      upsertSyncState({
        user_id: userKey,
        anilist_id: mediaId,
        local_status: null,
        local_progress: null,
        local_score: null,
        needs_sync: 1,
      });
    }

    return { deleted };
  }

  async stats(userKey: string, auth?: AuthUser) {
    await this.ensureSeeded(userKey, auth);
    if (auth?.anilistToken && auth.id !== null && auth.id !== undefined) {
      try {
        const remote = await this.anilist.getUserStats(auth.id, auth.anilistToken);
        const mapped = mapAnilistStats(remote);
        if (
          (mapped.statistics.manga.count ?? 0) > 0 ||
          (mapped.stats.mangaActivityHistory?.length ?? 0) > 0
        ) {
          return mapped;
        }
      } catch {
        // fall back to local stats
      }
    }

    const entries = listLibraryEntries(userKey);
    if (
      entries.length === 0 &&
      auth?.anilistToken &&
      auth.id !== null &&
      auth.id !== undefined
    ) {
      const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
      storeCollection(userKey, collection);
      const flattened = flattenCollection(collection);
      const stats = buildStatsFromList(flattened);
      const history = buildActivityHistoryFromList(flattened);
      return {
        stats: {
          mangaActivityHistory: history,
        },
        statistics: {
          manga: stats,
        },
      };
    }

    const stats = buildStats(entries);
    const history = buildActivityHistory(entries);
    return {
      stats: {
        mangaActivityHistory: history,
      },
      statistics: {
        manga: stats,
      },
    };
  }
}
