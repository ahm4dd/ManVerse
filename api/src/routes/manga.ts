import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { jsonError, jsonSuccess } from '../utils/response.ts';
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
import { ApiErrorSchema, ApiSuccessUnknownSchema } from '../openapi/schemas.ts';
import { openApiHook } from '../openapi/hook.ts';

const manga = new OpenAPIHono<HonoEnv>({ defaultHook: openApiHook });
const service = new MangaService();
const scraper = new ScraperService();

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
