import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnilistController } from './anilist.controller.js';
import { AnilistClient } from '@manverse/anilist-client';
import { AnilistAccountService } from './anilist-account.service.js';

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
  providers: [
    ThrottlerGuard,
    AnilistAccountService,
    {
      provide: 'ANILIST_CLIENT',
      useFactory: (): AnilistClient => new AnilistClient(),
    },
  ],
})
export class AnilistModule {}
