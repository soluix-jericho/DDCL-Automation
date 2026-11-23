import { Prisma, PrismaClient } from '@prisma/client';
import { DatabaseUnavailable, NotFoundError } from './errors';
import { ChecklistInput, DdclInput, DEFAULT_CREATED_BY, INITIAL_STATUS, StepInput } from './rules';

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
  stepId: string;
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

const CONNECTION_CODES = new Set(['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017']);

/** True for errors meaning "the database cannot be reached" (as opposed to a bug or bad data). */
export function isConnectionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) return CONNECTION_CODES.has(err.code);
  return false;
}

/** Runs a database operation; connection failures become `DatabaseUnavailable` (BR1.5, OBS1.2). */
export async function withDb<T>(operation: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isConnectionError(err)) throw new DatabaseUnavailable(operation, err);
    throw err;
  }
}

function dateOut(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function dateIn(s: string | null | undefined): Date | null {
  return s ? new Date(`${s}T00:00:00Z`) : null;
}

function statusOut(status: string): string {
  return status === 'SudahDikirim' ? 'Sudah Dikirim' : status;
}

function toStep(s: {
  id: string;
  name: string;
  category: string;
  kind: string;
  pairedRollbackStepId: string | null;
}): StepRecord {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    kind: s.kind as StepRecord['kind'],
    pairedRollbackStepId: s.pairedRollbackStepId,
  };
}

type DdclWithRelations = Prisma.DdclDocumentGetPayload<{
  include: { releaseHeader: true; checklistItems: { include: { step: true } } };
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
        step: toStep(c.step),
      })),
  };
}

export function createRepository(prisma: PrismaClient) {
  const include = {
    releaseHeader: true,
    checklistItems: { include: { step: true } },
  } as const;

  return {
    createStep(input: StepInput): Promise<StepRecord> {
      return withDb('createStep', async () =>
        toStep(await prisma.step.create({ data: { name: input.name, category: input.category } })),
      );
    },

    listSteps(): Promise<StepRecord[]> {
      return withDb('listSteps', async () =>
        (await prisma.step.findMany({ orderBy: { name: 'asc' } })).map(toStep),
      );
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
        const [ddcl, step] = await Promise.all([
          prisma.ddclDocument.findUnique({ where: { id: ddclId }, select: { id: true } }),
          prisma.step.findUnique({ where: { id: input.stepId }, select: { id: true } }),
        ]);
        if (!ddcl) throw new NotFoundError(`DDCL tidak ditemukan: ${ddclId}`);
        if (!step) throw new NotFoundError(`Step tidak ditemukan: ${input.stepId}`);
        const count = await prisma.checklistItem.count({ where: { ddclId } });
        const created = await prisma.checklistItem.create({
          data: {
            ddclId,
            stepId: input.stepId,
            order: count + 1,
            parameterValues: input.parameterValues ?? Prisma.DbNull,
          },
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
