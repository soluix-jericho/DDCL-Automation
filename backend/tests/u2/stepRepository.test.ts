import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../../src/errors';
import { createRepository, Repository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { seedDdclWithItem, seedRollback, seedStep, stepBody } from './helpers';

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

describe('createStep (BR2.1, BR2.2, BR2.4, BR2.5)', () => {
  it('stores columns, numbered lines and attachments and derives variables', async () => {
    const step = await repo.createStep(
      stepBody({
        columns: [
          { label: 'Persiapan', lines: ['cek {host}', 'ping {host} {port}'] },
          { label: null, lines: ['selesai {{literal}}'] },
        ],
        attachments: [{ filename: 'q.sql', content: 'select {1}' }],
      }),
    );
    expect(step.columns).toEqual([
      { label: 'Persiapan', lines: ['cek {host}', 'ping {host} {port}'] },
      { label: null, lines: ['selesai {{literal}}'] },
    ]);
    expect(step.attachments).toEqual([{ filename: 'q.sql', content: 'select {1}' }]);
    expect(step.variables).toEqual(['host', 'port']);
    const cols = await prisma.stepColumn.findMany({ where: { stepId: step.id }, orderBy: { position: 'asc' } });
    expect(cols.map((c) => c.position)).toEqual([1, 2]);
    const lines = await prisma.stepLine.findMany({ where: { columnId: cols[0]?.id }, orderBy: { position: 'asc' } });
    expect(lines.map((l) => l.position)).toEqual([1, 2]);
  });

  it('creates a step at the maximum size in one go', async () => {
    const columns = Array.from({ length: 10 }, (_, c) => ({
      label: `k${c}`,
      lines: Array.from({ length: 50 }, (_, l) => `langkah ${c}-${l}`),
    }));
    const step = await repo.createStep(stepBody({ columns }));
    expect(await prisma.stepLine.count()).toBe(500);
    expect(step.columns).toHaveLength(10);
  });

  it('creates a forward step and a new rollback step as a pair, atomically (BR2.9)', async () => {
    const step = await repo.createStep(
      stepBody({
        name: 'Maju',
        rollbackStep: { ...stepBody({ name: 'Mundur', kind: 'rollback' }), kind: 'rollback' },
      }),
    );
    expect(step.pairedRollbackStepId).toBeTruthy();
    const partner = await repo.getStep(step.pairedRollbackStepId as string);
    expect(partner).toMatchObject({ name: 'Mundur', kind: 'rollback', pairedRollbackStepId: null });
  });

  it('pairs with an existing rollback step', async () => {
    const rb = await seedRollback(repo);
    const step = await seedStep(repo, { pairedRollbackStepId: rb.id });
    expect(step.pairedRollbackStepId).toBe(rb.id);
  });

  it.each([
    ['a missing step', async () => 'nope'],
    ['a forward step', async () => (await seedStep(repo, { name: 'Other' })).id],
  ])('rejects a pair that points at %s with 400 and stores nothing', async (_label, target) => {
    const id = await target();
    const before = await prisma.step.count();
    await expect(seedStep(repo, { name: 'Baru', pairedRollbackStepId: id })).rejects.toBeInstanceOf(ValidationError);
    expect(await prisma.step.count()).toBe(before);
  });
});

describe('duplicate names (BR2.3)', () => {
  it('rejects the same name/category/kind (ignoring case and spaces) with the full existing step', async () => {
    const first = await seedStep(repo, { name: 'Update Image', attachments: [{ filename: 'a.yaml', content: 'x: 1' }] });
    const err = (await seedStep(repo, { name: 'update image' }).catch((e) => e)) as ConflictError;
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.conflictOn).toBe('step');
    expect(err.existing).toMatchObject({ id: first.id, name: 'Update Image', attachments: [{ filename: 'a.yaml' }] });
    expect(await prisma.step.count()).toBe(1);
  });

  it('allows the same name in another category or kind', async () => {
    await seedStep(repo, { name: 'Same' });
    await expect(seedStep(repo, { name: 'Same', category: 'Bastion' })).resolves.toBeDefined();
    await expect(seedRollback(repo, 'Same')).resolves.toBeDefined();
  });

  it('rejects the whole request when the inline rollbackStep clashes: nothing is stored', async () => {
    const existing = await seedRollback(repo, 'Undo');
    const err = (await repo
      .createStep(
        stepBody({ name: 'Baru', rollbackStep: { ...stepBody({ name: 'undo', kind: 'rollback' }), kind: 'rollback' } }),
      )
      .catch((e) => e)) as ConflictError;
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.conflictOn).toBe('rollbackStep');
    expect((err.existing as { id: string }).id).toBe(existing.id);
    expect(await prisma.step.count()).toBe(1);
  });

  it('rejects the whole request when the main step clashes, so the inline rollbackStep is not stored', async () => {
    await seedStep(repo, { name: 'Maju' });
    const err = (await repo
      .createStep(
        stepBody({ name: 'MAJU', rollbackStep: { ...stepBody({ name: 'Mundur', kind: 'rollback' }), kind: 'rollback' } }),
      )
      .catch((e) => e)) as ConflictError;
    expect(err.conflictOn).toBe('step');
    expect(await prisma.step.count()).toBe(1);
  });

  it('maps a unique-index race (two creates at once) to one success and one 409, never a 500', async () => {
    const results = await Promise.allSettled([
      seedStep(repo, { name: 'Race' }),
      seedStep(repo, { name: 'race' }),
      seedStep(repo, { name: ' RACE ' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const r of results) {
      if (r.status === 'rejected') expect(r.reason).toBeInstanceOf(ConflictError);
    }
    expect(await prisma.step.count()).toBe(1);
  });
});

describe('updateStep (BR2.1, BR2.8, BR2.9)', () => {
  it('replaces columns, lines and attachments completely', async () => {
    const step = await seedStep(repo, { attachments: [{ filename: 'old.txt', content: 'o' }] });
    const updated = await repo.updateStep(
      step.id,
      stepBody({
        name: 'Nama baru',
        kind: undefined,
        pairedRollbackStepId: undefined,
        columns: [{ label: 'Baru', lines: ['satu'] }],
        attachments: [{ filename: 'new.txt', content: 'n' }],
      }),
    );
    expect(updated).toMatchObject({
      name: 'Nama baru',
      columns: [{ label: 'Baru', lines: ['satu'] }],
      attachments: [{ filename: 'new.txt', content: 'n' }],
    });
    expect(await prisma.stepColumn.count()).toBe(1);
    expect(await prisma.stepLine.count()).toBe(1);
    expect(await prisma.stepAttachment.count()).toBe(1);
  });

  it('keeps the pair when the field is absent, clears it on null, replaces it with an id or inline step', async () => {
    const rb1 = await seedRollback(repo, 'Undo 1');
    const rb2 = await seedRollback(repo, 'Undo 2');
    const step = await seedStep(repo, { pairedRollbackStepId: rb1.id });
    const keep = await repo.updateStep(step.id, stepBody({ kind: undefined, pairedRollbackStepId: undefined }));
    expect(keep.pairedRollbackStepId).toBe(rb1.id);
    const swapped = await repo.updateStep(step.id, stepBody({ kind: undefined, pairedRollbackStepId: rb2.id }));
    expect(swapped.pairedRollbackStepId).toBe(rb2.id);
    const inline = await repo.updateStep(
      step.id,
      stepBody({
        kind: undefined,
        pairedRollbackStepId: undefined,
        rollbackStep: { ...stepBody({ name: 'Undo 3', kind: 'rollback' }), kind: 'rollback' },
      }),
    );
    expect(inline.pairedRollbackStepId).not.toBe(rb2.id);
    expect((await repo.getStep(inline.pairedRollbackStepId as string)).name).toBe('Undo 3');
    const cleared = await repo.updateStep(step.id, stepBody({ kind: undefined, pairedRollbackStepId: null }));
    expect(cleared.pairedRollbackStepId).toBeNull();
  });

  it('refuses to change kind (400), pair a rollback step, or pair a step with itself', async () => {
    const rb = await seedRollback(repo);
    const fwd = await seedStep(repo);
    await expect(repo.updateStep(fwd.id, stepBody({ kind: 'rollback' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.updateStep(rb.id, stepBody({ kind: undefined, name: 'Undo', pairedRollbackStepId: fwd.id })),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      repo.updateStep(rb.id, stepBody({ kind: undefined, name: 'Undo', pairedRollbackStepId: rb.id })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a rename onto another step (409) but allows saving a step under its own name', async () => {
    const a = await seedStep(repo, { name: 'A' });
    await seedStep(repo, { name: 'B' });
    await expect(repo.updateStep(a.id, stepBody({ kind: undefined, name: 'b' }))).rejects.toBeInstanceOf(ConflictError);
    await expect(repo.updateStep(a.id, stepBody({ kind: undefined, name: 'a' }))).resolves.toBeDefined();
  });

  it('answers NotFoundError for an unknown step and changes nothing', async () => {
    await expect(repo.updateStep('nope', stepBody({ kind: undefined }))).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rolls back everything when the update fails midway (inline rollback clash)', async () => {
    await seedRollback(repo, 'Taken');
    const step = await seedStep(repo, { name: 'Orig', columns: [{ label: null, lines: ['asli'] }] });
    await expect(
      repo.updateStep(
        step.id,
        stepBody({
          kind: undefined,
          name: 'Changed',
          columns: [{ label: null, lines: ['ubah'] }],
          rollbackStep: { ...stepBody({ name: 'taken', kind: 'rollback' }), kind: 'rollback' },
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await repo.getStep(step.id)).toMatchObject({ name: 'Orig', columns: [{ lines: ['asli'] }] });
  });
});

describe('listSteps and categories (BR2.6, BR2.10, BR2.12, BR2.13, NFR1.11)', () => {
  it('returns summaries only: counts, no step text or attachment content', async () => {
    await seedStep(repo, { attachments: [{ filename: 'a', content: 'SECRET' }] });
    const [item] = await repo.listSteps();
    expect(item).toMatchObject({ columnCount: 1, attachmentCount: 1, usageCount: 0, missingRollback: true });
    expect(JSON.stringify(item)).not.toMatch(/SECRET|kubectl/);
    expect(item).not.toHaveProperty('columns');
  });

  it('marks forward steps without a rollback pair, not paired ones or rollback steps', async () => {
    const rb = await seedRollback(repo, 'Undo');
    await seedStep(repo, { name: 'Paired', pairedRollbackStepId: rb.id });
    await seedStep(repo, { name: 'Alone' });
    const byName = Object.fromEntries((await repo.listSteps()).map((s) => [s.name, s.missingRollback]));
    expect(byName).toEqual({ Alone: true, Paired: false, Undo: false });
  });

  it('counts distinct DDCLs per step (one DDCL using it twice counts once), items without a step count nowhere', async () => {
    const step = await seedStep(repo, { name: 'Used' });
    const other = await seedStep(repo, { name: 'Unused' });
    const { ddcl } = await seedDdclWithItem(repo, step.id, 'D1');
    await repo.addChecklistItem(ddcl.id, { stepId: step.id, parameterValues: null });
    await seedDdclWithItem(repo, step.id, 'D2');
    const usage = Object.fromEntries((await repo.listSteps()).map((s) => [s.name, s.usageCount]));
    expect(usage).toEqual({ Used: 2, Unused: 0 });
    await repo.deleteStep(step.id);
    expect((await repo.listSteps()).map((s) => s.id)).toEqual([other.id]);
  });

  it('searches by name case-insensitively and filters by category, server-side', async () => {
    await seedStep(repo, { name: 'Update Image', category: 'Database' });
    await seedStep(repo, { name: 'Open Port', category: 'Bastion' });
    expect((await repo.listSteps({ q: 'IMAGE', category: null })).map((s) => s.name)).toEqual(['Update Image']);
    expect((await repo.listSteps({ q: null, category: 'Bastion' })).map((s) => s.name)).toEqual(['Open Port']);
    expect(await repo.listSteps({ q: 'image', category: 'Bastion' })).toEqual([]);
    expect(await repo.listSteps({ q: 'zzz', category: null })).toEqual([]);
  });

  it('treats % and _ in q as literal characters (NFR2.9)', async () => {
    await seedStep(repo, { name: 'Disk 100% full' });
    await seedStep(repo, { name: 'snake_case step' });
    await seedStep(repo, { name: 'Ordinary' });
    expect((await repo.listSteps({ q: '%', category: null })).map((s) => s.name)).toEqual(['Disk 100% full']);
    expect((await repo.listSteps({ q: '_', category: null })).map((s) => s.name)).toEqual(['snake_case step']);
    expect((await repo.listSteps({ q: 'e_c', category: null })).map((s) => s.name)).toEqual(['snake_case step']);
    expect(await repo.listSteps({ q: 'Dis_ 1', category: null })).toEqual([]);
  });

  it('keeps a backslash in q from breaking the query', async () => {
    await seedStep(repo, { name: 'Path C:\\temp' });
    await seedStep(repo, { name: 'Other' });
    expect((await repo.listSteps({ q: '\\', category: null })).map((s) => s.name)).toEqual(['Path C:\\temp']);
    expect((await repo.listSteps({ q: 'C:\\t', category: null })).map((s) => s.name)).toEqual(['Path C:\\temp']);
    expect(await repo.listSteps({ q: '\\\\', category: null })).toEqual([]);
  });

  it('lists the four fixed categories as { name }', () => {
    expect(repo.listCategories()).toEqual([
      { name: 'Database' },
      { name: 'Bastion' },
      { name: 'RabbitMQ' },
      { name: 'Keycloak' },
    ]);
  });
});

describe('getStep', () => {
  it('returns full content with derived variables and timestamps, or NotFoundError', async () => {
    const step = await seedStep(repo);
    const got = await repo.getStep(step.id);
    expect(got.variables).toEqual(['file', 'pod']);
    expect(new Date(got.updatedAt).getTime()).toBeGreaterThan(0);
    await expect(repo.getStep('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
