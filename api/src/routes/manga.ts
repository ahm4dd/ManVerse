import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import { MangaService, type MangaSource } from '../services/manga-service.ts';
import type { HonoEnv } from '../types/api.ts';
import { requireAuth } from '../middleware/auth.ts';
import { ScraperService } from '../services/scraper-service.ts';
import { Providers } from '@manverse/core';
import { asuraScansConfig } from '@manverse/scrapers';
import {
  getActiveMapping,
  getActiveMappingByProviderId,
  getAnilistMangaById,
  getDatabase,
  getProviderMangaById,
  getProviderMangaByProviderId,
  listProviderMappings,
  setActiveMapping,
  upsertAnilistManga,
  upsertProviderManga,
} from '@manverse/database';
import { ApiErrorSchema, ApiSuccessUnknownSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';
import { AniListService } from '../services/anilist-service.ts';
import { mapMediaToDb } from '../services/library-mapper.ts';

const manga = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new MangaService();
const scraper = new ScraperService();
const anilistService = new AniListService();

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: ApiErrorSchema,
    },
  },
};

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
  const normalized = input.toUpperCase().replace(/\s+/g, '_');

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
  return input.toUpperCase().replace(/\s+/g, '_');
}

function normalizeStatus(input?: string): string | undefined {
  if (!input || input === 'All') return undefined;
  return input.toUpperCase().replace(/\s+/g, '_');
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

function normalizeProviderId(provider: string, providerId: string): string {
  const trimmed = providerId.trim();
  if (!trimmed) return trimmed;

  if (provider === Providers.AsuraScans) {
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(/\/+$/, '');
    }

    const cleaned = trimmed.replace(/^\/+/, '');
    if (cleaned.startsWith('asuracomic.net/')) {
      return `https://${cleaned}`.replace(/\/+$/, '');
    }
    if (cleaned.startsWith('series/')) {
      return `https://asuracomic.net/${cleaned}`.replace(/\/+$/, '');
    }
    return `https://asuracomic.net/series/${cleaned}`.replace(/\/+$/, '');
  }

  return trimmed;
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

function parseJsonArray<T>(value?: string | null): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function getProviderImageReferer(provider: string): string {
  if (provider === Providers.AsuraScans) {
    return asuraScansConfig.baseUrl;
  }
  return '';
}

function hydrateProviderDetails(provider: string, record: { [key: string]: any }) {
  const chapters = parseJsonArray<any>(record.chapters).map((chapter) => ({
    chapterNumber: chapter.chapterNumber || chapter.number || '',
    chapterTitle: chapter.chapterTitle || chapter.title || '',
    chapterUrl: chapter.chapterUrl || chapter.url || '',
    releaseDate: chapter.releaseDate || chapter.date || '',
  }));

  return {
    id: record.provider_id,
    title: record.title,
    description: record.description || '',
    image: record.image || '',
    headerForImage: { Referer: getProviderImageReferer(provider) },
    status: record.status || 'Unknown',
    rating: record.rating || '',
    genres: parseJsonArray<string>(record.genres),
    chapters,
    author: record.author || '',
    artist: record.artist || '',
    serialization: record.serialization || '',
    updatedOn: record.updated_on || '',
  };
}

async function ensureAnilistRecord(
  anilistId: number,
  accessToken?: string,
  fallbackTitle?: string,
): Promise<void> {
  const existing = getAnilistMangaById(anilistId);
  if (existing) return;

  try {
    const media = accessToken
      ? await anilistService.getMangaDetailsForUser(accessToken, anilistId)
      : await anilistService.getMangaDetails(anilistId);
    upsertAnilistManga(mapMediaToDb(media));
    return;
  } catch (error) {
    const safeTitle = fallbackTitle?.trim() || `AniList ${anilistId}`;
    upsertAnilistManga({ id: anilistId, title_romaji: safeTitle });
  }
}

const searchRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['manga'],
  request: {
    query: searchSchema,
  },
  responses: {
    200: {
      description: 'Search results',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

manga.openapi(searchRoute, (c) => {
  const { query, source, format, status, genre, country, sort } = c.req.valid('query');
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

const providerMappingRoute = createRoute({
  method: 'get',
  path: '/provider/mapping',
  tags: ['manga'],
  request: {
    query: providerMappingSchema,
  },
  responses: {
    200: {
      description: 'Provider mapping',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    404: errorResponse,
    default: errorResponse,
  },
});

manga.openapi(providerMappingRoute, (c) => {
  const { provider, id } = c.req.valid('query');
  const resolvedProvider = normalizeProvider(provider);
  const normalizedId = normalizeProviderId(resolvedProvider, id);
  let mapping = getActiveMappingByProviderId(resolvedProvider, normalizedId);

  if (!mapping && normalizedId !== id) {
    mapping = getActiveMappingByProviderId(resolvedProvider, id);
  }

  if (!mapping) {
    return jsonError(
      c,
      { code: 'PROVIDER_MAPPING_NOT_FOUND', message: 'No mapping found for provider series' },
      404,
    );
  }

  return jsonSuccess(c, mapping);
});

const providerDetailsRoute = createRoute({
  method: 'get',
  path: '/provider',
  tags: ['manga'],
  request: {
    query: providerDetailsSchema,
  },
  responses: {
    200: {
      description: 'Provider series details',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

manga.openapi(providerDetailsRoute, (c) => {
  const { provider, id } = c.req.valid('query');
  const resolvedProvider = normalizeProvider(provider);
  const normalizedId = normalizeProviderId(resolvedProvider, id);

  return scraper
    .getSeriesDetails(normalizedId, resolvedProvider)
    .then((details) => {
      let providerRecord = null;
      try {
        providerRecord = upsertProviderManga(
          toProviderInput(resolvedProvider, normalizedId, details),
        );
      } catch (error) {
        console.warn('Failed to persist provider details:', error);
      }
      return jsonSuccess(c, {
        ...details,
        providerMangaId: providerRecord?.id ?? null,
        providerId: normalizedId,
      });
    })
    .catch((error) => {
      const fallback =
        getProviderMangaByProviderId(resolvedProvider, normalizedId) ||
        (normalizedId !== id ? getProviderMangaByProviderId(resolvedProvider, id) : null);

      if (fallback) {
        const hydrated = hydrateProviderDetails(resolvedProvider, fallback);
        return jsonSuccess(c, {
          ...hydrated,
          providerMangaId: fallback.id,
          providerId: fallback.provider_id,
        });
      }

      return jsonError(
        c,
        {
          code: 'PROVIDER_DETAILS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to fetch provider details',
        },
        502,
      );
    });
});

const mangaDetailsRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['manga'],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Manga details',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

manga.openapi(mangaDetailsRoute, async (c) => {
  const { id } = c.req.valid('param');
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const details = await service.getMangaDetails(id);
  return jsonSuccess(c, details);
});

const mangaChaptersRoute = createRoute({
  method: 'get',
  path: '/{id}/chapters',
  tags: ['manga'],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
    query: providerChaptersSchema,
  },
  responses: {
    200: {
      description: 'Mapped provider chapters',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    400: errorResponse,
    default: errorResponse,
  },
});

manga.openapi(mangaChaptersRoute, (c) => {
  const { provider, providerId } = c.req.valid('query');
  const { id } = c.req.valid('param');
  const resolvedProvider = normalizeProvider(provider);

  const anilistId = Number(id);
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const mapping = providerId ? null : getActiveMapping(anilistId, resolvedProvider);
  const resolvedProviderId = providerId || mapping?.provider.provider_id;

  if (!resolvedProviderId) {
    return jsonError(
      c,
      { code: 'PROVIDER_MAPPING_REQUIRED', message: 'Provider mapping is required' },
      400,
    );
  }

  return scraper
    .getSeriesDetails(normalizeProviderId(resolvedProvider, resolvedProviderId), resolvedProvider)
    .then((details) => {
      const normalizedProviderId = normalizeProviderId(resolvedProvider, resolvedProviderId);
      upsertProviderManga(toProviderInput(resolvedProvider, normalizedProviderId, details));
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

const mangaMapRoute = createRoute({
  method: 'post',
  path: '/{id}/map',
  tags: ['manga'],
  middleware: requireAuth,
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
    body: {
      content: {
        'application/json': {
          schema: providerMapSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Mapping created',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    400: errorResponse,
    404: errorResponse,
    default: errorResponse,
  },
});

manga.openapi(mangaMapRoute, async (c) => {
  const { id } = c.req.valid('param');
  const anilistId = Number(id);
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const body = c.req.valid('json');
  const resolvedProvider = normalizeProvider(body.provider);
  const rawProviderId = body.providerId?.trim();
  const normalizedProviderId = rawProviderId
    ? normalizeProviderId(resolvedProvider, rawProviderId)
    : undefined;

  if (!body.providerMangaId && !normalizedProviderId) {
    return jsonError(
      c,
      { code: 'PROVIDER_ID_REQUIRED', message: 'Provider series id is required' },
      400,
    );
  }

  let providerRecord = null;
  if (body.providerMangaId) {
    providerRecord = getProviderMangaById(body.providerMangaId);
  }

  if (!providerRecord && normalizedProviderId) {
    const lookupIds = [normalizedProviderId];
    if (rawProviderId && rawProviderId !== normalizedProviderId) {
      lookupIds.push(rawProviderId);
    }

    for (const id of lookupIds) {
      providerRecord = getProviderMangaByProviderId(resolvedProvider, id);
      if (providerRecord) break;
    }

    if (!providerRecord) {
      let details = null;

      if (body.title || body.image || body.status || body.rating) {
        details = {
          title: body.title?.trim() || normalizedProviderId,
          image: body.image,
          status: body.status,
          rating: body.rating,
        };
      } else {
        try {
          details = await scraper.getSeriesDetails(normalizedProviderId, resolvedProvider);
        } catch (error) {
          details = {
            title: normalizedProviderId,
            image: null,
            status: null,
            rating: null,
          };
        }
      }

      providerRecord = upsertProviderManga(
        toProviderInput(resolvedProvider, normalizedProviderId, details),
      );
    }
  }

  if (!providerRecord) {
    if (normalizedProviderId) {
      try {
        const fallbackTitle = body.title?.trim() || normalizedProviderId;
        const db = getDatabase();
        db.prepare(
          `INSERT OR IGNORE INTO provider_manga (
            provider,
            provider_id,
            title,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, unixepoch(), unixepoch())`,
        ).run(resolvedProvider, normalizedProviderId, fallbackTitle);

        providerRecord = getProviderMangaByProviderId(resolvedProvider, normalizedProviderId);
      } catch (error) {
        console.warn('Failed to create fallback provider record:', error);
      }
    }
  }

  if (!providerRecord) {
    return jsonError(
      c,
      {
        code: 'PROVIDER_NOT_FOUND',
        message: 'Provider series not found',
        details: {
          provider: resolvedProvider,
          providerId: normalizedProviderId ?? rawProviderId ?? null,
        },
      },
      404,
    );
  }

  const auth = c.get('auth');
  await ensureAnilistRecord(anilistId, auth?.anilistToken, body.title);

  const mapping = setActiveMapping(anilistId, resolvedProvider, providerRecord.id, 'manual');
  return jsonSuccess(c, { mapping, provider: providerRecord });
});

const providersRoute = createRoute({
  method: 'get',
  path: '/{id}/providers',
  tags: ['manga'],
  request: {
    params: z.object({
      id: z.coerce.number().int(),
    }),
  },
  responses: {
    200: {
      description: 'Provider mappings',
      content: {
        'application/json': {
          schema: ApiSuccessUnknownSchema,
        },
      },
    },
    default: errorResponse,
  },
});

manga.openapi(providersRoute, (c) => {
  const { id } = c.req.valid('param');
  const anilistId = Number(id);
  if (Number.isNaN(anilistId)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Manga id must be a number' }, 400);
  }

  const mappings = listProviderMappings(anilistId);
  return jsonSuccess(c, mappings);
});

export default manga;
