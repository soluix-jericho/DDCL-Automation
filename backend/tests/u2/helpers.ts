import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { buildApp, BuildAppOptions } from '../../src/app';
import { createRepository } from '../../src/repository';
import type { Repository } from '../../src/repository';
import type { BundleInput, StepInput } from '../../src/stepRules';

export const ORIGIN = 'http://localhost:5173';

/** An app over the given database; the template path is irrelevant to Library tests. */
export function makeApp(
  prisma: PrismaClient,
  extra: Partial<BuildAppOptions> = {},
  repo: Repository = createRepository(prisma),
): Promise<FastifyInstance> {
  return buildApp({
    repo,
    config: { port: 0, frontendOrigin: ORIGIN, templatePath: '/nonexistent.xlsx' },
    logger: false,
    ...extra,
  });
}

/** A step body as an HTTP client sends it (JSON). */
export function stepJson(over: Record<string, unknown> = {}) {
  return {
    name: 'Update Deployment',
    category: 'Database',
    kind: 'forward',
    columns: [{ label: 'Utama', lines: ['kubectl apply -f {file}', 'cek pod {pod}'] }],
    ...over,
  };
}

/** A valid, minimal step input as the repository receives it (already validated and normalized). */
export function stepBody(over: Partial<StepInput> = {}): StepInput {
  return {
    name: 'Update Deployment',
    category: 'Database',
    kind: 'forward',
    pairedRollbackStepId: null,
    rollbackStep: null,
    columns: [{ label: null, lines: ['kubectl apply -f {file}', 'check pod {pod}'] }],
    attachments: [],
    ...over,
  };
}

export function bundleBody(over: Partial<BundleInput> = {}): BundleInput {
  return { name: 'Buka database', category: null, forwardStepIds: [], rollbackStepIds: [], ...over };
}

export async function seedStep(repo: Repository, over: Partial<StepInput> = {}) {
  return repo.createStep(stepBody(over));
}

export async function seedRollback(repo: Repository, name = 'Undo', over: Partial<StepInput> = {}) {
  return repo.createStep(stepBody({ name, kind: 'rollback', ...over }));
}

/** A DDCL with one checklist item (its own snapshot) for the given step. */
export async function seedDdclWithItem(repo: Repository, stepId: string, title = 'DDCL') {
  const ddcl = await repo.createDdcl({ title, releaseHeader: {} });
  const item = await repo.addChecklistItem(ddcl.id, { stepId, parameterValues: null });
  return { ddcl, item };
}
