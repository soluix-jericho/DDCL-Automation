import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/errors';
import { createRepository, Repository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { bundleBody, seedRollback, seedStep } from './helpers';

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

async function threeForwardTwoRollback() {
  const f = [await seedStep(repo, { name: 'F1' }), await seedStep(repo, { name: 'F2' }), await seedStep(repo, { name: 'F3' })];
  const r = [await seedRollback(repo, 'R1'), await seedRollback(repo, 'R2')];
  return { f, r };
}

describe('create and read bundles (BR2.11, BR2.14)', () => {
  it('stores ordered forward and rollback members with different counts and returns full step content', async () => {
    const { f, r } = await threeForwardTwoRollback();
    const bundle = await repo.createBundle(
      bundleBody({
        name: 'Buka DB',
        category: 'Database',
        forwardStepIds: [f[2]?.id as string, f[0]?.id as string, f[1]?.id as string],
        rollbackStepIds: [r[1]?.id as string, r[0]?.id as string],
      }),
    );
    expect(bundle.forward.map((s) => s.name)).toEqual(['F3', 'F1', 'F2']);
    expect(bundle.rollback.map((s) => s.name)).toEqual(['R2', 'R1']);
    expect(bundle.forward[0]?.columns[0]?.lines[0]).toContain('kubectl'); // full content, not a summary
    const read = await repo.getBundle(bundle.id);
    expect(read.forward.map((s) => s.name)).toEqual(['F3', 'F1', 'F2']);
    expect(read.rollback.map((s) => s.name)).toEqual(['R2', 'R1']);
  });

  it('allows a bundle with an empty rollback sequence', async () => {
    const { f } = await threeForwardTwoRollback();
    const bundle = await repo.createBundle(bundleBody({ forwardStepIds: [f[0]?.id as string] }));
    expect(bundle.rollback).toEqual([]);
  });

  it('rejects a rollback step among forward members and the reverse (400), storing nothing', async () => {
    const { f, r } = await threeForwardTwoRollback();
    await expect(
      repo.createBundle(bundleBody({ forwardStepIds: [r[0]?.id as string] })),
    ).rejects.toMatchObject({ fields: ['forwardStepIds'] });
    await expect(
      repo.createBundle(bundleBody({ forwardStepIds: [f[0]?.id as string], rollbackStepIds: [f[1]?.id as string] })),
    ).rejects.toMatchObject({ fields: ['rollbackStepIds'] });
    await expect(
      repo.createBundle(bundleBody({ forwardStepIds: ['nope'] })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.stepBundle.count()).toBe(0);
    expect(await prisma.bundleForwardMember.count()).toBe(0);
  });

  it('rejects a duplicate bundle name ignoring case with the existing bundle (409), also under a race', async () => {
    const { f } = await threeForwardTwoRollback();
    const first = await repo.createBundle(bundleBody({ name: 'Buka DB', forwardStepIds: [f[0]?.id as string] }));
    const err = (await repo
      .createBundle(bundleBody({ name: ' buka db ', forwardStepIds: [f[1]?.id as string] }))
      .catch((e) => e)) as ConflictError;
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.conflictOn).toBe('bundle');
    expect((err.existing as { id: string }).id).toBe(first.id);

    const race = await Promise.allSettled([
      repo.createBundle(bundleBody({ name: 'Race', forwardStepIds: [f[0]?.id as string] })),
      repo.createBundle(bundleBody({ name: 'race', forwardStepIds: [f[1]?.id as string] })),
    ]);
    expect(race.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = race.find((x) => x.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });

  it('answers NotFoundError for an unknown bundle', async () => {
    await expect(repo.getBundle('nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.deleteBundle('nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.updateBundle('nope', bundleBody({ forwardStepIds: [] }))).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('update, list and delete bundles', () => {
  it('replaces members and order on update, and keeps the name unique against other bundles only', async () => {
    const { f, r } = await threeForwardTwoRollback();
    const a = await repo.createBundle(bundleBody({ name: 'A', forwardStepIds: [f[0]?.id as string, f[1]?.id as string] }));
    await repo.createBundle(bundleBody({ name: 'B', forwardStepIds: [f[2]?.id as string] }));
    const updated = await repo.updateBundle(
      a.id,
      bundleBody({
        name: 'a',
        category: 'Bastion',
        forwardStepIds: [f[1]?.id as string, f[0]?.id as string],
        rollbackStepIds: [r[0]?.id as string],
      }),
    );
    expect(updated).toMatchObject({ name: 'a', category: 'Bastion' });
    expect(updated.forward.map((s) => s.name)).toEqual(['F2', 'F1']);
    expect(updated.rollback.map((s) => s.name)).toEqual(['R1']);
    await expect(
      repo.updateBundle(a.id, bundleBody({ name: 'b', forwardStepIds: [f[0]?.id as string] })),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('lists member counts, searches by name and filters by category', async () => {
    const { f, r } = await threeForwardTwoRollback();
    await repo.createBundle(
      bundleBody({ name: 'Buka DB', category: 'Database', forwardStepIds: [f[0]?.id as string, f[1]?.id as string], rollbackStepIds: [r[0]?.id as string] }),
    );
    await repo.createBundle(bundleBody({ name: 'Cek 100%', category: 'Bastion', forwardStepIds: [f[2]?.id as string] }));
    const all = await repo.listBundles();
    expect(all.map((b) => [b.name, b.forwardCount, b.rollbackCount])).toEqual([
      ['Buka DB', 2, 1],
      ['Cek 100%', 1, 0],
    ]);
    expect((await repo.listBundles({ q: 'buka', category: null })).map((b) => b.name)).toEqual(['Buka DB']);
    expect((await repo.listBundles({ q: '%', category: null })).map((b) => b.name)).toEqual(['Cek 100%']);
    expect((await repo.listBundles({ q: null, category: 'Bastion' })).map((b) => b.name)).toEqual(['Cek 100%']);
    expect(await repo.listBundles({ q: 'zzz', category: null })).toEqual([]);
  });

  it('deleting a bundle removes its memberships but never the steps', async () => {
    const { f, r } = await threeForwardTwoRollback();
    const b = await repo.createBundle(bundleBody({ forwardStepIds: [f[0]?.id as string], rollbackStepIds: [r[0]?.id as string] }));
    expect(await repo.deleteBundle(b.id)).toMatchObject({ forwardCount: 1, rollbackCount: 1 });
    expect(await prisma.stepBundle.count()).toBe(0);
    expect(await prisma.bundleForwardMember.count()).toBe(0);
    expect(await prisma.step.count()).toBe(5);
  });
});

describe('deleting a step that belongs to bundles (BR2.7)', () => {
  it('removes the step from bundles and closes position gaps; deletes a bundle that loses its last forward member', async () => {
    const { f, r } = await threeForwardTwoRollback();
    const big = await repo.createBundle(
      bundleBody({
        name: 'Besar',
        forwardStepIds: [f[0]?.id as string, f[1]?.id as string, f[2]?.id as string],
        rollbackStepIds: [r[0]?.id as string, r[1]?.id as string],
      }),
    );
    const solo = await repo.createBundle(bundleBody({ name: 'Sendiri', forwardStepIds: [f[1]?.id as string], rollbackStepIds: [r[0]?.id as string] }));

    const preview = await repo.getDeleteImpact(f[1]?.id as string);
    expect(preview.bundlesRemoved.map((b) => b.name)).toEqual(['Sendiri']);
    expect(preview.bundlesChanged.map((b) => b.name)).toEqual(['Besar']);

    const impact = await repo.deleteStep(f[1]?.id as string);
    expect(impact).toEqual(preview);
    expect(await prisma.stepBundle.findUnique({ where: { id: solo.id } })).toBeNull();
    const after = await repo.getBundle(big.id);
    expect(after.forward.map((s) => s.name)).toEqual(['F1', 'F3']);
    const positions = await prisma.bundleForwardMember.findMany({ where: { bundleId: big.id }, orderBy: { position: 'asc' } });
    expect(positions.map((m) => m.position)).toEqual([1, 2]);

    await repo.deleteStep(r[0]?.id as string);
    const afterRb = await repo.getBundle(big.id);
    expect(afterRb.rollback.map((s) => s.name)).toEqual(['R2']);
    expect((await prisma.bundleRollbackMember.findMany({ where: { bundleId: big.id } })).map((m) => m.position)).toEqual([1]);
  });

  it('lets a bundle end up with an empty rollback sequence when its rollback members are deleted', async () => {
    const { f, r } = await threeForwardTwoRollback();
    const b = await repo.createBundle(bundleBody({ forwardStepIds: [f[0]?.id as string], rollbackStepIds: [r[0]?.id as string] }));
    await repo.deleteStep(r[0]?.id as string);
    expect((await repo.getBundle(b.id)).rollback).toEqual([]);
  });
});
