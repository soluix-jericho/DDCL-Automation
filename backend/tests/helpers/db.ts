import { PrismaClient } from '@prisma/client';

/**
 * URL of the disposable test database. Comes from TEST_DATABASE_URL (preferred) or DATABASE_URL,
 * i.e. from `.env` or CI variables, never from code. Tests truncate tables, so the database name
 * must contain "test" or the helper refuses to run (protects real data).
 */
export function testDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.TEST_DATABASE_URL ?? env.DATABASE_URL;
  if (!url) {
    throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) to a disposable test PostgreSQL database');
  }
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) {
    throw new Error(`Refusing to run tests against database "${dbName}": its name must contain "test"`);
  }
  return url;
}

export function createTestPrisma(): PrismaClient {
  return new PrismaClient({ datasources: { db: { url: testDatabaseUrl() } } });
}

/** Empties every table so each test starts from a clean state. */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "ChecklistItem", "ReleaseHeader", "DdclDocument", "BundleForwardMember", "BundleRollbackMember", "StepBundle", "StepAttachment", "StepLine", "StepColumn", "Step" RESTART IDENTITY CASCADE',
  );
}

/** A client whose database is unreachable, used to simulate connection failure (BR1.5). */
export function createUnreachablePrisma(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: 'postgresql://nobody:nopass@127.0.0.1:1/none?connect_timeout=2' } },
  });
}
