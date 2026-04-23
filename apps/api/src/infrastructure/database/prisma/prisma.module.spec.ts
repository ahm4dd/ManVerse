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
      hasUserTable: true,
      hasUserIdColumn: true,
    },
  ]),
});

describe('PrismaModule', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
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
    expect(Logger.prototype.log).toHaveBeenCalledWith('Database ready');
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
    expect(Logger.prototype.error).toHaveBeenCalledWith(
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
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Database readiness check failed',
      error.stack,
    );
  });

  it('rejects module init when the required user table is missing', async () => {
    const prisma = createPrismaClientMock();
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        hasUserTable: false,
        hasUserIdColumn: false,
      },
    ]);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleInit()).rejects.toThrow(
      'Database schema is not ready: required table "public.user" is missing or incomplete. Run "pnpm --filter api prisma:migrate" before starting the API.',
    );

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Database readiness check failed',
      expect.stringContaining('Database schema is not ready'),
    );
  });

  it('disconnects on module destroy', async () => {
    const prisma = createPrismaClientMock();
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleDestroy()).resolves.toBeUndefined();

    expect(prisma.$disconnect).toHaveBeenCalledOnce();
    expect(Logger.prototype.log).toHaveBeenCalledWith('Disconnected from DB');
  });

  it('rejects module destroy when Prisma cannot disconnect', async () => {
    const error = new Error('disconnect failed');
    const prisma = createPrismaClientMock();
    prisma.$disconnect.mockRejectedValueOnce(error);
    const moduleRef = new PrismaModule(prisma as unknown as PrismaClient);

    await expect(moduleRef.onModuleDestroy()).rejects.toThrow(error);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Could not disconnect from DB',
      error.stack,
    );
  });
});
