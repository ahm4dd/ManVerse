import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from './prisma.js';
import { PrismaClient } from '../../../generated/prisma/client.js';

@Module({
  providers: [
    {
      provide: PrismaClient,
      // Use the single exported instance
      useValue: prisma,
    },
  ],
  exports: [PrismaClient],
})
export class PrismaModule implements OnModuleInit, OnModuleDestroy {
  readonly logger = new Logger(PrismaModule.name);

  async onModuleInit() {
    await prisma
      .$connect()
      .then(() => this.logger.log('Connected to DB'))
      .catch(() => this.logger.error('Could not connect to DB'));
  }

  async onModuleDestroy() {
    await prisma
      .$disconnect()
      .then(() => this.logger.log('Disconnected from DB'))
      .catch(() => this.logger.error('Could not disconnect from DB'));
  }
}
