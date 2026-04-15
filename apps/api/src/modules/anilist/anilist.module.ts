import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnilistController } from './anilist.controller.js';
import { AnilistClient } from '@manverse/anilist-client';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 60 seconds
        limit: 60, // 60 requests per minute per IP address according to Anilist's rate limits
      },
    ]),
  ],
  controllers: [AnilistController],
  providers: [
    ThrottlerGuard,
    {
      provide: 'ANILIST_CLIENT',
      useFactory: (): AnilistClient => new AnilistClient(),
    },
  ],
})
export class AnilistModule {}
