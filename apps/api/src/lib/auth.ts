/**
 * -----------------------------------------------------------------------------
 * This file is meant to be used by Better Auth CLI commands.
 * It is not imported by the Nest app to avoid creating an extra Prisma client.
 *
 * The CLI points to the compiled version in `dist/` so Node resolves `.js` files
 * consistently while the source of truth stays in `src/`.
 * -----------------------------------------------------------------------------
 * */

// import { PrismaPg } from '@prisma/adapter-pg';
// import { PrismaClient } from '../generated/prisma/client.js';
// import { createAuth } from '../infrastructure/auth/create-auth.js';
import { prisma } from '../infrastructure/database/prisma/prisma.js';
import { env } from '../config/env.js';
import { betterAuth } from 'better-auth';
import { openAPI, testUtils } from 'better-auth/plugins';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import * as argon2 from 'argon2';

// const prisma = new PrismaClient({
//   adapter: new PrismaPg({
//     connectionString: env.DATABASE_URL,
//   }),
// });

export const auth = betterAuth({
  // basePath: 'auth',
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  // TODO: replace hardcoded urls with env ones
  trustedOrigins: ['http://localhost:3001', 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
    hash: async (password) => {
      return argon2.hash(password as string);
    },
    verify: async (hash, password) => {
      return argon2.verify(hash as string, password as string);
    },
  },
  plugins: [
    openAPI({ path: 'reference' }),
    testUtils(), // TODO: Put this to use in integration and E2E tests
  ],
  // TODO: add anilist oauth2 using the genericOAuth plugin
  // socialProviders: { google: { clientId: 'test', clientSecret: 'test' } },
});

const ctx = await auth.$context;
export const test = ctx.test;

export default auth;
