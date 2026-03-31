export class HTTPClientError extends Error {
  constructor(
    message: string = 'An error occurred at the HTTPClient layer for Anilist',
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HTTPClientError';
  }
}

export class HTTPClientAbortError extends HTTPClientError {
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
