import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { withDb } from './db';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { withLibraryTx } from './libraryTx';
import type { ListQuery, StepBase, StepInput } from './stepRules';
import {
  STEP_CONTENT_INCLUDE,
  StepContent,
  toStepContent,
} from './stepSnapshot';
import { CATEGORIES, escapeLike, extractVariables } from './stepText';

export type DbClient = Prisma.TransactionClient | PrismaClient;

/** Where repository code reports warnings (deadlock retries); buildApp points it at the Fastify logger. */
export interface RepoContext {
  warn: (obj: Record<string, unknown>, msg: string) => void;
}

export interface StepListItem {
  id: string;
  name: string;
  category: string;
  kind: 'forward' | 'rollback';
  pairedRollbackStepId: string | null;
  columnCount: number;
  attachmentCount: number;
  usageCount: number;
  /** BR2.10: a forward step without a rollback partner. */
  missingRollback: boolean;
}

export interface StepDetail extends StepContent {
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

/** BR2.7: what deleting a step does; reported before (GET .../impact) and after (DELETE) the delete. */
export interface DeleteImpact {
  usageCount: number;
  checklistItems: number;
  bundlesRemoved: NamedRef[];
  bundlesChanged: NamedRef[];
  pairLost: NamedRef[];
}

export function toStepDetail(
  s: Prisma.StepGetPayload<{ include: typeof STEP_CONTENT_INCLUDE }>,
): StepDetail {
  const content = toStepContent(s);
  return {
    ...content,
    variables: extractVariables(content.columns.flatMap((c) => c.lines)),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function readStepDetail(db: DbClient, id: string): Promise<StepDetail | null> {
  const row = await db.step.findUnique({ where: { id }, include: STEP_CONTENT_INCLUDE });
  return row ? toStepDetail(row) : null;
}

/** Another step with the same (lower(btrim(name)), category, kind), as the unique index sees it (BR2.3). */
export async function findStepNameConflict(
  db: DbClient,
  name: string,
  category: string,
  kind: string,
  excludeId?: string,
): Promise<string | null> {
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Step"
    WHERE lower(btrim(name)) = lower(btrim(${name})) AND category = ${category} AND kind = ${kind}::"StepKind"
    ${excludeId ? Prisma.sql`AND id <> ${excludeId}` : Prisma.empty}
    LIMIT 1`;
  return rows[0]?.id ?? null;
}

async function conflictFor(
  db: DbClient,
  on: 'step' | 'rollbackStep',
  base: { name: string; category: string },
  kind: string,
  excludeId?: string,
): Promise<ConflictError | null> {
  const id = await findStepNameConflict(db, base.name, base.category, kind, excludeId);
  if (!id) return null;
  const existing = await readStepDetail(db, id);
  return new ConflictError(
    `Step dengan nama "${base.name}" sudah ada di kategori ${base.category}`,
    existing,
    on,
  );
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** Replaces columns, lines and attachments of a step with `createMany` (few statements even at the limits). */
async function writeContent(tx: Prisma.TransactionClient, stepId: string, base: StepBase): Promise<void> {
  const columns = base.columns.map((c, i) => ({ id: randomUUID(), stepId, position: i + 1, label: c.label }));
  await tx.stepColumn.createMany({ data: columns });
  const lines = base.columns.flatMap((c, ci) =>
    c.lines.map((text, li) => ({ columnId: columns[ci]?.id as string, position: li + 1, text })),
  );
  if (lines.length > 0) await tx.stepLine.createMany({ data: lines });
  if (base.attachments.length > 0) {
    await tx.stepAttachment.createMany({
      data: base.attachments.map((a, i) => ({ stepId, filename: a.filename, content: a.content, position: i + 1 })),
    });
  }
}

async function insertStep(
  tx: Prisma.TransactionClient,
  base: StepBase,
  kind: 'forward' | 'rollback',
  pairedRollbackStepId: string | null,
): Promise<string> {
  const created = await tx.step.create({
    data: { name: base.name, category: base.category, kind, pairedRollbackStepId },
    select: { id: true },
  });
  await writeContent(tx, created.id, base);
  return created.id;
}

/** BR2.9: the paired step must exist, be a rollback step and not be the step itself. */
async function requireRollbackTarget(tx: Prisma.TransactionClient, targetId: string, selfId?: string): Promise<void> {
  if (targetId === selfId) {
    throw new ValidationError('Step tidak bisa menjadi pasangan rollback dirinya sendiri', ['pairedRollbackStepId']);
  }
  const target = await tx.step.findUnique({ where: { id: targetId }, select: { kind: true } });
  if (!target) throw new ValidationError('Step pasangan rollback tidak ditemukan', ['pairedRollbackStepId']);
  if (target.kind !== 'rollback') {
    throw new ValidationError('Pasangan rollback harus berupa step berjenis rollback', ['pairedRollbackStepId']);
  }
}

export function createStepRepository(prisma: PrismaClient, ctx: RepoContext) {
  const onRetry = (info: { operation: string; retry: number; code: string }) =>
    ctx.warn({ ...info }, 'Library transaction retried');

  /** Maps a unique-index race (P2002, shape of meta.target not relied on) to a 409 by looking the row up again. */
  async function mapUniqueViolation(
    err: unknown,
    checks: Array<{ on: 'step' | 'rollbackStep'; base: { name: string; category: string }; kind: string; excludeId?: string }>,
  ): Promise<never> {
    if (isUniqueViolation(err)) {
      for (const c of checks) {
        const conflict = await conflictFor(prisma, c.on, c.base, c.kind, c.excludeId);
        if (conflict) throw conflict;
      }
    }
    throw err;
  }

  async function candidateIdsFor(
    tx: Prisma.TransactionClient,
    stepId: string,
    extraStepIds: Array<string | null | undefined>,
  ) {
    const [pointing, fwd, rb] = await Promise.all([
      tx.step.findMany({ where: { pairedRollbackStepId: stepId }, select: { id: true } }),
      tx.bundleForwardMember.findMany({ where: { stepId }, select: { bundleId: true } }),
      tx.bundleRollbackMember.findMany({ where: { stepId }, select: { bundleId: true } }),
    ]);
    return {
      pointing: pointing.map((s) => s.id),
      bundleIds: [...fwd, ...rb].map((m) => m.bundleId),
      extra: extraStepIds.filter((x): x is string => typeof x === 'string'),
    };
  }

  async function computeImpact(db: DbClient, id: string): Promise<DeleteImpact> {
    const [usage, items, fwd, rb, pointing] = await Promise.all([
      db.$queryRaw<Array<{ count: number }>>`
        SELECT count(DISTINCT "ddclId")::int AS count FROM "ChecklistItem" WHERE "stepId" = ${id}`,
      db.checklistItem.count({ where: { stepId: id } }),
      db.bundleForwardMember.findMany({
        where: { stepId: id },
        select: { bundle: { select: { id: true, name: true, _count: { select: { forwardMembers: true } } } } },
      }),
      db.bundleRollbackMember.findMany({
        where: { stepId: id },
        select: { bundle: { select: { id: true, name: true } } },
      }),
      db.step.findMany({
        where: { pairedRollbackStepId: id },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const removed = fwd.filter((m) => m.bundle._count.forwardMembers === 1).map((m) => ({ id: m.bundle.id, name: m.bundle.name }));
    const removedIds = new Set(removed.map((b) => b.id));
    const changedMap = new Map<string, NamedRef>();
    for (const m of [...fwd, ...rb]) {
      if (!removedIds.has(m.bundle.id)) changedMap.set(m.bundle.id, { id: m.bundle.id, name: m.bundle.name });
    }
    return {
      usageCount: usage[0]?.count ?? 0,
      checklistItems: items,
      bundlesRemoved: removed,
      bundlesChanged: [...changedMap.values()],
      pairLost: pointing,
    };
  }

  return {
    listCategories(): Array<{ name: string }> {
      return CATEGORIES.map((name) => ({ name }));
    },

    /** BR2.6, BR2.13: summaries only; usageCount is one aggregate query joined here, not per row. */
    listSteps(query: ListQuery = { q: null, category: null }): Promise<StepListItem[]> {
      return withDb('listSteps', async () => {
        const where: Prisma.StepWhereInput = {};
        if (query.q) where.name = { contains: escapeLike(query.q), mode: 'insensitive' };
        if (query.category) where.category = query.category;
        const rows = await prisma.step.findMany({
          where,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            category: true,
            kind: true,
            pairedRollbackStepId: true,
            _count: { select: { columns: true, attachments: true } },
          },
        });
        const ids = rows.map((r) => r.id);
        const usage =
          ids.length === 0
            ? []
            : await prisma.$queryRaw<Array<{ stepId: string; count: number }>>`
                SELECT "stepId", count(DISTINCT "ddclId")::int AS count
                FROM "ChecklistItem" WHERE "stepId" = ANY(${ids}::text[]) GROUP BY "stepId"`;
        const usageById = new Map(usage.map((u) => [u.stepId, u.count]));
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category,
          kind: r.kind,
          pairedRollbackStepId: r.pairedRollbackStepId,
          columnCount: r._count.columns,
          attachmentCount: r._count.attachments,
          usageCount: usageById.get(r.id) ?? 0,
          missingRollback: r.kind === 'forward' && r.pairedRollbackStepId === null,
        }));
      });
    },

    getStep(id: string): Promise<StepDetail> {
      return withDb('getStep', async () => {
        const step = await readStepDetail(prisma, id);
        if (!step) throw new NotFoundError(`Step tidak ditemukan: ${id}`);
        return step;
      });
    },

    /** BR2.1, BR2.3, BR2.9: creates the step (and an inline rollback step) atomically. */
    createStep(input: StepInput): Promise<StepDetail> {
      const kind = input.kind ?? 'forward';
      return withDb('createStep', async () => {
        try {
          return await withLibraryTx(prisma, {
            operation: 'createStep',
            onRetry,
            candidates: async () => ({
              stepIds: typeof input.pairedRollbackStepId === 'string' ? [input.pairedRollbackStepId] : [],
              bundleIds: [],
            }),
            fn: async (tx) => {
              const main = await conflictFor(tx, 'step', input, kind);
              if (main) throw main;
              if (input.rollbackStep) {
                const rb = await conflictFor(tx, 'rollbackStep', input.rollbackStep, 'rollback');
                if (rb) throw rb;
              }
              let pairId: string | null = null;
              if (typeof input.pairedRollbackStepId === 'string') {
                await requireRollbackTarget(tx, input.pairedRollbackStepId);
                pairId = input.pairedRollbackStepId;
              }
              if (input.rollbackStep) pairId = await insertStep(tx, input.rollbackStep, 'rollback', null);
              const id = await insertStep(tx, input, kind, pairId);
              return (await readStepDetail(tx, id)) as StepDetail;
            },
          });
        } catch (err) {
          return mapUniqueViolation(err, [
            { on: 'step', base: input, kind },
            ...(input.rollbackStep ? [{ on: 'rollbackStep' as const, base: input.rollbackStep, kind: 'rollback' }] : []),
          ]);
        }
      });
    },

    /** BR2.8: replaces the step's content in one transaction; existing checklist snapshots are never touched. */
    updateStep(id: string, input: StepInput): Promise<StepDetail> {
      return withDb('updateStep', async () => {
        try {
          return await withLibraryTx(prisma, {
            operation: 'updateStep',
            onRetry,
            candidates: async (tx) => {
              const current = await tx.step.findUnique({ where: { id }, select: { pairedRollbackStepId: true } });
              return {
                stepIds: [
                  id,
                  ...(current?.pairedRollbackStepId ? [current.pairedRollbackStepId] : []),
                  ...(typeof input.pairedRollbackStepId === 'string' ? [input.pairedRollbackStepId] : []),
                ],
                bundleIds: [],
              };
            },
            fn: async (tx) => {
              const current = await tx.step.findUnique({ where: { id }, select: { kind: true, pairedRollbackStepId: true } });
              if (!current) throw new NotFoundError(`Step tidak ditemukan: ${id}`);
              if (input.kind !== undefined && input.kind !== current.kind) {
                throw new ValidationError('Jenis step tidak dapat diubah setelah dibuat', ['kind']);
              }
              if (current.kind === 'rollback' && (input.pairedRollbackStepId != null || input.rollbackStep)) {
                throw new ValidationError('Step rollback tidak boleh memiliki pasangan rollback', ['pairedRollbackStepId']);
              }
              const main = await conflictFor(tx, 'step', input, current.kind, id);
              if (main) throw main;
              if (input.rollbackStep) {
                const rb = await conflictFor(tx, 'rollbackStep', input.rollbackStep, 'rollback');
                if (rb) throw rb;
              }
              let pairId: string | null = current.pairedRollbackStepId;
              if (input.pairedRollbackStepId === null) pairId = null;
              else if (typeof input.pairedRollbackStepId === 'string') {
                await requireRollbackTarget(tx, input.pairedRollbackStepId, id);
                pairId = input.pairedRollbackStepId;
              }
              if (input.rollbackStep) pairId = await insertStep(tx, input.rollbackStep, 'rollback', null);
              await tx.stepColumn.deleteMany({ where: { stepId: id } }); // lines cascade
              await tx.stepAttachment.deleteMany({ where: { stepId: id } });
              await writeContent(tx, id, input);
              await tx.step.update({
                where: { id },
                data: { name: input.name, category: input.category, pairedRollbackStepId: pairId },
              });
              return (await readStepDetail(tx, id)) as StepDetail;
            },
          });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
          const current = await prisma.step.findUnique({ where: { id }, select: { kind: true } });
          return mapUniqueViolation(err, [
            { on: 'step', base: input, kind: current?.kind ?? input.kind ?? 'forward', excludeId: id },
            ...(input.rollbackStep ? [{ on: 'rollbackStep' as const, base: input.rollbackStep, kind: 'rollback' }] : []),
          ]);
        }
      });
    },

    /** Read-only preview of what deleting would do (Alur 4 step 1). */
    getDeleteImpact(id: string): Promise<DeleteImpact> {
      return withDb('getDeleteImpact', async () => {
        const exists = await prisma.step.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new NotFoundError(`Step tidak ditemukan: ${id}`);
        return computeImpact(prisma, id);
      });
    },

    /**
     * BR2.7: always allowed. Removes the step from bundles (closing position gaps; a bundle whose last
     * forward member this was is deleted), clears the pair pointers aimed at it, and detaches checklist
     * items by setting stepId to null. Nothing here writes stepSnapshot (BR2.8, NFR4.4).
     */
    deleteStep(id: string): Promise<DeleteImpact> {
      return withDb('deleteStep', () =>
        withLibraryTx(prisma, {
          operation: 'deleteStep',
          onRetry,
          candidates: async (tx) => {
            const c = await candidateIdsFor(tx, id, [id]);
            return { stepIds: [...c.pointing, ...c.extra], bundleIds: c.bundleIds };
          },
          fn: async (tx) => {
            const exists = await tx.step.findUnique({ where: { id }, select: { id: true } });
            if (!exists) throw new NotFoundError(`Step tidak ditemukan: ${id}`);
            const impact = await computeImpact(tx, id);

            await tx.step.updateMany({ where: { pairedRollbackStepId: id }, data: { pairedRollbackStepId: null } });
            await tx.stepBundle.deleteMany({ where: { id: { in: impact.bundlesRemoved.map((b) => b.id) } } });
            for (const b of impact.bundlesChanged) {
              await tx.bundleForwardMember.deleteMany({ where: { bundleId: b.id, stepId: id } });
              await tx.bundleRollbackMember.deleteMany({ where: { bundleId: b.id, stepId: id } });
              // Renumber one row at a time, ascending: a single UPDATE could hit the unique (bundleId, position) mid-statement.
              const fwd = await tx.bundleForwardMember.findMany({ where: { bundleId: b.id }, orderBy: { position: 'asc' } });
              for (const [i, m] of fwd.entries()) {
                if (m.position !== i + 1) {
                  await tx.bundleForwardMember.update({
                    where: { bundleId_stepId: { bundleId: b.id, stepId: m.stepId } },
                    data: { position: i + 1 },
                  });
                }
              }
              const rb = await tx.bundleRollbackMember.findMany({ where: { bundleId: b.id }, orderBy: { position: 'asc' } });
              for (const [i, m] of rb.entries()) {
                if (m.position !== i + 1) {
                  await tx.bundleRollbackMember.update({
                    where: { bundleId_stepId: { bundleId: b.id, stepId: m.stepId } },
                    data: { position: i + 1 },
                  });
                }
              }
              await tx.stepBundle.update({ where: { id: b.id }, data: { updatedAt: new Date() } });
            }
            await tx.checklistItem.updateMany({ where: { stepId: id }, data: { stepId: null } });
            await tx.step.delete({ where: { id } });
            return impact;
          },
        }),
      );
    },
  };
}

export type StepRepository = ReturnType<typeof createStepRepository>;
