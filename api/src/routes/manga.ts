import { Hono } from 'hono';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { parseQuery } from '../utils/validation.ts';
import { MangaService, type MangaSource } from '../services/manga-service.ts';
import type { HonoEnv } from '../types/api.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ScraperService } from '../services/scraper-service.ts';
import { Providers } from '@manverse/core';
import {
  getActiveMapping,
  getActiveMappingByProviderId,
  getProviderMangaById,
  getProviderMangaByProviderId,
  listProviderMappings,
  setActiveMapping,
  upsertProviderManga,
} from '@manverse/database';

const manga = new Hono<HonoEnv>();
const service = new MangaService();
const scraper = new ScraperService();

const searchSchema = z.object({
  query: z.string().min(1),
  source: z.enum(['anilist', 'asura', 'both']).optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  genre: z.string().optional(),
  country: z.string().optional(),
  sort: z.string().optional(),
});

const providerDetailsSchema = z.object({
  provider: z.string().optional(),
  id: z.string().min(1),
});

const providerMappingSchema = z.object({
  provider: z.string().optional(),
  id: z.string().min(1),
});

const providerChaptersSchema = z.object({
  provider: z.string().optional(),
  providerId: z.string().optional(),
});

const providerMapSchema = z.object({
  provider: z.string().optional(),
  providerId: z.string().optional(),
  providerMangaId: z.number().optional(),
  title: z.string().optional(),
  image: z.string().optional(),
  status: z.string().optional(),
  rating: z.string().optional(),
});

function normalizeSort(input?: string): string[] | undefined {
  if (!input || input === 'All') return undefined;
  const normalized = input.toUpperCase().replace(/\\s+/g, '_');

  if (normalized.endsWith('_DESC') || normalized.endsWith('_ASC')) {
    return [normalized];
  }

  const map: Record<string, string> = {
    POPULARITY: 'POPULARITY_DESC',
    TITLE: 'TITLE_ROMAJI',
    SCORE: 'SCORE_DESC',
    PROGRESS: 'POPULARITY_DESC',
    LAST_UPDATED: 'UPDATED_AT_DESC',
    LAST_ADDED: 'ID_DESC',
    START_DATE: 'START_DATE_DESC',
  };

  const mapped = map[normalized];
  return mapped ? [mapped] : undefined;
}

function normalizeFormat(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase().replace(/\\s+/g, '_');
}

function normalizeStatus(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase().replace(/\\s+/g, '_');
}

function normalizeCountry(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase();
}

function normalizeProvider(input?: string) {
  if (input && Object.values(Providers).includes(input as (typeof Providers)[keyof typeof Providers])) {
    return input as (typeof Providers)[keyof typeof Providers];
  }
  return Providers.AsuraScans;
}

function toProviderInput(provider: string, providerId: string, details: any) {
  return {
    provider,
    provider_id: providerId,
    title: details.title || details.name || providerId,
    image: details.image || null,
    status: details.status || null,
    rating: details.rating || null,
    chapters: details.chapters || null,
    genres: details.genres || null,
    description: details.description || null,
    author: details.author || null,
    artist: details.artist || null,
    serialization: details.serialization || null,
    updated_on: details.updatedOn || null,
    last_scraped: Math.floor(Date.now() / 1000),
  };
}

manga.get('/search', (c) => {
  const { query, source, format, status, genre, country, sort } = parseQuery(c, searchSchema);
  return service
    .search(query, (source || 'anilist') as MangaSource, {
      sort: normalizeSort(sort),
      format: normalizeFormat(format),
      status: normalizeStatus(status),
      genre: genre && genre !== 'All' ? genre : undefined,
      country: normalizeCountry(country),
    })
    .then((results) => jsonSuccess(c, results))
    .catch((error) =>
      jsonError(
        c,
        {
          code: 'MANGA_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed',
        },
        500,
      ),
    );
});

manga.get('/provider/mapping', (c) => {
  const { provider, id } = parseQuery(c, providerMappingSchema);
  const resolvedProvider = normalizeProvider(provider);
  const mapping = getActiveMappingByProviderId(resolvedProvider, id);

  if (!mapping) {
    return jsonError(
      c,
      { code: 'PROVIDER_MAPPING_NOT_FOUND', message: 'No mapping found for provider series' },
      404,
    );
  }

  return jsonSuccess(c, mapping);
});

manga.get('/provider', (c) => {
  const { provider, id } = parseQuery(c, providerDetailsSchema);
  const resolvedProvider = normalizeProvider(provider);

  return scraper
    .getSeriesDetails(id, resolvedProvider)
    .then((details) => {
      upsertProviderManga(toProviderInput(resolvedProvider, id, details));
      return jsonSuccess(c, details);
    })
    .catch((error) =>
      jsonError(
        c,
        {
          code: 'PROVIDER_DETAILS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch provider details',
        },
        502,
      ),
    );
});

manga.get('/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const details = await service.getMangaDetails(id);
  return jsonSuccess(c, details);
});

manga.get('/:id/chapters', (c) => {
  const { provider, providerId } = parseQuery(c, providerChaptersSchema);
  const resolvedProvider = normalizeProvider(provider);

  const anilistId = Number(c.req.param('id'));
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const mapping =
    providerId ? null : getActiveMapping(anilistId, resolvedProvider);
  const resolvedProviderId = providerId || mapping?.provider.provider_id;

  if (!resolvedProviderId) {
    return jsonError(
      c,
      { code: 'PROVIDER_MAPPING_REQUIRED', message: 'Provider mapping is required' },
      400,
    );
  }

  return scraper
    .getSeriesDetails(resolvedProviderId, resolvedProvider)
    .then((details) => {
      upsertProviderManga(toProviderInput(resolvedProvider, resolvedProviderId, details));
      return jsonSuccess(c, details);
    })
    .catch((error) =>
      jsonError(
        c,
        {
          code: 'CHAPTER_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch chapters',
        },
        502,
      ),
    );
});

manga.post('/:id/map', requireAuth, async (c) => {
  const anilistId = Number(c.req.param('id'));
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const body = providerMapSchema.parse(await c.req.json());
  const resolvedProvider = normalizeProvider(body.provider);

  let providerRecord = null;
  if (body.providerMangaId) {
    providerRecord = getProviderMangaById(body.providerMangaId);
  } else if (body.providerId) {
    providerRecord = getProviderMangaByProviderId(resolvedProvider, body.providerId);
    if (!providerRecord) {
      const details = body.title
        ? {
            title: body.title,
            image: body.image,
            status: body.status,
            rating: body.rating,
          }
        : await scraper.getSeriesDetails(body.providerId, resolvedProvider);
      providerRecord = upsertProviderManga(
        toProviderInput(resolvedProvider, body.providerId, details),
      );
    }
  }

  if (!providerRecord) {
    return jsonError(
      c,
      { code: 'PROVIDER_NOT_FOUND', message: 'Provider series not found' },
      404,
    );
  }

  const mapping = setActiveMapping(anilistId, resolvedProvider, providerRecord.id, 'manual');
  return jsonSuccess(c, { mapping, provider: providerRecord });
});

manga.get('/:id/providers', (c) => {
  const anilistId = Number(c.req.param('id'));
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const mappings = listProviderMappings(anilistId);
  return jsonSuccess(c, mappings);
});

export default manga;
