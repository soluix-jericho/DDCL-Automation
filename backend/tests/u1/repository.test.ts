import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DatabaseUnavailable, NotFoundError } from '../../src/errors';
import { createRepository } from '../../src/repository';
import { createTestPrisma, createUnreachablePrisma, truncateAll } from '../helpers/db';
import { stepBody } from '../u2/helpers';
import { makeUser } from '../u4/helpers';

let prisma: PrismaClient;
let repo: ReturnType<typeof createRepository>;
let creatorId: string;

beforeAll(() => {
  prisma = createTestPrisma();
  repo = createRepository(prisma);
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  creatorId = (await makeUser(prisma, { name: 'Pembuat Uji' })).id;
});

describe('repository', () => {
  it('creates a step and lists it back', async () => {
    const step = await repo.createStep(stepBody({ name: 'Update Image', category: 'Database' }));
    expect(step).toMatchObject({ name: 'Update Image', category: 'Database', kind: 'forward' });
    const list = await repo.listSteps();
    expect(list.map((s) => s.id)).toEqual([step.id]);
  });

  it('creates a DDCL with header: Draft, creator from the account, dates round-trip', async () => {
    const d = await repo.createDdcl(
      {
        title: 'DDCL 26 Okt',
        releaseHeader: { date: '2026-10-26', startDate: '2026-10-26', environment: 'PROD' },
      },
      creatorId,
    );
    expect(d.status).toBe('Draft');
    expect(d.createdBy).toBe('Pembuat Uji');
    expect(d.createdByUserId).toBe(creatorId);
    expect(d.releaseHeader?.date).toBe('2026-10-26');
    expect(d.releaseHeader?.environment).toBe('PROD');
    expect(d.releaseHeader?.impactedSystem).toBeNull();
  });

  it('adds a checklist item with order 1 and reads it back for export', async () => {
    const step = await repo.createStep(stepBody({ name: 'Update Image', category: 'Database' }));
    const d = await repo.createDdcl({ title: 'T', releaseHeader: {} }, creatorId);
    const item = await repo.addChecklistItem(d.id, {
      stepId: step.id,
      parameterValues: { image: 'app:1.0' },
    });
    expect(item.order).toBe(1);
    const full = await repo.getDdclForExport(d.id);
    expect(full?.checklistItems).toHaveLength(1);
    expect(full?.checklistItems[0]?.step?.name).toBe('Update Image');
    expect(full?.checklistItems[0]?.parameterValues).toEqual({ image: 'app:1.0' });
  });

  it('returns null from getDdclForExport for an unknown id', async () => {
    expect(await repo.getDdclForExport('nope')).toBeNull();
  });

  it('rejects checklist items for a missing DDCL or missing step with NotFoundError', async () => {
    const step = await repo.createStep(stepBody({ name: 'S', category: 'Database' }));
    await expect(
      repo.addChecklistItem('missing', { stepId: step.id, parameterValues: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
    const d = await repo.createDdcl({ title: 'T', releaseHeader: {} }, creatorId);
    await expect(
      repo.addChecklistItem(d.id, { stepId: 'missing', parameterValues: null }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('createDdcl leaves no half-written data when the header write fails', async () => {
    // PostgreSQL rejects NUL bytes in text, so the nested header insert fails after the
    // document insert; the whole nested write must roll back.
    await expect(
      repo.createDdcl({ title: 'Broken', releaseHeader: { environment: 'a\u0000b' } }, creatorId),
    ).rejects.toThrow();
    expect(await prisma.ddclDocument.count()).toBe(0);
    expect(await prisma.releaseHeader.count()).toBe(0);
  });

  it('throws DatabaseUnavailable when the connection fails', async () => {
    const bad = createUnreachablePrisma();
    const badRepo = createRepository(bad);
    try {
      await expect(badRepo.listSteps()).rejects.toBeInstanceOf(DatabaseUnavailable);
      await expect(badRepo.ping()).rejects.toMatchObject({ operation: 'health' });
    } finally {
      await bad.$disconnect();
    }
  });

  it('ping succeeds against a reachable database', async () => {
    await expect(repo.ping()).resolves.toBeUndefined();
  });
});
