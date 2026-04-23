import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnilistController } from './anilist.controller.js';
import { AnilistClient } from '@manverse/anilist-client';
import { AnilistRepository } from './anilist.repository.js';
import { AnilistService } from './anilist.service.js';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 60 seconds
        limit: 60, // 60 requests per minute per IP address according to Anilist's rate limits
      },
    ]),
  ],
  controllers: [AnilistController],
  providers: [ThrottlerGuard, AnilistRepository, AnilistService, AnilistClient],
})
export class AnilistModule {}
