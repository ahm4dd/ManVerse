import auth from '../../src/lib/auth.js';

const ctx = await auth.$context;

if (!ctx.test) {
  throw new Error('Better Auth test utilities are only available in test mode');
}

export const authTest = ctx.test;
