import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { testDatabaseUrl } from '../helpers/db';

const MIGRATIONS = path.resolve(__dirname, '../../prisma/migrations');
const U4 = '20261127000000_u4_user_accounts';

/** psql runs the migration files as written (they hold multi-statement SQL that Prisma's raw API refuses). */
function psql(url: string, args: string[]): string {
  return execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', ...args], {
    encoding: 'utf8',
  });
}

const base = new URL(testDatabaseUrl());
base.search = '';
const scratchName = `${base.pathname.slice(1)}_mig4`;
const admin = new URL(base);
admin.pathname = '/postgres';
const scratch = new URL(base);
scratch.pathname = `/${scratchName}`;

afterAll(async () => {
  const p = new PrismaClient({ datasources: { db: { url: admin.toString() } } });
  try {
    await p.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`);
  } finally {
    await p.$disconnect();
  }
});

describe('migration 20261127000000_u4_user_accounts on a populated database', () => {
  it('turns a U1/U2-era DDCL (with createdBy) into one with createdByUserId NULL, without failing', async () => {
    psql(admin.toString(), ['-c', `DROP DATABASE IF EXISTS "${scratchName}" WITH (FORCE)`]);
    psql(admin.toString(), ['-c', `CREATE DATABASE "${scratchName}"`]);

    const earlier = readdirSync(MIGRATIONS, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name < U4)
      .map((d) => d.name)
      .sort();
    expect(earlier.length).toBeGreaterThanOrEqual(2);
    for (const dir of earlier) psql(scratch.toString(), ['-f', path.join(MIGRATIONS, dir, 'migration.sql')]);

    psql(scratch.toString(), [
      '-c',
      `INSERT INTO "DdclDocument" ("id","title","createdBy") VALUES ('old1','Lama','dev-user'), ('old2','Lama 2','dev-user')`,
    ]);
    psql(scratch.toString(), ['-f', path.join(MIGRATIONS, U4, 'migration.sql')]);

    expect(psql(scratch.toString(), ['-c', `SELECT count(*) FROM "DdclDocument" WHERE "createdByUserId" IS NULL`]).trim()).toBe('2');
    expect(
      psql(scratch.toString(), [
        '-c',
        `SELECT count(*) FROM information_schema.columns WHERE table_name='DdclDocument' AND column_name='createdBy'`,
      ]).trim(),
    ).toBe('0');
    expect(psql(scratch.toString(), ['-c', `SELECT count(*) FROM "User"`]).trim()).toBe('0');
  });
});
