import { randomBytes } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { env } from '../src/config/env.js';
import { prisma } from '../src/infrastructure/database/prisma/prisma.js';
import { auth } from '../src/lib/auth.js';
import type { User } from '../src/generated/prisma/client.js';

const ADMIN_EMAIL = 'admin@manverse.local';
const ADMIN_NAME = 'Admin User';
const FAKE_USER_COUNT = 20;
const SEED_ADMIN_PASSWORD_ENV = 'SEED_ADMIN_PASSWORD';
const MIN_SEED_PASSWORD_LENGTH = 12;
const LOCAL_DATABASE_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

type SeedUserInput = {
  email: string;
  name: string;
  password: string;
};

async function signUpAndLoadUser({
  email,
  name,
  password,
}: SeedUserInput): Promise<{ created: boolean; user: User }> {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return { created: false, user: existingUser };
  }

  await auth.api.signUpEmail({
    body: {
      email: normalizedEmail,
      password,
      name,
    },
  });

  const createdUser = await prisma.user.findUniqueOrThrow({
    where: { email: normalizedEmail },
  });

  return { created: true, user: createdUser };
}

function assertSafeSeedTarget() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed while NODE_ENV is production.');
  }

  const databaseUrl = new URL(env.DATABASE_URL);

  if (!LOCAL_DATABASE_HOSTNAMES.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error(
      `Refusing to seed non-local database host "${databaseUrl.hostname}". Use a local development database for seeding.`,
    );
  }
}

function generateSeedPassword(): string {
  return randomBytes(24).toString('base64url');
}

function getConfiguredAdminPassword(): string | undefined {
  const password = process.env[SEED_ADMIN_PASSWORD_ENV]?.trim();

  if (!password) {
    return undefined;
  }

  if (password.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `${SEED_ADMIN_PASSWORD_ENV} must be at least ${MIN_SEED_PASSWORD_LENGTH} characters long.`,
    );
  }

  return password;
}

async function main() {
  assertSafeSeedTarget();

  console.log('Starting Native Auth seed...\n');

  const configuredAdminPassword = getConfiguredAdminPassword();
  const adminPassword = configuredAdminPassword ?? generateSeedPassword();

  // ==========================================
  // 1. THE ANCHOR USER (Admin)
  // ==========================================
  const adminResult = await signUpAndLoadUser({
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
    password: adminPassword,
  });

  if (adminResult.created) {
    console.log(`Creating Anchor User: ${ADMIN_EMAIL}...`);
    console.log('Anchor User created!');

    if (!configuredAdminPassword) {
      console.log(`Generated local admin password: ${adminPassword}`);
      console.log(
        `Set ${SEED_ADMIN_PASSWORD_ENV} to choose a stable local password for future seed runs.`,
      );
    }
  } else {
    console.log(`Anchor User already exists. Skipping password changes.`);
  }

  // Keep the anchor account usable in local development.
  await prisma.user.update({
    where: { id: adminResult.user.id },
    data: { emailVerified: true },
  });

  // ==========================================
  // 2. THE VOLUME DATA (Fake Users)
  // ==========================================
  console.log(`\nGenerating ${FAKE_USER_COUNT} fake users...`);

  let createdCount = 0;

  for (let i = 0; i < FAKE_USER_COUNT; i++) {
    const fakeEmail = faker.internet.email().toLowerCase();

    try {
      const fakeUserResult = await signUpAndLoadUser({
        email: fakeEmail,
        name: faker.person.fullName(),
        password: generateSeedPassword(),
      });

      if (!fakeUserResult.created) {
        continue;
      }

      // Update avatar after signup, since signUpEmail doesn't accept it here.
      await prisma.user.update({
        where: { id: fakeUserResult.user.id },
        data: {
          image: faker.image.avatar(),
          emailVerified: faker.datatype.boolean(0.8),
        },
      });

      createdCount++;
    } catch (error) {
      console.error(`Failed to create ${fakeEmail}:`, error);
    }
  }

  console.log(`Created ${createdCount} volume users.`);
  console.log('\nDatabase seeding completed successfully.');
}

// Execute safely
main()
  .catch((error) => {
    console.error('Database seeding failed:\n', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
