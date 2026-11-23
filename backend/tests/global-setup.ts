import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './helpers/db';

/**
 * Prepares the disposable test database once per run: creates it when missing (connecting through
 * the maintenance database "postgres") and applies the migrations. Skipped when no database URL is
 * configured, so DB-free tests (e.g. sanity) still run; DB tests then fail with a clear message.
 */
export default async function setup(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
    console.warn('[global-setup] No TEST_DATABASE_URL/DATABASE_URL: skipping database preparation');
    return;
  }
  const url = testDatabaseUrl();
  const parsed = new URL(url);
  const dbName = parsed.pathname.slice(1);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const prisma = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbName}) AS "exists"`;
    if (!rows[0]?.exists) {
      await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
