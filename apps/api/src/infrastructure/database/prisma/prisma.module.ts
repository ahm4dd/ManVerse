import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from './prisma.js';
import { PrismaClient } from '../../../generated/prisma/client.js';

const getErrorStack = (error: unknown): string =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);

type DatabaseSchemaReadiness = {
  hasUserTable: boolean;
  hasUserIdColumn: boolean;
};

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

  constructor(private readonly prisma: PrismaClient) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.$connect();
      await this.assertSchemaReady();

      this.logger.log('Database ready');
    } catch (error) {
      this.logger.error('Database readiness check failed', getErrorStack(error));
      throw error;
    }
  }

  private async assertSchemaReady(): Promise<void> {
    const [schema] = await this.prisma.$queryRaw<DatabaseSchemaReadiness[]>`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'user'
        ) AS "hasUserTable",
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'user'
            AND column_name = 'id'
        ) AS "hasUserIdColumn"
    `;

    if (!schema?.hasUserTable || !schema.hasUserIdColumn) {
      throw new Error(
        'Database schema is not ready: required table "public.user" is missing or incomplete. Run "pnpm --filter api prisma:migrate" before starting the API.',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.prisma.$disconnect();

      this.logger.log('Disconnected from DB');
    } catch (error) {
      this.logger.error('Could not disconnect from DB', getErrorStack(error));
      throw error;
    }
  }
}
