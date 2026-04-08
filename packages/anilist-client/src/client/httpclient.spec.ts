import { gql } from '@apollo/client/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
  DEFAULT_HTTP_HEADERS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '../constants/http.js';
import type { ResolvedHTTPConfig } from '../types/httpclient.js';
import { HTTPClient } from './httpclient.js';

describe('HTTPClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let httpclient: HTTPClient;

  beforeEach(() => {
    fetchMock = vi.fn();

    const config: ResolvedHTTPConfig = {
      endpoint: DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
      timeoutMs: DEFAULT_HTTP_TIMEOUT_MS,
      headers: {
        ...DEFAULT_HTTP_HEADERS,
      },
      fetch: fetchMock as typeof fetch,
      logger: undefined,
    };

    httpclient = new HTTPClient(config);
  });

  it('should send a POST request to the configured endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { Media: { id: 1 } },
      }),
    });

    const result = await httpclient.req<{ Media: { id: number } }>({
      query: 'query Test { Media { id } }',
      operationName: 'Test',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        headers: DEFAULT_HTTP_HEADERS,
        body: JSON.stringify({
          query: 'query Test { Media { id } }',
          variables: undefined,
          operationName: 'Test',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result).toEqual({ Media: { id: 1 } });
  });

  it('should print a gql document before sending the request body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { Viewer: { id: 1 } },
      }),
    });

    const query = gql`
      query ViewerProfile {
        Viewer {
          id
        }
      }
    `;

    await httpclient.req<{ Viewer: { id: number } }>({
      query,
      operationName: 'ViewerProfile',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        body: JSON.stringify({
          query: 'query ViewerProfile {\n  Viewer {\n    id\n  }\n}',
          variables: undefined,
          operationName: 'ViewerProfile',
        }),
      }),
    );
  });

  it('should merge auth and request headers with default headers', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { Media: { id: 99 } },
      }),
    });

    await httpclient.req({
      query: 'query Viewer { Viewer { id } }',
      accessToken: 'session-token',
      headers: {
        Accept: 'application/graphql-response+json',
        'X-Trace-Id': 'trace-123',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
      expect.objectContaining({
        headers: {
          ...DEFAULT_HTTP_HEADERS,
          Authorization: 'Bearer session-token',
          Accept: 'application/graphql-response+json',
          'X-Trace-Id': 'trace-123',
        },
      }),
    );
  });
});
