import { VersioningType } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { env } from '../config/env.js';
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix('/api');

  if (env.TRUSTED_ORIGINS.length > 0) {
    app.enableCors({
      origin: env.TRUSTED_ORIGINS,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });
  }

  app.set('query parser', 'extended');
  app.enableVersioning({ type: VersioningType.URI });
}
