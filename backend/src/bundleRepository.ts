import { Prisma, PrismaClient } from '@prisma/client';
import { withDb } from './db';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { withLibraryTx } from './libraryTx';
import type { BundleInput, ListQuery } from './stepRules';
import { DbClient, RepoContext, StepDetail, toStepDetail } from './stepRepository';
import { STEP_CONTENT_INCLUDE } from './stepSnapshot';
import { escapeLike } from './stepText';

export interface BundleListItem {
  id: string;
  name: string;
  category: string | null;
  forwardCount: number;
  rollbackCount: number;
  createdAt: string;
  updatedAt: string;
}

/** BR2.14: ordered forward members and the bundle's own ordered rollback sequence, each with full step content. */
export interface BundleDetail {
  id: string;
  name: string;
  category: string | null;
  forward: StepDetail[];
  rollback: StepDetail[];
  createdAt: string;
  updatedAt: string;
}

const BUNDLE_INCLUDE = {
  forwardMembers: {
    orderBy: { position: 'asc' },
    include: { step: { include: STEP_CONTENT_INCLUDE } },
  },
  rollbackMembers: {
    orderBy: { position: 'asc' },
    include: { step: { include: STEP_CONTENT_INCLUDE } },
  },
} as const satisfies Prisma.StepBundleInclude;

