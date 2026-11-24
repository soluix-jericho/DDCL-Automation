import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';

let prisma: PrismaClient;

// U2 (BR2.8): every item carries a snapshot of its step.
const SNAPSHOT = { name: 'S', category: 'C', kind: 'forward', columns: [], attachments: [] };

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

describe('data model (database behaviour)', () => {
  it('defaults Step.kind to forward and pairedRollbackStepId to null', async () => {
    const step = await prisma.step.create({ data: { name: 'Update Image', category: 'Image' } });
    expect(step.kind).toBe('forward');
    expect(step.pairedRollbackStepId).toBeNull();
    expect(step.id).toMatch(/^c/); // cuid
  });

  it('defaults DdclDocument.status to Draft and sets createdAt', async () => {
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL 1', createdBy: 'dev-user' } });
    expect(d.status).toBe('Draft');
    expect(d.createdAt).toBeInstanceOf(Date);
  });

  it('allows ReleaseHeader with only the DDCL id (all other columns nullable)', async () => {
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL', createdBy: 'dev-user' } });
    const h = await prisma.releaseHeader.create({ data: { ddclId: d.id } });
    expect(h.date).toBeNull();
    expect(h.startDate).toBeNull();
    expect(h.impactedSystem).toBeNull();
    expect(h.technicalChange).toBeNull();
  });

  it('enforces ReleaseHeader 1:1 with DdclDocument', async () => {
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL', createdBy: 'dev-user' } });
    await prisma.releaseHeader.create({ data: { ddclId: d.id } });
    await expect(prisma.releaseHeader.create({ data: { ddclId: d.id } })).rejects.toThrow();
  });

  it('links ChecklistItem to Step and DdclDocument with order defaulting to 1', async () => {
    const step = await prisma.step.create({ data: { name: 'S', category: 'C' } });
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL', createdBy: 'dev-user' } });
    const item = await prisma.checklistItem.create({
      data: { ddclId: d.id, stepId: step.id, stepSnapshot: SNAPSHOT, parameterValues: { image: 'app:1.0' } },
      include: { step: true, ddcl: true },
    });
    expect(item.order).toBe(1);
    expect(item.step?.name).toBe('S');
    expect(item.ddcl.id).toBe(d.id);
    expect(item.parameterValues).toEqual({ image: 'app:1.0' });
  });

  it('allows ChecklistItem.parameterValues to be null', async () => {
    const step = await prisma.step.create({ data: { name: 'S', category: 'C' } });
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL', createdBy: 'dev-user' } });
    const item = await prisma.checklistItem.create({
      data: { ddclId: d.id, stepId: step.id, stepSnapshot: SNAPSHOT },
    });
    expect(item.parameterValues).toBeNull();
  });

  it('rejects a ChecklistItem that references a missing Step', async () => {
    const d = await prisma.ddclDocument.create({ data: { title: 'DDCL', createdBy: 'dev-user' } });
    await expect(
      prisma.checklistItem.create({
        data: { ddclId: d.id, stepId: 'does-not-exist', stepSnapshot: SNAPSHOT },
      }),
    ).rejects.toThrow();
  });
});
