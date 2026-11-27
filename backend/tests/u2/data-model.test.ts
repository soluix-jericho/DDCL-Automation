import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeUser } from '../u4/helpers';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

const SNAPSHOT = { name: 'S', category: 'Database', kind: 'forward', columns: [], attachments: [] };

async function makeStep(name = 'Step A', category = 'Database', kind: 'forward' | 'rollback' = 'forward') {
  return prisma.step.create({ data: { name, category, kind } });
}

async function makeDdcl() {
  return prisma.ddclDocument.create({ data: { title: 'D', createdByUserId: (await makeUser(prisma)).id } });
}

describe('Step columns, lines and attachments', () => {
  it('sets createdAt/updatedAt on Step and allows a null label on StepColumn', async () => {
    const step = await makeStep();
    expect(step.createdAt).toBeInstanceOf(Date);
    expect(step.updatedAt).toBeInstanceOf(Date);
    const col = await prisma.stepColumn.create({ data: { stepId: step.id, position: 1 } });
    expect(col.label).toBeNull();
  });

  it('rejects a second column with the same (stepId, position)', async () => {
    const step = await makeStep();
    await prisma.stepColumn.create({ data: { stepId: step.id, position: 1 } });
    await expect(prisma.stepColumn.create({ data: { stepId: step.id, position: 1 } })).rejects.toThrow();
  });

  it('rejects a second line with the same (columnId, position)', async () => {
    const step = await makeStep();
    const col = await prisma.stepColumn.create({ data: { stepId: step.id, position: 1 } });
    await prisma.stepLine.create({ data: { columnId: col.id, position: 1, text: 'a' } });
    await expect(
      prisma.stepLine.create({ data: { columnId: col.id, position: 1, text: 'b' } }),
    ).rejects.toThrow();
  });

  it('rejects a duplicate attachment filename within one step but allows it across steps', async () => {
    const a = await makeStep('A');
    const b = await makeStep('B');
    await prisma.stepAttachment.create({
      data: { stepId: a.id, filename: 'x.yaml', content: 'c', position: 1 },
    });
    await expect(
      prisma.stepAttachment.create({ data: { stepId: a.id, filename: 'x.yaml', content: 'c', position: 2 } }),
    ).rejects.toThrow();
    await expect(
      prisma.stepAttachment.create({ data: { stepId: b.id, filename: 'x.yaml', content: 'c', position: 1 } }),
    ).resolves.toBeDefined();
  });

  it('cascades deletion of a step to its columns, lines and attachments', async () => {
    const step = await makeStep();
    const col = await prisma.stepColumn.create({ data: { stepId: step.id, position: 1 } });
    await prisma.stepLine.create({ data: { columnId: col.id, position: 1, text: 'a' } });
    await prisma.stepAttachment.create({
      data: { stepId: step.id, filename: 'f.sql', content: 'select 1', position: 1 },
    });
    await prisma.step.delete({ where: { id: step.id } });
    expect(await prisma.stepColumn.count()).toBe(0);
    expect(await prisma.stepLine.count()).toBe(0);
    expect(await prisma.stepAttachment.count()).toBe(0);
  });
});

describe('ChecklistItem snapshot (BR2.8)', () => {
  it('allows a null stepId but requires stepSnapshot', async () => {
    const d = await makeDdcl();
    const ok = await prisma.checklistItem.create({
      data: { ddclId: d.id, stepId: null, stepSnapshot: SNAPSHOT },
    });
    expect(ok.stepId).toBeNull();
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "ChecklistItem" ("id","ddclId","order") VALUES ('x', '${d.id}', 1)`,
      ),
    ).rejects.toThrow();
  });

  it('refuses deleting a step an item still references (RESTRICT; the delete code clears it first)', async () => {
    const step = await makeStep();
    const d = await makeDdcl();
    await prisma.checklistItem.create({ data: { ddclId: d.id, stepId: step.id, stepSnapshot: SNAPSHOT } });
    await expect(prisma.step.delete({ where: { id: step.id } })).rejects.toThrow();
  });
});

describe('bundle membership constraints', () => {
  it('enforces unique positions within a bundle and cascades on bundle deletion', async () => {
    const bundle = await prisma.stepBundle.create({ data: { name: 'B' } });
    const a = await makeStep('A');
    const b = await makeStep('B');
    await prisma.bundleForwardMember.create({ data: { bundleId: bundle.id, stepId: a.id, position: 1 } });
    await expect(
      prisma.bundleForwardMember.create({ data: { bundleId: bundle.id, stepId: b.id, position: 1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.bundleForwardMember.create({ data: { bundleId: bundle.id, stepId: a.id, position: 2 } }),
    ).rejects.toThrow();
    await prisma.stepBundle.delete({ where: { id: bundle.id } });
    expect(await prisma.bundleForwardMember.count()).toBe(0);
    expect(await prisma.step.count()).toBe(2); // steps are not deleted with the bundle
  });

  it('removes memberships when a member step is deleted', async () => {
    const bundle = await prisma.stepBundle.create({ data: { name: 'B' } });
    const a = await makeStep('A');
    await prisma.bundleForwardMember.create({ data: { bundleId: bundle.id, stepId: a.id, position: 1 } });
    await prisma.step.delete({ where: { id: a.id } });
    expect(await prisma.bundleForwardMember.count()).toBe(0);
    expect(await prisma.stepBundle.count()).toBe(1);
  });
});
