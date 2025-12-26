import process from 'process';
process.loadEnvFile(`.env.${process.env.NODE_ENV || 'development'}.local`);

type ServerConfig = {
  HOSTNAME: string;
  PORT: number;
  JWT_SECRET: string;
  DB_URL?: string;
};

export const serverConfig: ServerConfig = {
  HOSTNAME: process.env.HOSTNAME || '127.0.0.1',
  PORT: (process.env.PORT as unknown as number) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'jwtPlaceholder',
};
