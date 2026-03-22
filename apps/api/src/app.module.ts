import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module.js';
import { ConfigModule } from './config/config.module.js';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import auth from './lib/auth.js';

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { enabled: true, limit: '2mb' },
        urlencoded: {
          enabled: true,
          limit: '2mb',
          extended: true,
          defaultCharset: 'utf-8',
        },
        rawBody: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
