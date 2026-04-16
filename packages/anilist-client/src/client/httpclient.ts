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

  private stringifyQuery(query: GraphQLRequestOptions['query']): string {
    return typeof query === 'string' ? query : print(query);
  }

  private buildRequestHeaders(
    accessToken: string | undefined,
    headers: HTTPHeaders,
  ): HTTPHeaders {
    return {
      ...this.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    };
  }

  private buildRequestBody(
    printableQuery: string,
    operationName: string | undefined,
    variables: GraphQLRequestOptions['variables'],
  ): string {
    return JSON.stringify({
      query: printableQuery,
      variables,
      operationName,
    });
  }

  private createRequestLifecycle(
    signal: AbortSignal | undefined,
    timeoutMs: number,
  ) {
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

    return {
      requestSignal,
      didTimeOut: () => timedOut,
      clearTimeout: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      },
    };
  }

  private logRequestStart(
    operationName: string | undefined,
    timeoutMs: number,
  ): void {
    this.logger?.debug?.('AniList GraphQL request started', {
      endpoint: this.endpoint,
      operationName,
      timeoutMs,
    });
  }

  private classifyTransportError(
    err: unknown,
    requestSignal: AbortSignal | undefined,
    operationName: string | undefined,
    timeoutMs: number,
    timedOut: boolean,
  ): never {
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
  }

  private async executeRequest(
    requestBody: string,
    requestHeaders: HTTPHeaders,
    requestSignal: AbortSignal | undefined,
    operationName: string | undefined,
    timeoutMs: number,
    didTimeOut: () => boolean,
  ): Promise<Response> {
    try {
      return await this.fetchImpl(this.endpoint, {
        method: 'POST',
        body: requestBody,
        headers: requestHeaders,
        signal: requestSignal,
      });
    } catch (err: unknown) {
      this.classifyTransportError(
        err,
        requestSignal,
        operationName,
        timeoutMs,
        didTimeOut(),
      );
    }
  }

  private async throwForNonOkResponse(
    response: Response,
    operationName: string | undefined,
  ): Promise<never> {
    const responseBody = await response.text().catch(() => '');

    this.logger?.warn?.('AniList GraphQL request returned a non-ok response', {
      endpoint: this.endpoint,
      operationName,
      status: response.status,
      statusText: response.statusText,
    });

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

  private async parseResponsePayload<TData>(
    response: Response,
    operationName: string | undefined,
  ): Promise<GraphQLResponse<TData>> {
    try {
      return (await response.json()) as GraphQLResponse<TData>;
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
  }

  private extractResponseData<TData>(
    payload: GraphQLResponse<TData>,
    operationName: string | undefined,
  ): TData {
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

    return payload.data as TData;
  }

  private logRequestCompletion(
    operationName: string | undefined,
    status: number,
  ): void {
    this.logger?.debug?.('AniList GraphQL request completed', {
      endpoint: this.endpoint,
      operationName,
      status,
    });
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
    const printableQuery = this.stringifyQuery(query);
    const requestHeaders = this.buildRequestHeaders(accessToken, headers);
    const requestBody = this.buildRequestBody(
      printableQuery,
      operationName,
      variables,
    );
    const requestLifecycle = this.createRequestLifecycle(signal, timeoutMs);

    this.logRequestStart(operationName, timeoutMs);

    let response: Response;

    try {
      response = await this.executeRequest(
        requestBody,
        requestHeaders,
        requestLifecycle.requestSignal,
        operationName,
        timeoutMs,
        requestLifecycle.didTimeOut,
      );
    } finally {
      requestLifecycle.clearTimeout();
    }

    if (!response.ok) {
      await this.throwForNonOkResponse(response, operationName);
    }

    const payload = await this.parseResponsePayload<TData>(
      response,
      operationName,
    );
    const data = this.extractResponseData(payload, operationName);

    this.logRequestCompletion(operationName, response.status);

    return data;
  }
}
