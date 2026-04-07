import { Module } from '@nestjs/common';
import { AnilistController } from './anilist.controller.js';
import { AnilistClient } from '@manverse/anilist-client';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AnilistController],
  providers: [
    { provide: 'ANILIST_CLIENT', useFactory: () => new AnilistClient() },
  ],
})
export class AnilistModule {}