function toBundleDetail(b: Prisma.StepBundleGetPayload<{ include: typeof BUNDLE_INCLUDE }>): BundleDetail {
  return {
    id: b.id,
    name: b.name,
    category: b.category,
    forward: b.forwardMembers.map((m) => toStepDetail(m.step)),
    rollback: b.rollbackMembers.map((m) => toStepDetail(m.step)),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export async function readBundleDetail(db: DbClient, id: string): Promise<BundleDetail | null> {
  const row = await db.stepBundle.findUnique({ where: { id }, include: BUNDLE_INCLUDE });
  return row ? toBundleDetail(row) : null;
}

async function bundleNameConflict(db: DbClient, name: string, excludeId?: string): Promise<ConflictError | null> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "StepBundle"
    WHERE lower(btrim(name)) = lower(btrim(${name}))
    ${excludeId ? Prisma.sql`AND id <> ${excludeId}` : Prisma.empty}
    LIMIT 1`;
  const id = rows[0]?.id;
  if (!id) return null;
  return new ConflictError(`Bundle dengan nama "${name}" sudah ada`, await readBundleDetail(db, id), 'bundle');
}

/** BR2.11: every member must exist, forward members must be forward steps, rollback members rollback steps. */
async function verifyMembers(tx: Prisma.TransactionClient, input: BundleInput): Promise<void> {
  const ids = [...input.forwardStepIds, ...input.rollbackStepIds];
  const steps = await tx.step.findMany({ where: { id: { in: ids } }, select: { id: true, kind: true } });
  const kindById = new Map(steps.map((s) => [s.id, s.kind]));
  for (const [field, list, kind] of [
    ['forwardStepIds', input.forwardStepIds, 'forward'],
    ['rollbackStepIds', input.rollbackStepIds, 'rollback'],
  ] as const) {
    for (const id of list) {
      const actual = kindById.get(id);
      if (!actual) throw new ValidationError(`Step tidak ditemukan: ${id}`, [field]);
      if (actual !== kind) {
        throw new ValidationError(`Anggota ${field === 'forwardStepIds' ? 'forward' : 'rollback'} harus berupa step ${kind}: ${id}`, [field]);
      }
    }
  }
}

async function writeMembers(tx: Prisma.TransactionClient, bundleId: string, input: BundleInput): Promise<void> {
  await tx.bundleForwardMember.createMany({
    data: input.forwardStepIds.map((stepId, i) => ({ bundleId, stepId, position: i + 1 })),
  });
  if (input.rollbackStepIds.length > 0) {
    await tx.bundleRollbackMember.createMany({
      data: input.rollbackStepIds.map((stepId, i) => ({ bundleId, stepId, position: i + 1 })),
    });
  }
}

export function createBundleRepository(prisma: PrismaClient, ctx: RepoContext) {
  const onRetry = (info: { operation: string; retry: number; code: string }) =>
    ctx.warn({ ...info }, 'Library transaction retried');

  async function mapUniqueViolation(err: unknown, name: string, excludeId?: string): Promise<never> {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const conflict = await bundleNameConflict(prisma, name, excludeId);
      if (conflict) throw conflict;
    }
    throw err;
  }

  return {
    listBundles(query: ListQuery = { q: null, category: null }): Promise<BundleListItem[]> {
      return withDb('listBundles', async () => {
        const where: Prisma.StepBundleWhereInput = {};
        if (query.q) where.name = { contains: escapeLike(query.q), mode: 'insensitive' };
        if (query.category) where.category = query.category;
        const rows = await prisma.stepBundle.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { forwardMembers: true, rollbackMembers: true } },
          },
        });
        return rows.map((b) => ({
          id: b.id,
          name: b.name,
          category: b.category,
          forwardCount: b._count.forwardMembers,
          rollbackCount: b._count.rollbackMembers,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        }));
      });
    },

    getBundle(id: string): Promise<BundleDetail> {
      return withDb('getBundle', async () => {
        const bundle = await readBundleDetail(prisma, id);
        if (!bundle) throw new NotFoundError(`Bundle tidak ditemukan: ${id}`);
        return bundle;
      });
    },

    createBundle(input: BundleInput): Promise<BundleDetail> {
      return withDb('createBundle', async () => {
        try {
          return await withLibraryTx(prisma, {
            operation: 'createBundle',
            onRetry,
            candidates: async () => ({ stepIds: [...input.forwardStepIds, ...input.rollbackStepIds], bundleIds: [] }),
            fn: async (tx) => {
              const conflict = await bundleNameConflict(tx, input.name);
              if (conflict) throw conflict;
              await verifyMembers(tx, input);
              const created = await tx.stepBundle.create({
                data: { name: input.name, category: input.category },
                select: { id: true },
              });
              await writeMembers(tx, created.id, input);
              return (await readBundleDetail(tx, created.id)) as BundleDetail;
            },
          });
        } catch (err) {
          return mapUniqueViolation(err, input.name);
        }
      });
    },

    updateBundle(id: string, input: BundleInput): Promise<BundleDetail> {
      return withDb('updateBundle', async () => {
        try {
          return await withLibraryTx(prisma, {
            operation: 'updateBundle',
            onRetry,
            candidates: async (tx) => {
              const [fwd, rb] = await Promise.all([
                tx.bundleForwardMember.findMany({ where: { bundleId: id }, select: { stepId: true } }),
                tx.bundleRollbackMember.findMany({ where: { bundleId: id }, select: { stepId: true } }),
              ]);
              return {
                bundleIds: [id],
                stepIds: [...fwd, ...rb].map((m) => m.stepId).concat(input.forwardStepIds, input.rollbackStepIds),
              };
            },
            fn: async (tx) => {
              const exists = await tx.stepBundle.findUnique({ where: { id }, select: { id: true } });
              if (!exists) throw new NotFoundError(`Bundle tidak ditemukan: ${id}`);
              const conflict = await bundleNameConflict(tx, input.name, id);
              if (conflict) throw conflict;
              await verifyMembers(tx, input);
              await tx.bundleForwardMember.deleteMany({ where: { bundleId: id } });
              await tx.bundleRollbackMember.deleteMany({ where: { bundleId: id } });
              await writeMembers(tx, id, input);
              await tx.stepBundle.update({ where: { id }, data: { name: input.name, category: input.category } });
              return (await readBundleDetail(tx, id)) as BundleDetail;
            },
          });
        } catch (err) {
          return mapUniqueViolation(err, input.name, id);
        }
      });
    },

    /** Deleting a bundle never deletes the steps in it (BR2.11). */
    deleteBundle(id: string): Promise<{ id: string; name: string; forwardCount: number; rollbackCount: number }> {
      return withDb('deleteBundle', () =>
        withLibraryTx(prisma, {
          operation: 'deleteBundle',
          onRetry,
          candidates: async () => ({ bundleIds: [id], stepIds: [] }),
          fn: async (tx) => {
            const bundle = await tx.stepBundle.findUnique({
              where: { id },
              select: { id: true, name: true, _count: { select: { forwardMembers: true, rollbackMembers: true } } },
            });
            if (!bundle) throw new NotFoundError(`Bundle tidak ditemukan: ${id}`);
            await tx.stepBundle.delete({ where: { id } });
            return {
              id: bundle.id,
              name: bundle.name,
              forwardCount: bundle._count.forwardMembers,
              rollbackCount: bundle._count.rollbackMembers,
            };
          },
        }),
      );
    },
  };
}

export type BundleRepository = ReturnType<typeof createBundleRepository>;
