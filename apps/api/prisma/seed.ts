import { faker } from '@faker-js/faker';
import { prisma } from '../src/infrastructure/database/prisma/prisma.js';
import { auth } from '../src/lib/auth.js';
import type { User } from '../src/generated/prisma/client.js';

const ADMIN_EMAIL = 'admin@manverse.local';
const ADMIN_NAME = 'Admin User';
const DEFAULT_PASSWORD = 'password123';
const FAKE_USER_COUNT = 20;

type SeedUserInput = {
  email: string;
  name: string;
};

async function signUpAndLoadUser({
  email,
  name,
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
      password: DEFAULT_PASSWORD,
      name,
    },
  });

  const createdUser = await prisma.user.findUniqueOrThrow({
    where: { email: normalizedEmail },
  });

  return { created: true, user: createdUser };
}

async function main() {
  console.log('Starting Native Auth seed...\n');

  // ==========================================
  // 1. THE ANCHOR USER (Admin)
  // ==========================================
  const adminResult = await signUpAndLoadUser({
    email: ADMIN_EMAIL,
    name: ADMIN_NAME,
  });

  if (adminResult.created) {
    console.log(`Creating Anchor User: ${ADMIN_EMAIL}...`);
    console.log('Anchor User created!');
  } else {
    console.log(`Anchor User already exists. Skipping.`);
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
    process.exit(1);
  });
