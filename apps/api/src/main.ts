import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { configureApp } from './bootstrap/configure-app.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NestExpressApplication } from '@nestjs/platform-express';
import { apiReference } from '@scalar/nestjs-api-reference';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // The library (Better-auth) will re-add the default body parses for non-auth routes.
    bodyParser: false,
  });
  configureApp(app);

  const config = new DocumentBuilder()
    .setTitle('ManVerse example')
    .setDescription('The ManVerse API description')
    .setVersion('1.0')
    .addTag('ManVerse')
    .build();

  const rawOpenApiDoc = SwaggerModule.createDocument(app, config);
  const openApiDoc = cleanupOpenApiDoc(rawOpenApiDoc, { version: 'auto' });

  app.use(
    '/reference',
    apiReference({
      pageTitle: 'ManVerse API Reference',
      content: openApiDoc,
    }),
  );

  await app.listen(env.PORT);
}

void bootstrap();
