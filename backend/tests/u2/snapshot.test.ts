import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotFoundError } from '../../src/errors';
import { exportDdclToXlsx } from '../../src/excel';
import { createRepository, Repository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeUser } from '../u4/helpers';
import { buildFixtureTemplate, cleanTmp, readBack } from '../helpers/template';
import { seedDdclWithItem, seedRollback, seedStep, stepBody } from './helpers';

let prisma: PrismaClient;
let repo: Repository;
let templatePath: string;

beforeAll(async () => {
  prisma = createTestPrisma();
  repo = createRepository(prisma);
  templatePath = await buildFixtureTemplate('u2-snapshot.xlsx');
});
afterAll(async () => {
  await prisma.$disconnect();
  await cleanTmp();
});
beforeEach(async () => {
  await truncateAll(prisma);
  await makeUser(prisma); // U4: every DDCL needs a creator account
});

async function snapshotText(itemId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ s: string }>>`
    SELECT "stepSnapshot"::text AS s FROM "ChecklistItem" WHERE id = ${itemId}`;
  return rows[0]?.s as string;
}

describe('stepSnapshot (BR2.8)', () => {
  it('is a full copy of the step and of its rollback partner, taken when the item is created', async () => {
    const rb = await seedRollback(repo, 'Undo', { columns: [{ label: 'U', lines: ['balik {x}'] }] });
    const step = await seedStep(repo, {
      name: 'Maju',
      pairedRollbackStepId: rb.id,
      attachments: [{ filename: 'a.sql', content: 'select 1' }],
    });
    const { item } = await seedDdclWithItem(repo, step.id);
    const stored = await prisma.checklistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.stepId).toBe(step.id);
    expect(stored.stepSnapshot).toMatchObject({
      id: step.id,
      name: 'Maju',
      category: 'Database',
      kind: 'forward',
      attachments: [{ filename: 'a.sql', content: 'select 1' }],
      pairedRollback: { id: rb.id, name: 'Undo', columns: [{ label: 'U', lines: ['balik {x}'] }] },
    });
  });

  it('is not changed by editing the step or replacing its rollback partner', async () => {
    const rb = await seedRollback(repo, 'Undo');
    const step = await seedStep(repo, { pairedRollbackStepId: rb.id });
    const { item } = await seedDdclWithItem(repo, step.id);
    const before = await snapshotText(item.id);
    await repo.updateStep(
      step.id,
      stepBody({ kind: undefined, name: 'Diubah', columns: [{ label: null, lines: ['baru'] }], pairedRollbackStepId: null }),
    );
    await repo.updateStep(rb.id, stepBody({ kind: undefined, name: 'Undo diubah' }));
    expect(await snapshotText(item.id)).toBe(before);
    const fresh = await seedDdclWithItem(repo, step.id, 'Baru');
    expect(await snapshotText(fresh.item.id)).toContain('Diubah'); // only new items use the new content
  });

  it('survives deleting the step byte for byte, and the item only loses its stepId (BR2.7)', async () => {
    const rb = await seedRollback(repo, 'Undo');
    const step = await seedStep(repo, { name: 'Dihapus', pairedRollbackStepId: rb.id });
    const { ddcl, item } = await seedDdclWithItem(repo, step.id);
    const before = await snapshotText(item.id);

    const impact = await repo.deleteStep(step.id);
    expect(impact).toMatchObject({ usageCount: 1, checklistItems: 1 });

    expect(await snapshotText(item.id)).toBe(before);
    const stored = await prisma.checklistItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(stored.stepId).toBeNull();
    const full = await repo.getDdclForExport(ddcl.id);
    expect(full?.checklistItems[0]).toMatchObject({ stepId: null, step: { name: 'Dihapus' } });
    expect(await prisma.step.findUnique({ where: { id: step.id } })).toBeNull();
  });

  it('clears the pair pointer of forward steps whose rollback partner is deleted and reports them', async () => {
    const rb = await seedRollback(repo, 'Undo');
    const a = await seedStep(repo, { name: 'A', pairedRollbackStepId: rb.id });
    const b = await seedStep(repo, { name: 'B', pairedRollbackStepId: rb.id });
    const { item } = await seedDdclWithItem(repo, a.id);
    const before = await snapshotText(item.id);
    const impact = await repo.deleteStep(rb.id);
    expect(impact.pairLost.map((s) => s.name)).toEqual(['A', 'B']);
    expect((await repo.getStep(a.id)).pairedRollbackStepId).toBeNull();
    expect((await repo.getStep(b.id)).pairedRollbackStepId).toBeNull();
    expect(await snapshotText(item.id)).toBe(before); // the DDCL still holds its copy of the partner
  });

  it('exports an old DDCL with the snapshot name even after the step was deleted', async () => {
    const step = await seedStep(repo, { name: 'Nama Asli' });
    const { ddcl } = await seedDdclWithItem(repo, step.id);
    await repo.deleteStep(step.id);
    const wb = await readBack(await exportDdclToXlsx(templatePath, (await repo.getDdclForExport(ddcl.id))!));
    expect(wb.getWorksheet('Deployment Check List')!.getCell('B13').value).toBe('Nama Asli');
  });

  it('answers NotFoundError and creates no item when the step is gone (no half-written item)', async () => {
    const ddcl = await repo.createDdcl({ title: 'T', releaseHeader: {} }, (await repo.listUsers())[0]!.id);
    await expect(repo.addChecklistItem(ddcl.id, { stepId: 'gone', parameterValues: null })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await prisma.checklistItem.count()).toBe(0);
  });

  it('returns a 404-style error for a deleted step and for an unknown step on delete and impact', async () => {
    await expect(repo.deleteStep('nope')).rejects.toBeInstanceOf(NotFoundError);
    await expect(repo.getDeleteImpact('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
