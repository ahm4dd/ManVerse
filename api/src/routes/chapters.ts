import { Hono } from 'hono';
import { z } from 'zod';
import { jsonError, jsonSuccess } from '../utils/response.ts';
import type { HonoEnv } from '../types/api.ts';
import { ScraperService } from '../services/scraper-service.ts';
import { parseQuery } from '../utils/validation.ts';
import { Providers } from '@manverse/core';

const chapters = new Hono<HonoEnv>();
const scraper = new ScraperService();

const querySchema = z.object({
  provider: z.string().optional(),
  url: z.string().optional(),
});

const imageSchema = z.object({
  url: z.string().url(),
  referer: z.string().url().optional(),
});

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  try {
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf-8');
  } catch {
    return '';
  }
}

chapters.get('/image', async (c) => {
  const { url, referer } = parseQuery(c, imageSchema);
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return jsonError(c, { code: 'INVALID_URL', message: 'Invalid image url protocol' }, 400);
  }

  if (!parsed.hostname.endsWith('asuracomic.net')) {
    return jsonError(c, { code: 'INVALID_HOST', message: 'Image host is not allowed' }, 400);
  }

  if (referer) {
    const refererHost = new URL(referer).hostname;
    if (!refererHost.endsWith('asuracomic.net')) {
      return jsonError(c, { code: 'INVALID_REFERER', message: 'Invalid referer host' }, 400);
    }
  }

  const headers = new Headers();
  if (referer) {
    headers.set('Referer', referer);
  }
  headers.set(
    'User-Agent',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  );

  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (error) {
    return jsonError(
      c,
      {
        code: 'IMAGE_FETCH_FAILED',
        message: error instanceof Error ? error.message : 'Failed to fetch image',
      },
      502,
    );
  }

  if (!response.ok || !response.body) {
    return jsonError(
      c,
      { code: 'IMAGE_FETCH_FAILED', message: `Failed to fetch image (${response.status})` },
      502,
    );
  }

  const responseHeaders = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) {
    responseHeaders.set('Content-Type', contentType);
  }
  responseHeaders.set('Cache-Control', 'public, max-age=3600');

  return new Response(response.body, {
    status: 200,
    headers: responseHeaders,
  });
});

chapters.get('/:id', (c) => {
  const { provider, url } = parseQuery(c, querySchema);
  const providerId =
    provider && Object.values(Providers).includes(provider as (typeof Providers)[keyof typeof Providers])
      ? (provider as (typeof Providers)[keyof typeof Providers])
      : Providers.AsuraScans;

  const chapterId = c.req.param('id');
  const resolvedUrl = url || decodeBase64Url(chapterId);

  if (!resolvedUrl) {
    return jsonError(c, { code: 'INVALID_CHAPTER', message: 'Chapter url is required' }, 400);
  }

  return scraper
    .getChapterImages(resolvedUrl, providerId)
    .then((pages) => jsonSuccess(c, pages))
    .catch((error) =>
      jsonError(
        c,
        {
          code: 'CHAPTER_FETCH_FAILED',
          message: error instanceof Error ? error.message : 'Unable to fetch chapter images',
        },
        502,
      ),
    );
});

export default chapters;
