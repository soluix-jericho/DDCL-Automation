import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, mkdir, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TMP_DIR } from '../helpers/template';

const SCRIPT = path.resolve(__dirname, '..', '..', 'scripts', 'start-prod.sh');
const ROOT = path.join(TMP_DIR, 'startprod');

interface Scenario {
  files: number;
  applied: number;
  table?: boolean;
  psqlFails?: boolean;
  pgDumpFails?: boolean;
  keep?: number;
  existingDumps?: string[];
}

async function stub(dir: string, name: string, body: string): Promise<void> {
  const file = path.join(dir, name);
  await writeFile(file, `#!/bin/sh\n${body}\n`);
  await chmod(file, 0o755);
}

let counter = 0;

/** Runs scripts/start-prod.sh against fake psql/pg_dump/migrate/server programs and returns what happened. */
async function run(s: Scenario) {
  const dir = path.join(ROOT, `case-${++counter}`);
  const bin = path.join(dir, 'bin');
  const backups = path.join(dir, 'backups');
  const migrations = path.join(dir, 'migrations');
  const log = path.join(dir, 'log.txt');
  await mkdir(bin, { recursive: true });
  await mkdir(backups, { recursive: true });
  await mkdir(migrations, { recursive: true });
  await writeFile(log, '');
  for (let i = 0; i < s.files; i++) await mkdir(path.join(migrations, `2026${String(i).padStart(4, '0')}_m`));
  for (const [i, name] of (s.existingDumps ?? []).entries()) {
    const f = path.join(backups, name);
    await writeFile(f, 'old');
    if (!name.endsWith('.partial')) {
      const t = new Date(Date.UTC(2026, 0, 1 + i)); // older files first
      await utimes(f, t, t);
    }
  }
  await stub(
    bin,
    'psql',
    `case "$*" in
  *to_regclass*) ${s.psqlFails ? 'exit 2' : s.table === false ? 'echo ""' : 'echo _prisma_migrations'} ;;
  *count*) echo ${s.applied} ;;
esac`,
  );
  await stub(
    bin,
    'pg_dump',
    `echo dump >> "${log}"
out=""
while [ $# -gt 0 ]; do [ "$1" = "-f" ] && out="$2"; shift; done
echo "PGDMP fake" > "$out"
${s.pgDumpFails ? 'exit 1' : 'exit 0'}`,
  );
  await stub(bin, 'migrate-stub', `echo migrate >> "${log}"`);
  await stub(bin, 'server-stub', `echo server >> "${log}"`);

  const result = spawnSync('sh', [SCRIPT], {
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      BACKUP_DIR: backups,
      BACKUP_KEEP: String(s.keep ?? 10),
      MIGRATIONS_DIR: migrations,
      MIGRATE_CMD: 'migrate-stub',
      SERVER_CMD: 'server-stub',
    },
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stderr: result.stderr,
    log: (await readFile(log, 'utf8')).split('\n').filter(Boolean),
    files: (await readdir(backups)).sort(),
    backups,
  };
}

beforeAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
  await mkdir(ROOT, { recursive: true });
});
afterAll(async () => {
  await rm(ROOT, { recursive: true, force: true });
});

