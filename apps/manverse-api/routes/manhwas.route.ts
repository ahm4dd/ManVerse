import { type Context, Hono } from 'hono';
import { JobType } from '@manverse/core';
import { publishJob, getJobStatus } from '../queue/publisher.ts';

const app = new Hono();

/**
 * Search for manhwas
 * GET /manhwas/search?q=...&page=...
 * GET /manhwas/?q=... (Legacy support)
 */
const handleSearch = async (c: Context) => {
  const searchTerm = c.req.query('q');
  const page = c.req.query('page');

  if (!searchTerm) {
    return c.json({ error: 'Search term is required' }, 400);
  }

  try {
    const jobId = await publishJob({
      type: JobType.SCRAPE_SEARCH,
      data: {
        searchTerm: searchTerm,
        page: parseInt(page || '1') || 1,
        provider: 'asuraScans',
      },
    });

    return c.json({ jobId });
  } catch (error) {
    console.error('Search failed:', error);
    return c.json({ error: 'Failed to queue search job' }, 500);
  }
};

app.get('/search', handleSearch);
app.get('/', handleSearch);

/**
 * Get manhwa details
 * GET /manhwas/details?url=...
 */
app.get('/details', async (c) => {
  const url = c.req.query('url');

  if (!url) {
    return c.json({ error: 'URL is required' }, 400);
  }

  try {
    const jobId = await publishJob({
      type: JobType.SCRAPE_MANHWA,
      data: {
        manhwaUrl: url,
        provider: 'asuraScans',
      },
    });

    return c.json({ jobId });
  } catch (error) {
    console.error('Fetch details failed:', error);
    return c.json({ error: 'Failed to queue fetch details job' }, 500);
  }
});

/**
 * Get job status
 * GET /manhwas/jobs/:id/status?type=...
 */
app.get('/jobs/:id/status', async (c) => {
  const id = c.req.param('id');
  const type = c.req.query('type');

  if (!type) {
    return c.json({ error: 'Job type is required' }, 400);
  }

  try {
    const result = await getJobStatus(id, type as JobType);
    if (!result) {
      return c.json({ error: 'Job not found' }, 404);
    }

    return c.json(result);
  } catch (error) {
    console.error('Status check failed:', error);
    return c.json({ error: 'Failed to check job status' }, 500);
  }
});

export default app;
