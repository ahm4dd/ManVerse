import { gql } from '@apollo/client/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ANILIST_GRAPHQL_ENDPOINT,
  DEFAULT_HTTP_HEADERS,
  DEFAULT_HTTP_TIMEOUT_MS,
} from '../constants/http.js';
import type { ResolvedHTTPConfig } from '../types/httpclient.js';
import {
  HTTPClientAbortError,
  HTTPClientGraphQLError,
  HTTPClientInvalidJSONError,
  HTTPClientMissingDataError,
  HTTPClientResponseError,
  HTTPClientTimeoutError,
  HTTPClientTransportError,
} from './errors.js';
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends a POST request to the configured endpoint', async () => {
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

  it('prints a gql document before sending the request body', async () => {
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

  it('merges auth and request headers with default headers', async () => {
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

  it('throws HTTPClientTimeoutError when the request exceeds the timeout', async () => {
    vi.useFakeTimers();

    fetchMock.mockImplementation((_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const requestPromise = httpclient.req({
      query: 'query Timeout { Viewer { id } }',
      timeoutMs: 25,
    });
    const timeoutExpectation = expect(requestPromise).rejects.toBeInstanceOf(
      HTTPClientTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(25);

    await timeoutExpectation;
  });

  it('throws HTTPClientAbortError when the caller aborts the request', async () => {
    fetchMock.mockImplementation((_url, init) => {
      const signal = init?.signal as AbortSignal | undefined;

      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const controller = new AbortController();
    const requestPromise = httpclient.req({
      query: 'query Abort { Viewer { id } }',
      signal: controller.signal,
      timeoutMs: 0,
    });

    controller.abort();

    await expect(requestPromise).rejects.toBeInstanceOf(HTTPClientAbortError);
  });

  it('throws HTTPClientTransportError for transport failures before a response', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
        timeoutMs: 0,
      }),
    ).rejects.toBeInstanceOf(HTTPClientTransportError);
  });

  it('throws HTTPClientResponseError for non-ok responses', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      text: async () => 'upstream unavailable',
    });

    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toMatchObject({
      status: 503,
      statusText: 'Service Unavailable',
      responseBody: 'upstream unavailable',
    });
    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toBeInstanceOf(HTTPClientResponseError);
  });

  it('throws HTTPClientInvalidJSONError when the response is not valid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    });

    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toBeInstanceOf(HTTPClientInvalidJSONError);
  });

  it('throws HTTPClientGraphQLError when the GraphQL payload contains errors', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: 'Forbidden' }],
      }),
    });

    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toMatchObject({
      errors: [{ message: 'Forbidden' }],
    });
    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toBeInstanceOf(HTTPClientGraphQLError);
  });

  it('throws HTTPClientMissingDataError when the GraphQL payload has no data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await expect(
      httpclient.req({
        query: 'query Viewer { Viewer { id } }',
      }),
    ).rejects.toBeInstanceOf(HTTPClientMissingDataError);
  });
});
