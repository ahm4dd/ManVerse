type ServerConfig = {
  NODE_ENV: string;
  HOSTNAME: string;
  PORT: number;
  JWT_SECRET: string;
  DB_URL?: string;
  REDIS_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
};

export const serverConfig: ServerConfig = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
  PORT: (process.env.PORT as unknown as number) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'jwtPlaceholder',
  // we need to check if it's production then we should use the redis url from the environment
  // otherwise we should have url port password host
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: (process.env.REDIS_PORT as unknown as number) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
};
