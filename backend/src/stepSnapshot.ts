import type { Prisma } from '@prisma/client';

/** Full content of a step as the API returns it and as a checklist item snapshots it (BR2.8, BR2.14). */
export interface StepContent {
  id: string;
  name: string;
  category: string;
  kind: 'forward' | 'rollback';
  pairedRollbackStepId: string | null;
  columns: Array<{ label: string | null; lines: string[] }>;
  attachments: Array<{ filename: string; content: string }>;
}

/** Stored in ChecklistItem.stepSnapshot: the step plus a copy of its rollback partner. */
export type StepSnapshot = Omit<StepContent, 'pairedRollbackStepId'> & {
  pairedRollback: Omit<StepContent, 'pairedRollbackStepId'> | null;
};

export const STEP_CONTENT_INCLUDE = {
  columns: { orderBy: { position: 'asc' }, include: { lines: { orderBy: { position: 'asc' } } } },
  attachments: { orderBy: { position: 'asc' } },
} as const satisfies Prisma.StepInclude;

export type StepRow = Prisma.StepGetPayload<{ include: typeof STEP_CONTENT_INCLUDE }>;

export function toStepContent(s: StepRow): StepContent {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    kind: s.kind,
    pairedRollbackStepId: s.pairedRollbackStepId,
    columns: s.columns.map((c) => ({ label: c.label, lines: c.lines.map((l) => l.text) })),
    attachments: s.attachments.map((a) => ({ filename: a.filename, content: a.content })),
  };
}

function withoutPair({ pairedRollbackStepId: _pair, ...rest }: StepContent) {
  return rest;
}

/** Reads a step (and its rollback partner) inside the caller's transaction; null when it no longer exists. */
export async function buildStepSnapshot(
  tx: Prisma.TransactionClient,
  stepId: string,
): Promise<StepSnapshot | null> {
  const row = await tx.step.findUnique({ where: { id: stepId }, include: STEP_CONTENT_INCLUDE });
  if (!row) return null;
  const partner = row.pairedRollbackStepId
    ? await tx.step.findUnique({
        where: { id: row.pairedRollbackStepId },
        include: STEP_CONTENT_INCLUDE,
      })
    : null;
  return {
    ...withoutPair(toStepContent(row)),
    pairedRollback: partner ? withoutPair(toStepContent(partner)) : null,
  };
}
