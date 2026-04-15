import { print } from '@apollo/client/utilities';
import type {
  GraphQLExecutor,
  GraphQLRequestOptions,
  GraphQLResponse,
  HTTPHeaders,
  ResolvedHTTPConfig,
} from '../types/httpclient.js';
import {
  HTTPClientAbortError,
  HTTPClientGraphQLError,
  HTTPClientInvalidJSONError,
  HTTPClientMissingDataError,
  HTTPClientResponseError,
  HTTPClientTimeoutError,
  HTTPClientTransportError,
} from './errors.js';
import { isAbortError } from './utils.js';

export class HTTPClient implements GraphQLExecutor {
  private readonly endpoint: string;
  private readonly headers: HTTPHeaders;
  private readonly logger?: ResolvedHTTPConfig['logger'];
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: ResolvedHTTPConfig) {
    this.endpoint = config.endpoint;
    this.headers = { ...(config.headers ?? {}) };
    this.logger = config.logger;
    this.fetchImpl = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs;
  }

  async req<TData>({
    query,
    operationName,
    variables,
    accessToken,
    headers = {},
    signal,
    timeoutMs = this.timeoutMs,
  }: GraphQLRequestOptions): Promise<TData> {
    const printableQuery = typeof query === 'string' ? query : print(query);
    const requestHeaders: HTTPHeaders = {
      ...this.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    };
    const requestBody = JSON.stringify({
      query: printableQuery,
      variables,
      operationName,
    });
    const timeoutController = new AbortController();
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let requestSignal = signal;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        timeoutController.abort(
          new Error(`Request timed out after ${timeoutMs}ms`),
        );
      }, timeoutMs);
    }

    if (signal) {
      requestSignal = AbortSignal.any([signal, timeoutController.signal]);
    } else if (timeoutMs > 0) {
      requestSignal = timeoutController.signal;
    }

    this.logger?.debug?.('AniList GraphQL request started', {
      endpoint: this.endpoint,
      operationName,
      timeoutMs,
    });

    let response: Response;

    try {
      response = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        body: requestBody,
        headers: requestHeaders,
        signal: requestSignal,
      });
    } catch (err: unknown) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (timedOut) {
        this.logger?.warn?.('AniList GraphQL request timed out', {
          endpoint: this.endpoint,
          operationName,
          timeoutMs,
        });

        throw new HTTPClientTimeoutError(
          `GraphQL request to ${this.endpoint} timed out after ${timeoutMs}ms`,
          { cause: err },
        );
      }

      if (isAbortError(err) || requestSignal?.aborted) {
        this.logger?.warn?.('AniList GraphQL request was aborted', {
          endpoint: this.endpoint,
          operationName,
        });

        throw new HTTPClientAbortError(
          `GraphQL request to ${this.endpoint} was aborted`,
          { cause: err },
        );
      }

      this.logger?.error?.('AniList GraphQL request failed before response', {
        endpoint: this.endpoint,
        operationName,
        err,
      });

      throw new HTTPClientTransportError(
        `Could not perform GraphQL request to ${this.endpoint} at the ${HTTPClient.name} layer`,
        { cause: err },
      );
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');

      this.logger?.warn?.(
        'AniList GraphQL request returned a non-ok response',
        {
          endpoint: this.endpoint,
          operationName,
          status: response.status,
          statusText: response.statusText,
        },
      );

      throw new HTTPClientResponseError(
        response.status,
        response.statusText,
        responseBody || null,
        `GraphQL request to ${this.endpoint} failed with status ${response.status} ${response.statusText}`,
        {
          cause: new Error(responseBody || 'Response body could not be read'),
        },
      );
    }

    let payload: GraphQLResponse<TData>;

    try {
      payload = (await response.json()) as GraphQLResponse<TData>;
    } catch (err: unknown) {
      this.logger?.error?.(
        'AniList GraphQL response could not be parsed as JSON',
        {
          endpoint: this.endpoint,
          operationName,
          status: response.status,
          err,
        },
      );

      throw new HTTPClientInvalidJSONError(
        `Response from ${this.endpoint} could not be parsed as JSON`,
        { cause: err },
      );
    }

    if (payload.errors?.length) {
      this.logger?.warn?.('AniList GraphQL response contained errors', {
        endpoint: this.endpoint,
        operationName,
        errors: payload.errors,
      });

      throw new HTTPClientGraphQLError(
        payload.errors,
        `GraphQL request to ${this.endpoint} returned errors`,
        {
          cause: new Error(JSON.stringify(payload.errors)),
        },
      );
    }

    if (typeof payload.data === 'undefined') {
      this.logger?.warn?.('AniList GraphQL response did not include data', {
        endpoint: this.endpoint,
        operationName,
      });

      throw new HTTPClientMissingDataError(
        `GraphQL request to ${this.endpoint} completed without data`,
      );
    }

    this.logger?.debug?.('AniList GraphQL request completed', {
      endpoint: this.endpoint,
      operationName,
      status: response.status,
    });

    return payload.data as TData;
  }
}
