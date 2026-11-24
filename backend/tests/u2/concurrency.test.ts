import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError, RetryExhausted, ServiceBusyError, ValidationError } from '../../src/errors';
import { withLibraryTx } from '../../src/libraryTx';
import { createRepository, Repository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { bundleBody, seedRollback, seedStep, stepBody } from './helpers';

let prisma: PrismaClient;
let repo: Repository;

beforeAll(() => {
  prisma = createTestPrisma();
  repo = createRepository(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every bundle's member positions must be exactly 1..n and no bundle may reference a missing step. */
async function expectConsistent(): Promise<void> {
  for (const bundle of await prisma.stepBundle.findMany({ select: { id: true } })) {
    for (const members of [
      await prisma.bundleForwardMember.findMany({ where: { bundleId: bundle.id }, orderBy: { position: 'asc' } }),
      await prisma.bundleRollbackMember.findMany({ where: { bundleId: bundle.id }, orderBy: { position: 'asc' } }),
    ]) {
      expect(members.map((m) => m.position)).toEqual(members.map((_, i) => i + 1));
    }
    expect(
      (await prisma.bundleForwardMember.count({ where: { bundleId: bundle.id } })),
    ).toBeGreaterThan(0); // a bundle never survives without a forward member
  }
  const cols = await prisma.stepColumn.groupBy({ by: ['stepId', 'position'], _count: true });
  expect(cols.every((c) => c._count === 1)).toBe(true);
}

function unexpected(results: PromiseSettledResult<unknown>[], allowed: Array<new (...a: never[]) => Error>) {
  return results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected' && !allowed.some((c) => r.reason instanceof c),
  );
}

describe('lock protocol (scalability-design.md, point 1-3)', () => {
  it('serializes two transactions that name the same rows in opposite order (no deadlock, no 500)', async () => {
    const x = await seedStep(repo, { name: 'X' });
    const y = await seedRollback(repo, 'Y');
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));

    const a = withLibraryTx(prisma, {
      operation: 'A',
      candidates: async () => ({ stepIds: [y.id, x.id], bundleIds: [] }),
      fn: async () => {
        events.push('A-in');
        await gate;
        events.push('A-out');
      },
    });
    while (!events.includes('A-in')) await sleep(10);
    const b = withLibraryTx(prisma, {
      operation: 'B',
      candidates: async () => ({ stepIds: [x.id, y.id], bundleIds: [] }),
      fn: async () => {
        events.push('B-in');
      },
    });
    await sleep(300);
    expect(events).toEqual(['A-in']); // B is blocked on the row locks A holds
    release();
    await Promise.all([a, b]);
    expect(events).toEqual(['A-in', 'A-out', 'B-in']);
  });

  it('restarts the transaction when the candidate set grows between reading and locking', async () => {
    const x = await seedStep(repo, { name: 'X' });
    const y = await seedRollback(repo, 'Y');
    let calls = 0;
    const retries: string[] = [];
    let ran = 0;
    await withLibraryTx(prisma, {
      operation: 'grow',
      onRetry: (i) => retries.push(i.code),
      candidates: async () => {
        calls += 1;
        // 1st read: {x}; 2nd read (after locking): {x, y} => changed, restart; later reads are stable.
        return { stepIds: calls === 2 ? [x.id, y.id] : calls <= 1 ? [x.id] : [x.id, y.id], bundleIds: [] };
      },
      fn: async () => {
        ran += 1;
      },
    });
    expect(retries).toEqual(['lock-set-changed']);
    expect(ran).toBe(1);
  });

  it('maps a pool timeout (P2024) to ServiceBusyError and exhausted deadlock retries to RetryExhausted', async () => {
    const pool = {
      $transaction: async () => {
        throw new Prisma.PrismaClientKnownRequestError('pool', { code: 'P2024', clientVersion: 'x' });
      },
    } as unknown as PrismaClient;
    const run = (p: PrismaClient, onRetry?: () => void) =>
      withLibraryTx(p, { operation: 'o', candidates: async () => ({ stepIds: [], bundleIds: [] }), fn: async () => 1, onRetry });
    await expect(run(pool)).rejects.toBeInstanceOf(ServiceBusyError);
    await expect(run(pool)).rejects.toMatchObject({ reason: 'pool', retryAfterSeconds: 2 });

    const onRetry = vi.fn();
    const deadlocking = {
      $transaction: async () => {
        throw new Prisma.PrismaClientKnownRequestError('deadlock', { code: 'P2034', clientVersion: 'x' });
      },
    } as unknown as PrismaClient;
    await expect(run(deadlocking, onRetry)).rejects.toBeInstanceOf(RetryExhausted);
    expect(onRetry).toHaveBeenCalledTimes(2); // 1 attempt + 2 retries, then give up
  });

  it('recognizes a raw-query deadlock (P2010 / 40P01) as retryable', async () => {
    let attempts = 0;
    const flaky = {
      $transaction: async (fn: (tx: never) => Promise<number>) => {
        attempts += 1;
        if (attempts === 1) {
          throw new Prisma.PrismaClientKnownRequestError('raw', { code: 'P2010', clientVersion: 'x', meta: { code: '40P01' } });
        }
        return fn({} as never);
      },
    } as unknown as PrismaClient;
    const noLocks = { candidates: async () => ({ stepIds: [], bundleIds: [] }) };
    await expect(withLibraryTx(flaky, { operation: 'o', ...noLocks, fn: async () => 7 })).resolves.toBe(7);
    expect(attempts).toBe(2);
  });

  it('lets other errors through untouched', async () => {
    await expect(
      withLibraryTx(prisma, {
        operation: 'o',
        candidates: async () => ({ stepIds: [], bundleIds: [] }),
        fn: async () => {
          throw new NotFoundError('x');
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('concurrent Library writes end consistent, never with a 500 (NFR4.3)', () => {
  it('(a) crossing transactions: update X (paired with Y), update Y and delete X at once', async () => {
    for (let round = 0; round < 5; round++) {
      await truncateAll(prisma);
      const y = await seedRollback(repo, 'Y');
      const x = await seedStep(repo, { name: 'X', pairedRollbackStepId: y.id });
      const bundle = await repo.createBundle(bundleBody({ name: 'B', forwardStepIds: [x.id], rollbackStepIds: [y.id] }));
      const results = await Promise.allSettled([
        repo.updateStep(x.id, stepBody({ kind: undefined, name: 'X2', pairedRollbackStepId: y.id })),
        repo.updateStep(y.id, stepBody({ kind: undefined, name: 'Y2' })),
        repo.deleteStep(x.id),
      ]);
      expect(unexpected(results, [NotFoundError])).toEqual([]);
      await expectConsistent();
      expect(await prisma.stepBundle.findUnique({ where: { id: bundle.id } })).toBeNull(); // X was its only forward member
    }
  });

  it('(b) two PATCHes on the same step leave one complete copy: the last writer wins as a whole', async () => {
    const step = await seedStep(repo, { name: 'Same' });
    const one = stepBody({
      kind: undefined,
      name: 'Satu',
      columns: [{ label: 'A', lines: ['a1', 'a2', 'a3'] }, { label: 'B', lines: ['b1'] }],
      attachments: [{ filename: 'one.txt', content: '1' }],
    });
    const two = stepBody({
      kind: undefined,
      name: 'Dua',
      columns: [{ label: 'C', lines: ['c1', 'c2'] }],
      attachments: [{ filename: 'two.txt', content: '2' }, { filename: 'two-b.txt', content: '22' }],
    });
    for (let round = 0; round < 5; round++) {
      const results = await Promise.allSettled([repo.updateStep(step.id, one), repo.updateStep(step.id, two)]);
      expect(unexpected(results, [])).toEqual([]);
      const final = await repo.getStep(step.id);
      const winner = final.name === 'Satu' ? one : two;
      expect(final.columns).toEqual(winner.columns);
      expect(final.attachments).toEqual(winner.attachments);
    }
  });

  it('(c) deleting a step while a bundle containing it is saved', async () => {
    for (let round = 0; round < 5; round++) {
      await truncateAll(prisma);
      const x = await seedStep(repo, { name: 'X' });
      const z = await seedStep(repo, { name: 'Z' });
      const w = await seedStep(repo, { name: 'W' });
      const existing = await repo.createBundle(bundleBody({ name: 'Ada', forwardStepIds: [x.id, z.id, w.id] }));
      const results = await Promise.allSettled([
        repo.deleteStep(x.id),
        repo.updateBundle(existing.id, bundleBody({ name: 'Ada', forwardStepIds: [w.id, x.id, z.id] })),
        repo.createBundle(bundleBody({ name: 'Baru', forwardStepIds: [x.id, z.id] })),
      ]);
      expect(unexpected(results, [NotFoundError, ValidationError])).toEqual([]);
      expect(results[0]?.status).toBe('fulfilled');
      await expectConsistent();
      expect(await prisma.bundleForwardMember.count({ where: { stepId: x.id } })).toBe(0);
    }
  });

  it('(d) replacing the rollback partner while the old partner is deleted', async () => {
    for (let round = 0; round < 5; round++) {
      await truncateAll(prisma);
      const oldRb = await seedRollback(repo, 'Lama');
      const newRb = await seedRollback(repo, 'Baru');
      const x = await seedStep(repo, { name: 'X', pairedRollbackStepId: oldRb.id });
      const results = await Promise.allSettled([
        repo.updateStep(x.id, stepBody({ kind: undefined, pairedRollbackStepId: newRb.id })),
        repo.deleteStep(oldRb.id),
      ]);
      expect(unexpected(results, [NotFoundError])).toEqual([]);
      expect((await repo.getStep(x.id)).pairedRollbackStepId).toBe(newRb.id);
      await expectConsistent();
    }
  });

  it('many parallel creates and deletes of distinct steps never produce duplicate positions or a 500', async () => {
    const seeds = await Promise.all(Array.from({ length: 6 }, (_, i) => seedStep(repo, { name: `S${i}` })));
    const results = await Promise.allSettled([
      ...seeds.slice(0, 3).map((s) => repo.deleteStep(s.id)),
      ...Array.from({ length: 4 }, (_, i) => seedStep(repo, { name: `T${i}` })),
      repo.createBundle(bundleBody({ name: 'Semua', forwardStepIds: seeds.slice(3).map((s) => s.id) })),
    ]);
    expect(unexpected(results, [])).toEqual([]);
    await expectConsistent();
  });
});
