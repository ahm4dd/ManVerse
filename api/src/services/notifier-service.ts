import { Providers } from '@manverse/core';
import {
  getProviderReleaseState,
  listReadingProviderEntries,
  upsertProviderReleaseState,
} from '@manverse/database';
import { ScraperService } from './scraper-service.ts';

type Provider = (typeof Providers)[keyof typeof Providers];

export interface ChapterReleaseUpdate {
  anilistId: number;
  provider: string;
  providerId: string;
  providerMangaId: number;
  seriesTitle: string | null;
  chapterNumber: string;
  chapterTitle: string | null;
  releaseDate: string | null;
}

const DEFAULT_STATUS = 'CURRENT';
const MAX_CONCURRENCY = 2;

const parseChapterValue = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const pickLatestChapter = (chapters: Array<Record<string, unknown>>) => {
  if (!chapters.length) return null;
  const enriched = chapters.map((chapter) => {
    const number = (chapter.chapterNumber as string | undefined) ?? '';
    return {
      ...chapter,
      _value: parseChapterValue(number),
    };
  });
  const withNumbers = enriched.filter((chapter) => chapter._value !== null);
  if (withNumbers.length) {
    return withNumbers.sort((a, b) => (b._value ?? 0) - (a._value ?? 0))[0];
  }
  return enriched[0];
};

export class NotifierService {
  private scraper = new ScraperService();

  private async checkEntry(entry: ReturnType<typeof listReadingProviderEntries>[number]) {
    const provider = entry.provider as Provider;
    if (!provider || !entry.providerId) return null;

    const details = await this.scraper.getSeriesDetails(entry.providerId, provider, {
      refresh: true,
    });
    const latest = pickLatestChapter(details.chapters ?? []);
    if (!latest) return null;

    const latestNumber = (latest.chapterNumber as string | undefined) ?? '';
    const latestTitle = (latest.chapterTitle as string | undefined) ?? null;
    const latestDate = (latest.releaseDate as string | undefined) ?? null;

    const previous = getProviderReleaseState(entry.providerMangaId);
    const latestValue = parseChapterValue(latestNumber);
    const previousValue = parseChapterValue(previous?.last_chapter ?? null);

    const hasChange =
      latestValue !== null && previousValue !== null
        ? latestValue > previousValue
        : latestNumber !== (previous?.last_chapter ?? '');

    const now = Math.floor(Date.now() / 1000);
    upsertProviderReleaseState({
      providerMangaId: entry.providerMangaId,
      lastChapter: latestNumber || previous?.last_chapter || null,
      lastTitle: latestTitle ?? previous?.last_title ?? null,
      lastCheckedAt: now,
      lastSeenAt: hasChange ? now : previous?.last_seen_at ?? now,
    });

    if (!hasChange) return null;

    return {
      anilistId: entry.anilistId,
      provider: entry.provider,
      providerId: entry.providerId,
      providerMangaId: entry.providerMangaId,
      seriesTitle: entry.seriesTitle,
      chapterNumber: latestNumber,
      chapterTitle: latestTitle,
      releaseDate: latestDate,
    } satisfies ChapterReleaseUpdate;
  }

  async checkReadingUpdates(status: string = DEFAULT_STATUS): Promise<ChapterReleaseUpdate[]> {
    const entries = listReadingProviderEntries(status);
    if (entries.length === 0) return [];

    const updates: ChapterReleaseUpdate[] = [];
    for (let i = 0; i < entries.length; i += MAX_CONCURRENCY) {
      const batch = entries.slice(i, i + MAX_CONCURRENCY);
      const results = await Promise.allSettled(batch.map((entry) => this.checkEntry(entry)));
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          updates.push(result.value);
        }
      });
    }
    return updates;
  }
}
