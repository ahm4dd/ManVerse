import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { configureApp } from './bootstrap/configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(env.PORT ?? 3000);
}

void bootstrap();