describe('start-prod.sh: conditional backup before migrations (Q2)', () => {
  it('makes no dump when no migration is pending, then migrates (a no-op) and starts the server', async () => {
    const r = await run({ files: 2, applied: 2 });
    expect(r.status).toBe(0);
    expect(r.files).toEqual([]);
    expect(r.log).toEqual(['migrate', 'server']);
  });

  it('makes no dump on an empty database (no _prisma_migrations yet)', async () => {
    const r = await run({ files: 2, applied: 0, table: false });
    expect(r.status).toBe(0);
    expect(r.files).toEqual([]);
    expect(r.log).toEqual(['migrate', 'server']);
  });

  it('dumps first, then migrates, then starts, when a migration is pending', async () => {
    const r = await run({ files: 3, applied: 2 });
    expect(r.status).toBe(0);
    expect(r.log).toEqual(['dump', 'migrate', 'server']);
    expect(r.files).toHaveLength(1);
    expect(r.files[0]).toMatch(/^pre-migrate-\d{8}T\d{6}Z\.dump$/);
    expect(r.files.some((f) => f.endsWith('.partial'))).toBe(false);
    expect(await readFile(path.join(r.backups, r.files[0] as string), 'utf8')).toContain('PGDMP');
  });

  it('stops with a non-zero status, leaves no dump or partial file and never migrates when pg_dump fails', async () => {
    const r = await run({ files: 3, applied: 2, pgDumpFails: true });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('backup failed');
    expect(r.files).toEqual([]);
    expect(r.log).toEqual(['dump']);
  });

  it('stops without guessing when psql fails', async () => {
    const r = await run({ files: 3, applied: 2, psqlFails: true });
    expect(r.status).not.toBe(0);
    expect(r.files).toEqual([]);
    expect(r.log).toEqual([]);
  });

  it('keeps only the BACKUP_KEEP newest dumps and removes leftover .partial files', async () => {
    const old = ['pre-migrate-a.dump', 'pre-migrate-b.dump', 'pre-migrate-c.dump', 'pre-migrate-d.dump', 'pre-migrate-e.dump'];
    const r = await run({ files: 3, applied: 2, keep: 3, existingDumps: [...old, 'pre-migrate-x.dump.partial'] });
    expect(r.status).toBe(0);
    expect(r.files).toHaveLength(3);
    expect(r.files.some((f) => f.endsWith('.partial'))).toBe(false);
    expect(r.files).toContain('pre-migrate-e.dump'); // newest old dump survives
    expect(r.files).not.toContain('pre-migrate-a.dump'); // oldest is pruned
    expect(r.files.some((f) => /^pre-migrate-\d{8}T/.test(f))).toBe(true); // and so does the new one
  });

  it('does not prune below the limit and ignores files that are not pre-migration dumps', async () => {
    const r = await run({ files: 2, applied: 2, keep: 2, existingDumps: ['pre-migrate-a.dump', 'notes.txt'] });
    expect(r.files).toEqual(['notes.txt', 'pre-migrate-a.dump']);
  });
});

describe('start-prod.sh with the real PostgreSQL client tools', () => {
  const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  let haveTools = false;
  try {
    execFileSync('pg_dump', ['--version'], { stdio: 'pipe' });
    haveTools = true;
  } catch {
    /* no PostgreSQL client on this machine: the stubbed tests above still cover the script logic */
  }

  it.skipIf(!haveTools || !url)('produces a restorable custom-format dump with pg_dump 16 against the test database', async () => {
    const u = new URL(url as string);
    const dir = path.join(ROOT, 'real');
    await mkdir(path.join(dir, 'migrations'), { recursive: true });
    for (let i = 0; i < 99; i++) await mkdir(path.join(dir, 'migrations', `m${i}`), { recursive: true }); // far more than applied
    const bin = path.join(dir, 'bin');
    await mkdir(bin, { recursive: true });
    await stub(bin, 'migrate-stub', 'true');
    await stub(bin, 'server-stub', 'true');
    const result = spawnSync('sh', [SCRIPT], {
      env: {
        PATH: `${bin}:${process.env.PATH}`,
        PGHOST: u.hostname,
        PGPORT: u.port || '5432',
        PGUSER: decodeURIComponent(u.username),
        PGPASSWORD: decodeURIComponent(u.password),
        PGDATABASE: u.pathname.slice(1),
        BACKUP_DIR: path.join(dir, 'backups'),
        MIGRATIONS_DIR: path.join(dir, 'migrations'),
        MIGRATE_CMD: 'migrate-stub',
        SERVER_CMD: 'server-stub',
      },
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const dumps = (await readdir(path.join(dir, 'backups'))).filter((f) => f.endsWith('.dump'));
    expect(dumps).toHaveLength(1);
    const listing = execFileSync('pg_restore', ['-l', path.join(dir, 'backups', dumps[0] as string)], { encoding: 'utf8' });
    expect(listing).toContain('_prisma_migrations');
    expect(listing).toMatch(/TABLE public Step /);
  });
});
