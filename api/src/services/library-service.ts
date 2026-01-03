import type { MediaListStatus, MediaListEntry } from '@manverse/anilist';
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
  type AnilistMangaInput,
} from '@manverse/database';
import { AniListService } from './anilist-service.ts';

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

function toUnixDate(input?: { year?: number | null; month?: number | null; day?: number | null } | null) {
  if (!input?.year || !input?.month || !input?.day) return null;
  return Math.floor(Date.UTC(input.year, input.month - 1, input.day) / 1000);
}

function mapMediaToDb(media: any): AnilistMangaInput {
  return {
    id: media.id,
    title_romaji: media.title?.romaji || media.title?.english || 'Unknown',
    title_english: media.title?.english ?? null,
    title_native: media.title?.native ?? null,
    description: media.description ?? null,
    cover_large: media.coverImage?.extraLarge ?? media.coverImage?.large ?? null,
    cover_medium: media.coverImage?.large ?? media.coverImage?.medium ?? null,
    banner_image: media.bannerImage ?? null,
    status: media.status ?? null,
    format: media.format ?? null,
    chapters: media.chapters ?? null,
    volumes: media.volumes ?? null,
    genres: media.genres ?? null,
    average_score: media.averageScore ?? null,
    popularity: media.popularity ?? null,
    favourites: media.favourites ?? null,
    updated_at: media.updatedAt ?? null,
    country_of_origin: media.countryOfOrigin ?? null,
  };
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

export class LibraryService {
  constructor(private anilist = new AniListService()) {}

  private async ensureSeeded(userKey: string, auth?: AuthUser) {
    if (!auth?.anilistToken || auth.id === null || auth.id === undefined) {
      return;
    }

    if (countLibraryEntries(userKey) > 0) {
      return;
    }

    const collection = await this.anilist.getUserLibrary(auth.id, auth.anilistToken);
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

  private async ensureMediaCached(mediaId: number): Promise<void> {
    const existing = getAnilistMangaById(mediaId);
    if (existing) return;

    const media = await this.anilist.getMangaDetails(mediaId);
    upsertAnilistManga(mapMediaToDb(media));
  }

  async list(userKey: string, status?: MediaListStatus, auth?: AuthUser) {
    await this.ensureSeeded(userKey, auth);
    const entries = listLibraryEntries(userKey, status);
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
    await this.ensureMediaCached(input.mediaId);
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

    await this.ensureMediaCached(mediaId);
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

  async stats(userKey: string) {
    const entries = listLibraryEntries(userKey);
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
