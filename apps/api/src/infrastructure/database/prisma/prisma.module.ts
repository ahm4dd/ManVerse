import { Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { prisma } from './prisma.js';
import { PrismaClient } from '../../../generated/prisma/client.js';

const getErrorStack = (error: unknown): string =>
  error instanceof Error ? (error.stack ?? error.message) : String(error);

type DatabaseSchemaReadiness = {
  tableName: string;
  columnName: string;
};

const AUTH_CRITICAL_TABLE_COLUMNS = {
  user: ['id', 'email', 'email_verified'],
  session: ['id', 'token', 'user_id', 'expires_at'],
  account: ['id', 'account_id', 'provider_id', 'user_id', 'access_token'],
  verification: ['id', 'identifier', 'value', 'expires_at'],
} as const;

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
      this.logger.error(
        'Database readiness check failed',
        getErrorStack(error),
      );
      throw error;
    }
  }

  private async assertSchemaReady(): Promise<void> {
    const schema = await this.prisma.$queryRaw<DatabaseSchemaReadiness[]>`
      SELECT
        table_name AS "tableName",
        column_name AS "columnName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('user', 'session', 'account', 'verification')
    `;

    const columnsByTable = new Map<string, Set<string>>();

    for (const entry of schema) {
      const tableColumns = columnsByTable.get(entry.tableName) ?? new Set();
      tableColumns.add(entry.columnName);
      columnsByTable.set(entry.tableName, tableColumns);
    }

    const missingRequirements: string[] = [];

    for (const [tableName, requiredColumns] of Object.entries(
      AUTH_CRITICAL_TABLE_COLUMNS,
    )) {
      const availableColumns = columnsByTable.get(tableName);

      if (!availableColumns) {
        missingRequirements.push(`public.${tableName}`);
        continue;
      }

      for (const columnName of requiredColumns) {
        if (!availableColumns.has(columnName)) {
          missingRequirements.push(`public.${tableName}.${columnName}`);
        }
      }
    }

    if (missingRequirements.length > 0) {
      throw new Error(
        `Database schema is not ready: missing auth tables/columns: ${missingRequirements.join(', ')}. Run "pnpm --filter api prisma:migrate" before starting the API.`,
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
