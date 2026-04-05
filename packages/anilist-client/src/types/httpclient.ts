import type { AnilistClientLogger } from './logger.js';

export type HTTPHeaders = Record<string, string>;

export type GraphQLVariables = Record<string, unknown>;
export type GraphQLError = {
  message: string;
} & Record<string, unknown>;

export type HTTPConfig = {
  endpoint?: string;
  headers?: HTTPHeaders;
  logger?: AnilistClientLogger;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type ResolvedHTTPConfig = HTTPConfig & {
  endpoint: string;
  timeoutMs: number;
};

export type GraphQLRequestOptions = {
  query: string;
  operationName?: string;
  variables?: GraphQLVariables;
  accessToken?: string;
  headers?: HTTPHeaders;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type GraphQLExecutor = {
  req<TData>(options: GraphQLRequestOptions): Promise<TData>;
};

export type GraphQLResponse<TData> = {
  data?: TData;
  errors?: GraphQLError[];
};
