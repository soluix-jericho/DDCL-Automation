import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';

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

async function makeStep(name: string, category = 'Database', kind: 'forward' | 'rollback' = 'forward') {
  return prisma.step.create({ data: { name, category, kind } });
}

describe('migration 20261124000000_u2_step_library: indexes (NFR4.7)', () => {
  it('has the functional unique indexes and the supporting indexes in pg_indexes', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`;
    const names = rows.map((r) => r.indexname);
    for (const expected of [
      'step_name_unique',
      'bundle_name_unique',
      'ChecklistItem_stepId_idx',
      'Step_pairedRollbackStepId_idx',
      'BundleForwardMember_stepId_idx',
      'BundleRollbackMember_stepId_idx',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('rejects step names that differ only by case or surrounding spaces (same category and kind)', async () => {
    await makeStep('Update Image');
    await expect(makeStep('update image')).rejects.toMatchObject({ code: 'P2002' });
    await expect(makeStep('  Update Image  ')).rejects.toMatchObject({ code: 'P2002' });
  });

  it('allows the same name in another category or another kind', async () => {
    await makeStep('Update Image');
    await expect(makeStep('Update Image', 'Bastion')).resolves.toBeDefined();
    await expect(makeStep('Update Image', 'Database', 'rollback')).resolves.toBeDefined();
  });

  it('rejects bundle names that differ only by case or surrounding spaces', async () => {
    await prisma.stepBundle.create({ data: { name: 'Open DB' } });
    await expect(prisma.stepBundle.create({ data: { name: ' open db ' } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('records the real shape of P2002 meta.target for the expression index (note only, not relied on)', async () => {
    await makeStep('Dup');
    const err = (await makeStep('dup').catch((e) => e)) as Prisma.PrismaClientKnownRequestError;
    expect(err.code).toBe('P2002');
    // The 409 mapping never depends on this value (reliability-design.md); it is logged for the record.
    console.info('[note] P2002 meta for step_name_unique:', JSON.stringify(err.meta));
  });
});

describe('migration 20261124000000_u2_step_library: data steps on populated tables', () => {
  it('backfills stepSnapshot from Step for items created before U2', async () => {
    const step = await makeStep('Update Image', 'Image');
    const d = await prisma.ddclDocument.create({ data: { title: 'D', createdBy: 'dev-user' } });
    // A U1-era item: placeholder snapshot, then the migration's UPDATE statement.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ChecklistItem" ("id","ddclId","stepId","order","stepSnapshot") VALUES ('old1','${d.id}','${step.id}',1,'{}'::jsonb)`,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "ChecklistItem" c SET "stepSnapshot" = jsonb_build_object('id', s."id", 'name', s."name", 'category', s."category", 'kind', s."kind"::text, 'columns', '[]'::jsonb, 'attachments', '[]'::jsonb, 'pairedRollback', 'null'::jsonb) FROM "Step" s WHERE s."id" = c."stepId"`,
    );
    const row = await prisma.checklistItem.findUniqueOrThrow({ where: { id: 'old1' } });
    expect(row.stepSnapshot).toEqual({
      id: step.id,
      name: 'Update Image',
      category: 'Image',
      kind: 'forward',
      columns: [],
      attachments: [],
      pairedRollback: null,
    });
  });

  it('renames U1-era duplicate step names with a " (n)" suffix before the unique index is built', async () => {
    class Rollback extends Error {}
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('DROP INDEX "step_name_unique"');
        await tx.$executeRawUnsafe(
          `INSERT INTO "Step" ("id","name","category","kind","updatedAt") VALUES ('a1','Dup','X','forward',now()),('a2','dup ','X','forward',now()),('a3','Other','X','forward',now())`,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "Step" s SET "name" = s."name" || ' (' || d.rn || ')' FROM (SELECT "id", row_number() OVER (PARTITION BY lower(btrim("name")), "category", "kind" ORDER BY "id") AS rn FROM "Step") d WHERE d."id" = s."id" AND d.rn > 1`,
        );
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; name: string }>>(
          'SELECT "id", "name" FROM "Step" ORDER BY "id"',
        );
        expect(rows).toEqual([
          { id: 'a1', name: 'Dup' },
          { id: 'a2', name: 'dup  (2)' },
          { id: 'a3', name: 'Other' },
        ]);
        await tx.$executeRawUnsafe(
          'CREATE UNIQUE INDEX "step_name_unique" ON "Step" (lower(btrim("name")), "category", "kind")',
        );
        throw new Rollback(); // DDL is transactional in PostgreSQL: the index and rows roll back
      }),
    ).rejects.toBeInstanceOf(Rollback);
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes WHERE indexname = 'step_name_unique'`;
    expect(idx).toHaveLength(1);
  });
});
