import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRepository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeApp } from '../u2/helpers';

/**
 * Load test for the Library (NFR1.5-NFR1.7, NFR1.9, NFR1.6 payload size).
 * Seed: 1,000 steps, 100 bundles, 100,000 checklist items carrying a stepSnapshot of LOAD_SNAPSHOT_KB
 * (5 in CI, 20 for a full local run). Targets are fixed: p95 < 2 s per route over 100 sequential requests,
 * and one scenario with 20 requests at once. The targets are never relaxed to make a run pass.
 */
const SNAPSHOT_KB = Number.parseInt(process.env.LOAD_SNAPSHOT_KB ?? '5', 10);
const REQUESTS = 100;
const P95_LIMIT_MS = 2000;

let prisma: PrismaClient;
let app: FastifyInstance;
const report: Array<[string, number, number]> = [];

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] as number;
}

/** Runs `n` requests one after another; returns the latency of each in milliseconds. */
async function series(n: number, call: (i: number) => Promise<{ statusCode: number }>, expected: number) {
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    const res = await call(i);
    times.push(performance.now() - t);
    expect(res.statusCode, `request ${i}`).toBe(expected);
  }
  return times;
}

function check(label: string, times: number[]) {
  const v = p95(times);
  report.push([label, times.length, Math.round(v)]);
  expect(v, `${label}: p95 ${Math.round(v)} ms`).toBeLessThan(P95_LIMIT_MS);
}

/** A step at every NFR1.8 limit: 10 columns x 50 lines x 2,000 characters, 10 attachments of 100 KiB class. */
function maxStep(name: string, char: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    category: 'Database',
    kind: 'forward',
    columns: Array.from({ length: 10 }, (_, c) => ({
      label: `kolom ${c}`,
      lines: Array.from({ length: 50 }, () => char.repeat(2000)),
    })),
    attachments: Array.from({ length: 10 }, (_, i) => ({
      filename: `lampiran-${i}.txt`,
      content: char.repeat(char.length === 1 ? 102_400 : 25_600), // 102,400 bytes either way
    })),
    ...extra,
  };
}

beforeAll(async () => {
  prisma = createTestPrisma();
  await truncateAll(prisma);
  const kb = Number.isInteger(SNAPSHOT_KB) && SNAPSHOT_KB > 0 ? SNAPSHOT_KB : 5;
  const exec = (sql: string) => prisma.$executeRawUnsafe(sql);

  // Even ids are forward steps, odd ids rollback steps; forward 2k is paired with rollback 2k-1.
  await exec(`INSERT INTO "Step" ("id","name","category","kind","updatedAt")
    SELECT 'ls' || g, 'Load step ' || g, (ARRAY['Database','Bastion','RabbitMQ','Keycloak'])[1 + g % 4],
           CASE WHEN g % 2 = 0 THEN 'forward'::"StepKind" ELSE 'rollback'::"StepKind" END, now()
    FROM generate_series(1, 1000) g`);
  await exec(`UPDATE "Step" SET "pairedRollbackStepId" = 'ls' || (substr("id", 3)::int - 1) WHERE "kind" = 'forward'`);
  await exec(`INSERT INTO "StepColumn" ("id","stepId","position","label")
    SELECT 'lc' || g || '_' || c, 'ls' || g, c, 'Kolom ' || c FROM generate_series(1, 1000) g, generate_series(1, 3) c`);
  await exec(`INSERT INTO "StepLine" ("id","columnId","position","text")
    SELECT 'll' || g || '_' || c || '_' || l, 'lc' || g || '_' || c, l, 'langkah ' || l || ' {host}'
    FROM generate_series(1, 1000) g, generate_series(1, 3) c, generate_series(1, 5) l`);

  await exec(`INSERT INTO "StepBundle" ("id","name","category","updatedAt")
    SELECT 'lb' || g, 'Load bundle ' || g, 'Database', now() FROM generate_series(1, 100) g`);
  await exec(`INSERT INTO "BundleForwardMember" ("bundleId","stepId","position")
    SELECT 'lb' || b, 'ls' || (2 * (((b - 1) * 5 + p - 1) % 500 + 1)), p
    FROM generate_series(1, 100) b, generate_series(1, 5) p`);
  await exec(`INSERT INTO "BundleRollbackMember" ("bundleId","stepId","position")
    SELECT 'lb' || b, 'ls' || (2 * (((b - 1) * 3 + p - 1) % 500 + 1) - 1), p
    FROM generate_series(1, 100) b, generate_series(1, 3) p`);

  await exec(`INSERT INTO "DdclDocument" ("id","title","createdBy") SELECT 'ld' || g, 'DDCL ' || g, 'load' FROM generate_series(0, 999) g`);
  await exec(`INSERT INTO "ChecklistItem" ("id","ddclId","stepId","order","stepSnapshot")
    SELECT 'lci' || g, 'ld' || (g % 1000), 'ls' || (1 + g % 1000), g,
           jsonb_build_object('id', 'ls' || (1 + g % 1000), 'name', 'Load step', 'category', 'Database', 'kind', 'forward',
                              'columns', '[]'::jsonb, 'attachments', '[]'::jsonb, 'pairedRollback', 'null'::jsonb,
                              'filler', repeat('x', ${kb * 1024}))
    FROM generate_series(1, 100000) g`);
  await exec('ANALYZE');

  app = await makeApp(prisma, {}, createRepository(prisma));
});

