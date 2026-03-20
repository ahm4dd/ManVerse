import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  readonly logger = new Logger(PrismaService.name);

  onModuleInit() {
    this.$connect()
      .then(() => this.logger.log('Connected to DB'))
      .catch(() => this.logger.error('Could not connect to DB'));
  }

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL as string,
    });
    super({ adapter });
  }
}
