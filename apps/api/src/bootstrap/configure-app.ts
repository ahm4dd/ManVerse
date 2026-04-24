import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { env, type EnvironmentVariables } from '../config/env.js';

export function configureApp(
  app: NestExpressApplication,
  appEnv: EnvironmentVariables = env,
) {
  app.setGlobalPrefix('/api');

  if (appEnv.TRUST_PROXY !== undefined && appEnv.TRUST_PROXY !== false) {
    app.set('trust proxy', appEnv.TRUST_PROXY);
  }

  if (appEnv.TRUSTED_ORIGINS.length > 0) {
    app.enableCors({
      origin: appEnv.TRUSTED_ORIGINS,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });
  }

  app.set('query parser', 'extended');
  app.enableVersioning({ type: VersioningType.URI });
}
