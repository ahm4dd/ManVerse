const normalizePath = (path: string) => {
  if (path === '' || path === '/') {
    return '';
  }

  return path.startsWith('/') ? path : `/${path}`;
};

export const API_PREFIX = '/api';
export const DEFAULT_API_VERSION = 'v1';
export const AUTH_PREFIX = `${API_PREFIX}/auth`;

export const apiPath = (path: string, version = DEFAULT_API_VERSION) =>
  `${API_PREFIX}/${version}${normalizePath(path)}`;

export const authPath = (path: string) =>
  `${AUTH_PREFIX}${normalizePath(path)}`;
