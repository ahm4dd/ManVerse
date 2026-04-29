import type { GraphQLError } from '../types/httpclient.js';

export class HTTPClientError extends Error {
  constructor(
    message: string = 'An error occurred at the HTTPClient layer for Anilist',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientError';
  }
}

export class HTTPClientTransportError extends HTTPClientError {
  constructor(
    message: string = 'The AniList HTTP request failed before receiving a response',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientTransportError';
  }
}

export class HTTPClientAbortError extends HTTPClientTransportError {
  constructor(
    message: string = 'The AniList HTTP request was aborted',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientAbortError';
  }
}

export class HTTPClientTimeoutError extends HTTPClientAbortError {
  constructor(
    message: string = 'The AniList HTTP request timed out',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientTimeoutError';
  }
}

export class HTTPClientResponseError extends HTTPClientError {
  readonly status: number;
  readonly statusText: string;
  readonly responseBody: string | null;

  constructor(
    status: number,
    statusText: string,
    responseBody: string | null,
    message: string = `GraphQL request failed with status ${status} ${statusText}`,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientResponseError';
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export class HTTPClientInvalidJSONError extends HTTPClientError {
  constructor(
    message: string = 'The AniList HTTP response could not be parsed as JSON',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientInvalidJSONError';
  }
}

export class HTTPClientGraphQLError extends HTTPClientError {
  readonly errors: GraphQLError[];

  constructor(
    errors: GraphQLError[],
    message: string = 'The AniList GraphQL response contained errors',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientGraphQLError';
    this.errors = errors;
  }
}

export class HTTPClientMissingDataError extends HTTPClientError {
  constructor(
    message: string = 'The AniList GraphQL response completed without data',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientMissingDataError';
  }
}

export class AnilistClientAuthError extends Error {
  constructor(
    message: string = 'This AniList operation requires an access token',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AnilistClientAuthError';
  }
}
