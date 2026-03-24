import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { VersioningType } from '@nestjs/common';
import { env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('/api');
  app.enableVersioning({ type: VersioningType.URI });
  await app.listen(env.PORT ?? 3000);
}

void bootstrap();
