import { Prisma, PrismaClient } from '@prisma/client';
import { isConnectionError, withDb } from './db';
import { NotFoundError } from './errors';
import { ChecklistInput, DdclInput, DEFAULT_CREATED_BY, INITIAL_STATUS } from './rules';
import { createBundleRepository } from './bundleRepository';
import { createStepRepository, RepoContext } from './stepRepository';
import { buildStepSnapshot, StepSnapshot } from './stepSnapshot';

export interface StepRecord {
  id: string;
  name: string;
  category: string;
  kind: 'forward' | 'rollback';
  pairedRollbackStepId: string | null;
}

export interface HeaderRecord {
  date: string | null;
  startDate: string | null;
  impactedSystem: string | null;
  environment: string | null;
  phaseRelease: string | null;
  releaseObjective: string | null;
  technicalChange: string | null;
}

export interface ChecklistItemRecord {
  id: string;
  ddclId: string;
  /** Null once the step was deleted from the Library; the snapshot below still describes it. */
  stepId: string | null;
  order: number;
  parameterValues: Record<string, string> | null;
  step?: StepRecord;
}

export interface DdclRecord {
  id: string;
  title: string;
  status: string;
  createdBy: string;
  createdAt: string;
  releaseHeader: HeaderRecord | null;
  checklistItems: ChecklistItemRecord[];
}

export { isConnectionError, withDb };

function dateOut(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function dateIn(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

function statusOut(status: string): string {
  return status === 'SudahDikirim' ? 'Sudah Dikirim' : status;
}

/** The step as the DDCL sees it: always read from the item's own snapshot (BR2.8), never from the Library. */
function stepFromSnapshot(snap: StepSnapshot): StepRecord {
  return {
    id: snap.id,
    name: snap.name,
    category: snap.category,
    kind: snap.kind,
    pairedRollbackStepId: snap.pairedRollback?.id ?? null,
  };
}

type DdclWithRelations = Prisma.DdclDocumentGetPayload<{
  include: { releaseHeader: true; checklistItems: true };
}>;

function toDdcl(d: DdclWithRelations): DdclRecord {
  const h = d.releaseHeader;
  return {
    id: d.id,
    title: d.title,
    status: statusOut(d.status),
    createdBy: d.createdBy,
    createdAt: d.createdAt.toISOString(),
    releaseHeader: h
      ? {
          date: dateOut(h.date),
          startDate: dateOut(h.startDate),
          impactedSystem: h.impactedSystem,
          environment: h.environment,
          phaseRelease: h.phaseRelease,
          releaseObjective: h.releaseObjective,
          technicalChange: h.technicalChange,
        }
      : null,
    checklistItems: [...d.checklistItems]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        ddclId: c.ddclId,
        stepId: c.stepId,
        order: c.order,
        parameterValues: (c.parameterValues as Record<string, string> | null) ?? null,
        step: stepFromSnapshot(c.stepSnapshot as unknown as StepSnapshot),
      })),
  };
}

export function createRepository(prisma: PrismaClient) {
  const include = {
    releaseHeader: true,
    checklistItems: true,
  } as const;

  // Warnings from Library transactions (deadlock retries) go to whatever logger the app attaches.
  let warnSink: RepoContext['warn'] = () => undefined;
  const ctx: RepoContext = { warn: (obj, msg) => warnSink(obj, msg) };

  return {
    ...createStepRepository(prisma, ctx),
    ...createBundleRepository(prisma, ctx),

    setWarnSink(sink: RepoContext['warn']): void {
      warnSink = sink;
    },

    /** Creates the document and its header in one transaction (nested create is atomic). */
    createDdcl(input: DdclInput): Promise<DdclRecord> {
      const h = input.releaseHeader;
      return withDb('createDdcl', async () =>
        toDdcl(
          await prisma.ddclDocument.create({
            data: {
              title: input.title,
              status: INITIAL_STATUS,
              createdBy: DEFAULT_CREATED_BY,
              releaseHeader: {
                create: {
                  date: dateIn(h.date),
                  startDate: dateIn(h.startDate),
                  impactedSystem: h.impactedSystem ?? null,
                  environment: h.environment ?? null,
                  phaseRelease: h.phaseRelease ?? null,
                  releaseObjective: h.releaseObjective ?? null,
                  technicalChange: h.technicalChange ?? null,
                },
              },
            },
            include,
          }),
        ),
      );
    },

    addChecklistItem(ddclId: string, input: ChecklistInput): Promise<ChecklistItemRecord> {
      return withDb('addChecklistItem', async () => {
        // BR2.8: reading the step, snapshotting it and creating the item happen in one transaction.
        const created = await prisma.$transaction(async (tx) => {
          const ddcl = await tx.ddclDocument.findUnique({ where: { id: ddclId }, select: { id: true } });
          if (!ddcl) throw new NotFoundError(`DDCL tidak ditemukan: ${ddclId}`);
          const snapshot = await buildStepSnapshot(tx, input.stepId);
          if (!snapshot) throw new NotFoundError(`Step tidak ditemukan: ${input.stepId}`);
          const count = await tx.checklistItem.count({ where: { ddclId } });
          return tx.checklistItem.create({
            data: {
              ddclId,
              stepId: input.stepId,
              order: count + 1,
              parameterValues: input.parameterValues ?? Prisma.DbNull,
              stepSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            },
          });
        });
        return {
          id: created.id,
          ddclId: created.ddclId,
          stepId: created.stepId,
          order: created.order,
          parameterValues: (created.parameterValues as Record<string, string> | null) ?? null,
        };
      });
    },

    getDdclForExport(ddclId: string): Promise<DdclRecord | null> {
      return withDb('getDdclForExport', async () => {
        const d = await prisma.ddclDocument.findUnique({ where: { id: ddclId }, include });
        return d ? toDdcl(d) : null;
      });
    },

    async ping(): Promise<void> {
      await withDb('health', () => prisma.$queryRaw`SELECT 1`);
    },
  };
}

export type Repository = ReturnType<typeof createRepository>;
