import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.ts';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import type { HonoEnv } from '../types/api.ts';
import { AniListService } from '../services/anilist-service.ts';
import { parseQuery } from '../utils/validation.ts';
import { MediaListStatusSchema } from '@manverse/anilist';

const anilist = new Hono<HonoEnv>();
const service = new AniListService();

const pageSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
});

const searchSchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  format: z.string().optional(),
  status: z.string().optional(),
  genre: z.string().optional(),
  country: z.string().optional(),
  sort: z.string().optional(),
});

const updateProgressSchema = z.object({
  mediaId: z.number(),
  progress: z.number(),
});

const updateStatusSchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema,
});

const updateEntrySchema = z.object({
  mediaId: z.number(),
  status: MediaListStatusSchema.optional(),
  score: z.number().optional(),
  progress: z.number().optional(),
  notes: z.string().optional(),
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

anilist.get('/me', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const user = await service.getCurrentUser({
    accessToken: auth.anilistToken,
    tokenType: 'Bearer',
    expiresIn: 0,
    expiresAt: Date.now(),
  });
  return jsonSuccess(c, user);
});

anilist.get('/search', async (c) => {
  const { query, page, format, status, genre, country, sort } = parseQuery(c, searchSchema);
  const results = await service.searchMangaWithFilters(query || '', page || 1, {
    sort: normalizeSort(sort),
    format: normalizeFormat(format),
    status: normalizeStatus(status),
    genre: genre && genre !== 'All' ? genre : undefined,
    country: normalizeCountry(country),
  });

  return jsonSuccess(c, results);
});

anilist.get('/trending', async (c) => {
  const { page } = parseQuery(c, pageSchema);
  const results = await service.getTrending(page || 1);
  return jsonSuccess(c, results);
});

anilist.get('/popular', async (c) => {
  const { page } = parseQuery(c, pageSchema);
  const results = await service.getPopular(page || 1);
  return jsonSuccess(c, results);
});

anilist.get('/top-rated', async (c) => {
  const { page } = parseQuery(c, pageSchema);
  const results = await service.getTopRated(page || 1);
  return jsonSuccess(c, results);
});

anilist.get('/media/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (Number.isNaN(id)) {
    return jsonError(c, { code: 'INVALID_ID', message: 'Media id must be a number' }, 400);
  }

  const media = await service.getMangaDetails(id);
  return jsonSuccess(c, media);
});

anilist.get('/library', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const { status } = parseQuery(c, z.object({ status: MediaListStatusSchema.optional() }));
  const library = await service.getUserLibrary(auth.id, auth.anilistToken, status);
  return jsonSuccess(c, library);
});

anilist.get('/stats', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const stats = await service.getUserStats(auth.id, auth.anilistToken);
  return jsonSuccess(c, stats);
});

anilist.get('/activity', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken || auth.id === null) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const activity = await service.getUserActivity(auth.id, auth.anilistToken);
  return jsonSuccess(c, activity);
});

anilist.get('/notifications', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const notifications = await service.getNotifications(auth.anilistToken);
  return jsonSuccess(c, notifications);
});

anilist.post('/progress', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = updateProgressSchema.parse(await c.req.json());
  const result = await service.updateProgress(auth.anilistToken, body.mediaId, body.progress);
  return jsonSuccess(c, result);
});

anilist.post('/status', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = updateStatusSchema.parse(await c.req.json());
  const result = await service.updateStatus(auth.anilistToken, body.mediaId, body.status);
  return jsonSuccess(c, result);
});

anilist.post('/entry', requireAuth, async (c) => {
  const auth = c.get('auth');
  if (!auth?.anilistToken) {
    return jsonError(
      c,
      { code: 'ANILIST_TOKEN_MISSING', message: 'AniList token not available' },
      401,
    );
  }

  const body = updateEntrySchema.parse(await c.req.json());
  const result = await service.updateEntry(auth.anilistToken, body);
  return jsonSuccess(c, result);
});

export default anilist;
