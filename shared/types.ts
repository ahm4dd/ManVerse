export interface ApiMeta {
  timestamp: number;
  requestId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export interface AuthUser {
  id: number | null;
  username?: string;
  isGuest?: boolean;
  anilistToken?: string;
}