afterAll(async () => {
  console.info(
    '\nLoad test p95 (ms), limit 2000:\n' +
      report.map(([label, n, ms]) => `  ${label.padEnd(46)} n=${String(n).padStart(3)}  p95=${ms}`).join('\n'),
  );
  await app?.close();
  await truncateAll(prisma);
  await prisma.$disconnect();
});

describe(`Library load (snapshot ${SNAPSHOT_KB} KB, 1,000 steps, 100 bundles, 100,000 checklist items)`, () => {
  it('lists steps (NFR1.5)', async () => {
    check('GET /steps (all, with usageCount)', await series(REQUESTS, () => app.inject({ method: 'GET', url: '/api/v1/steps' }), 200));
  });

  it('searches and filters steps (NFR1.5)', async () => {
    check(
      'GET /steps?q=&category=',
      await series(REQUESTS, (i) => app.inject({ method: 'GET', url: `/api/v1/steps?q=step%20${i}&category=Database` }), 200),
    );
  });

  it('lists bundles and reads one with full steps', async () => {
    check('GET /bundles', await series(REQUESTS, () => app.inject({ method: 'GET', url: '/api/v1/bundles' }), 200));
    check(
      'GET /bundles/:id (5 forward + 3 rollback, full)',
      await series(REQUESTS, (i) => app.inject({ method: 'GET', url: `/api/v1/bundles/lb${(i % 100) + 1}` }), 200),
    );
  });

  it('saves and deletes a step at the NFR1.8 maximum with an inline rollbackStep (NFR1.6, NFR1.7)', async () => {
    const createdIds: string[] = [];
    const saves = await series(
      REQUESTS,
      async (i) => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/steps',
          payload: maxStep(`Max step ${i}`, 'x', { rollbackStep: maxStep(`Max rollback ${i}`, 'y', { kind: 'rollback' }) }) as never,
        });
        if (res.statusCode === 201) createdIds.push(res.json().id, res.json().pairedRollbackStepId);
        return res;
      },
      201,
    );
    check('POST /steps (max size + inline rollbackStep)', saves);
    const deletes = await series(REQUESTS, (i) => app.inject({ method: 'DELETE', url: `/api/v1/steps/${createdIds[i * 2]}` }), 200);
    check('DELETE /steps/:id (max-size step)', deletes);
    for (let i = 0; i < REQUESTS; i++) await app.inject({ method: 'DELETE', url: `/api/v1/steps/${createdIds[i * 2 + 1]}` });
  });

  it('saves a maximum-size step made of 4-byte characters without a 413 (NFR1.6)', async () => {
    const createdIds: string[] = [];
    const times = await series(
      20,
      async (i) => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/steps',
          payload: maxStep(`Emoji ${i}`, '😀', { rollbackStep: maxStep(`Emoji rollback ${i}`, '😀', { kind: 'rollback' }) }) as never,
        });
        if (res.statusCode === 201) createdIds.push(res.json().id, res.json().pairedRollbackStepId);
        return res;
      },
      201,
    );
    check('POST /steps (max size, 4-byte characters)', times);
    for (const id of createdIds) await app.inject({ method: 'DELETE', url: `/api/v1/steps/${id}` });
  });

  it('saves and deletes bundles at the member limits (NFR1.7)', async () => {
    const forward = Array.from({ length: 50 }, (_, i) => `ls${2 * (i + 1)}`);
    const rollback = Array.from({ length: 50 }, (_, i) => `ls${2 * (i + 1) - 1}`);
    const ids: string[] = [];
    const saves = await series(
      REQUESTS,
      async (i) => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/bundles',
          payload: { name: `Max bundle ${i}`, category: 'Database', forwardStepIds: forward, rollbackStepIds: rollback },
        });
        if (res.statusCode === 201) ids.push(res.json().id);
        return res;
      },
      201,
    );
    check('POST /bundles (50 forward + 50 rollback)', saves);
    check('DELETE /bundles/:id', await series(REQUESTS, (i) => app.inject({ method: 'DELETE', url: `/api/v1/bundles/${ids[i]}` }), 200));
  });

  it('deletes seeded steps that many checklist items and bundles refer to (NFR1.7)', async () => {
    check(
      'DELETE /steps/:id (in bundles, ~100 checklist items)',
      await series(REQUESTS, (i) => app.inject({ method: 'DELETE', url: `/api/v1/steps/ls${2 * (i + 1) + 400}` }), 200),
    );
  });

  it('serves 20 simultaneous requests (16 reads and 4 writes) each under the limit (NFR1.9)', async () => {
    const calls: Array<() => Promise<{ statusCode: number }>> = [
      ...Array.from({ length: 8 }, () => () => app.inject({ method: 'GET', url: '/api/v1/steps' })),
      ...Array.from({ length: 4 }, (_, i) => () => app.inject({ method: 'GET', url: `/api/v1/steps?q=load&category=${['Database', 'Bastion', 'RabbitMQ', 'Keycloak'][i]}` })),
      ...Array.from({ length: 4 }, () => () => app.inject({ method: 'GET', url: '/api/v1/bundles' })),
      ...Array.from({ length: 4 }, (_, i) => () =>
        app.inject({ method: 'POST', url: '/api/v1/steps', payload: maxStep(`Parallel ${i}`, 'z') as never }),
      ),
    ];
    const results = await Promise.all(
      calls.map(async (call) => {
        const t = performance.now();
        const res = await call();
        return { ms: performance.now() - t, status: res.statusCode };
      }),
    );
    expect(results.every((r) => r.status === 200 || r.status === 201), JSON.stringify(results.map((r) => r.status))).toBe(true);
    check('20 simultaneous requests', results.map((r) => r.ms));
  });
});
