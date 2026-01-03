import type { AnilistMangaInput } from '@manverse/database';

export function toUnixDate(
  input?: { year?: number | null; month?: number | null; day?: number | null } | null,
): number | null {
  if (!input?.year || !input?.month || !input?.day) return null;
  return Math.floor(Date.UTC(input.year, input.month - 1, input.day) / 1000);
}

export function mapMediaToDb(media: any): AnilistMangaInput {
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
