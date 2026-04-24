import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '../../../generated/prisma/client.js';
import { PrismaModule } from './prisma.module.js';

const createPrismaClientMock = () => ({
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $queryRaw: vi.fn().mockResolvedValue([
    {
      tableName: 'user',
      columnName: 'id',
    },
    {
      tableName: 'user',
      columnName: 'email',
    },
    {
      tableName: 'user',
      columnName: 'email_verified',
    },
    {
      tableName: 'session',
      columnName: 'id',
    },
    {
      tableName: 'session',
      columnName: 'token',
    },
    {
      tableName: 'session',
      columnName: 'user_id',
    },
    {
      tableName: 'session',
      columnName: 'expires_at',
    },
    {
      tableName: 'account',
      columnName: 'id',
    },
    {
      tableName: 'account',
      columnName: 'account_id',
    },
    {
      tableName: 'account',
      columnName: 'provider_id',
    },
    {
      tableName: 'account',
      columnName: 'user_id',
    },
    {
      tableName: 'account',
      columnName: 'access_token',
    },
    {
      tableName: 'verification',
      columnName: 'id',
    },
    {
      tableName: 'verification',
      columnName: 'identifier',
    },
    {
      tableName: 'verification',
      columnName: 'value',
    },
    {
      tableName: 'verification',
      columnName: 'expires_at',
    },
  ]),
});

describe('PrismaModule', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('connects and verifies database query readiness on module init', async () => {
    const prisma = createPrismaClientMock();
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleInit()).resolves.toBeUndefined();

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith('Database ready');
  });

  it('uses the provided PrismaClient during the Nest module lifecycle', async () => {
    const prisma = createPrismaClientMock();
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule],
    })
      .overrideProvider(PrismaClient)
      .useValue(prisma)
      .compile();

    await moduleRef.init();
    await moduleRef.close();

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
    expect(prisma.$disconnect).toHaveBeenCalledOnce();
  });

  it('rejects module init when Prisma cannot connect', async () => {
    const error = new Error('database unavailable');
    const prisma = createPrismaClientMock();
    prisma.$connect.mockRejectedValueOnce(error);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleInit()).rejects.toThrow(error);

    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'Database readiness check failed',
      error.stack,
    );
  });

  it('rejects module init when the readiness query fails', async () => {
    const error = new Error('relation "user" does not exist');
    const prisma = createPrismaClientMock();
    prisma.$queryRaw.mockRejectedValueOnce(error);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleInit()).rejects.toThrow(error);

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith(
      'Database readiness check failed',
      error.stack,
    );
  });

  it('rejects module init when auth-critical schema requirements are missing', async () => {
    const prisma = createPrismaClientMock();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        tableName: 'user',
        columnName: 'id',
      },
    ]);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleInit()).rejects.toThrow(
      'Database schema is not ready: missing auth tables/columns: public.user.email, public.user.email_verified, public.session, public.account, public.verification. Run "pnpm --filter api prisma:migrate" before starting the API.',
    );

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith(
      'Database readiness check failed',
      expect.stringContaining('Database schema is not ready'),
    );
  });

  it('disconnects on module destroy', async () => {
    const prisma = createPrismaClientMock();
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleDestroy()).resolves.toBeUndefined();

    expect(prisma.$disconnect).toHaveBeenCalledOnce();
    expect(logSpy).toHaveBeenCalledWith('Disconnected from DB');
  });

  it('rejects module destroy when Prisma cannot disconnect', async () => {
    const error = new Error('disconnect failed');
    const prisma = createPrismaClientMock();
    prisma.$disconnect.mockRejectedValueOnce(error);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleDestroy()).rejects.toThrow(error);

    expect(errorSpy).toHaveBeenCalledWith(
      'Could not disconnect from DB',
      error.stack,
    );
  });
});
