import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { configureApp } from './bootstrap/configure-app.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';
import {
  BETTER_AUTH_SESSION_COOKIE_NAME,
  BETTER_AUTH_SESSION_SECURITY_SCHEME,
} from './common/decorators/api-session-auth.decorator.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The library (Better-auth) will re-add the default body parses for non-auth routes.
    bodyParser: false,
  });
  app.enableShutdownHooks();
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('ManVerse example')
    .setDescription(
      [
        'The ManVerse API description.',
        '',
        'Protected application endpoints use cookie-session authentication only.',
        `Send the Better Auth session cookie \`${BETTER_AUTH_SESSION_COOKIE_NAME}\` to access protected routes.`,
        'Create and manage sessions through the Better Auth endpoints under `/api/auth/*`.',
        'Better Auth route documentation lives separately at `/api/auth/reference`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addTag('ManVerse')
    .addCookieAuth(
      BETTER_AUTH_SESSION_COOKIE_NAME,
      {
        type: 'apiKey',
        in: 'cookie',
        name: BETTER_AUTH_SESSION_COOKIE_NAME,
      },
      BETTER_AUTH_SESSION_SECURITY_SCHEME,
    )
    .build();

  const rawOpenApiDoc = SwaggerModule.createDocument(app, config);
  const openApiDoc = cleanupOpenApiDoc(rawOpenApiDoc, { version: 'auto' });

  app.use(
    '/reference',
    apiReference({
      pageTitle: 'ManVerse API Reference',
      content: openApiDoc,
      theme: 'deepSpace',
    }),
  );

  await app.listen(env.PORT);
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    'Application startup failed',
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exit(1);
});
