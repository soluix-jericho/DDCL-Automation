import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHashGate } from '../../src/hashGate';
import { registerLibraryRoutes } from '../../src/libraryRoutes';
import { createPasswordService } from '../../src/passwordService';
import { createRepository } from '../../src/repository';
import { createWriteLimiter } from '../../src/writeLimiter';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { authApp, AuthApp, makeUser, ORIGIN, testConfig } from '../u4/helpers';

/**
 * Load test for U4 (NFR1.20, NFR1.21, NFR1.23, NFR1.24). Run on demand, never in `npm test`:
 *   docker compose run --rm backend npx vitest run -c vitest.load.config.ts tests/load/auth.load.test.ts
 * It uses the real scrypt parameters (N=32768) and the real 2-slot hash gate. Targets are fixed and are never
 * relaxed to make a run pass.
 */
const AUDIT_ROWS = 500_000;
const PASSWORD = 'kata-sandi-beban-uji';

let prisma: PrismaClient;
let app: AuthApp;
const report: Array<[string, number, number]> = [];

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] as number;
}

async function timed<T extends { statusCode: number }>(call: () => Promise<T>, expected: number): Promise<number> {
  const t = performance.now();
  const res = await call();
  const ms = performance.now() - t;
  expect(res.statusCode).toBe(expected);
  return ms;
}

// rawInject: the wrapped inject would add the admin's Bearer header, and a login that carries a session revokes it.
const login = (a: AuthApp) =>
  a.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'load@example.test', password: PASSWORD } });

beforeAll(async () => {
  prisma = createTestPrisma();
  await truncateAll(prisma);
  // The default repository: scrypt N=32768 behind the 2-slot gate (NFR1.24).
  const repo = createRepository(prisma);
  app = await authApp(prisma, {}, repo);
  const u = await makeUser(prisma, { email: 'load@example.test', role: 'editor' });
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await repo.passwords.hash(PASSWORD) } });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Step" ("id","name","category","kind","updatedAt") SELECT 'ls' || g, 'Load step ' || g, 'Database', 'forward', now() FROM generate_series(1, 200) g`,
  );
}, 30 * 60 * 1000);

afterAll(async () => {
  console.info(
    '\nAuth load test (ms):\n' + report.map(([label, n, ms]) => `  ${label.padEnd(58)} n=${String(n).padStart(3)}  ${ms}`).join('\n'),
  );
  await app?.close();
  await truncateAll(prisma);
  await prisma.$disconnect();
});

describe('login (NFR1.20)', () => {
  it('p95 < 1 s over 100 logins, 76 one by one and 24 in waves of 4 at once', async () => {
    const times: number[] = [];
    for (let i = 0; i < 76; i++) times.push(await timed(() => login(app), 200));
    for (let wave = 0; wave < 6; wave++) {
      times.push(...(await Promise.all(Array.from({ length: 4 }, () => timed(() => login(app), 200)))));
    }
    const v = p95(times);
    report.push(['POST /auth/login (100, incl. waves of 4)', times.length, Math.round(v)]);
    expect(times).toHaveLength(100);
    expect(v, `login p95 ${Math.round(v)} ms`).toBeLessThan(1000);
  });
});

describe('session gate overhead (NFR1.21)', () => {
  it('adds at most 50 ms to p95 compared with the same route without the gate (200 requests each)', async () => {
    // Baseline: the same Library routes on a bare Fastify instance, no gate and no session lookup.
    const bare = Fastify({ logger: false });
    await bare.register(async (api) => registerLibraryRoutes(api, { repo: createRepository(prisma), limiter: createWriteLimiter() }), { prefix: '/api/v1' });
    try {
      const run = async (inject: (o: { method: 'GET'; url: string; headers?: Record<string, string> }) => Promise<{ statusCode: number }>, headers: Record<string, string>) => {
        const out: number[] = [];
        for (let i = 0; i < 200; i++) out.push(await timed(() => inject({ method: 'GET', url: '/api/v1/steps?q=step&category=Database', headers }), 200));
        return out;
      };
      await run((o) => bare.inject(o), {}); // warm up both paths before measuring
      await run((o) => app.rawInject(o), app.as('viewer'));
      const without = p95(await run((o) => bare.inject(o), {}));
      const withGate = p95(await run((o) => app.rawInject(o), app.as('viewer')));
      report.push(['GET /steps without gate (baseline p95)', 200, Math.round(without)]);
      report.push(['GET /steps with gate (p95)', 200, Math.round(withGate)]);
      expect(withGate - without, `gate adds ${Math.round(withGate - without)} ms at p95`).toBeLessThanOrEqual(50);
    } finally {
      await bare.close();
    }
  });
});

describe(`audit list on ${AUDIT_ROWS.toLocaleString('en')} rows (NFR1.23)`, () => {
  it('p95 < 2 s over 50 requests: first page, filtered by type, and deep pages by cursor', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AuditEvent" ("id","type","occurredAt","email")
       SELECT 'au' || g,
              (ARRAY['login_success','login_failed','logout','role_changed'])[1 + g % 4]::"AuditEventType",
              (now() AT TIME ZONE 'UTC') - (g || ' seconds')::interval,
              'orang' || (g % 20) || '@example.test'
       FROM generate_series(1, ${AUDIT_ROWS}) g`,
    );
    await prisma.$executeRawUnsafe('ANALYZE "AuditEvent"');
    const get = (query: string) => app.rawInject({ method: 'GET', url: `/api/v1/audit-events${query}`, headers: app.as('admin') });

    const times: number[] = [];
    let cursor = '';
    for (let i = 0; i < 50; i++) {
      const query =
        i % 3 === 0 ? '?limit=50' : i % 3 === 1 ? '?type=login_failed&limit=50' : `?limit=50${cursor ? `&cursor=${cursor}` : ''}`;
      const t = performance.now();
      const res = await get(query);
      times.push(performance.now() - t);
      expect(res.statusCode, query).toBe(200);
      const body = res.json() as { items: unknown[]; nextCursor: string | null };
      expect(body.items).toHaveLength(50);
      if (i % 3 === 2 && body.nextCursor) cursor = body.nextCursor;
    }
    const v = p95(times);
    report.push([`GET /audit-events (${AUDIT_ROWS} rows)`, times.length, Math.round(v)]);
    expect(v, `audit list p95 ${Math.round(v)} ms`).toBeLessThan(2000);
  });
});

describe('hash queue full (NFR1.24)', () => {
  it('answers 503 with Retry-After for requests that wait more than 5 s, and 200 for the rest, with no other outcome', async () => {
    // 2 slots, about 120 ms per hash: 150 simultaneous logins need about 9 s, so the tail waits past 5 s.
    const queueRepo = createRepository(prisma, { passwords: createPasswordService(createHashGate({ slots: 2, maxWaitMs: 5000 })) });
    const queueApp = await authApp(prisma, {}, queueRepo, testConfig());
    try {
      const results = await Promise.all(Array.from({ length: 150 }, () => login(queueApp)));
      const codes = results.map((r) => r.statusCode);
      expect(new Set(codes.filter((c) => c !== 200 && c !== 503))).toEqual(new Set());
      const busy = results.filter((r) => r.statusCode === 503);
      expect(busy.length, 'no request was turned away: the queue never filled').toBeGreaterThan(0);
      expect(codes.filter((c) => c === 200).length).toBeGreaterThan(0);
      for (const r of busy) expect(r.headers['retry-after']).toBe('5');
      report.push(['150 simultaneous logins: 503 count', 150, busy.length]);
    } finally {
      await queueApp.close();
    }
  });
});
