import type { PrismaClient } from '@prisma/client';
import type { BuildAppOptions } from '../../src/app';
import { createRepository } from '../../src/repository';
import type { Repository } from '../../src/repository';
import { authApp, AuthApp, cheapPasswords, ORIGIN as U4_ORIGIN } from '../u4/helpers';
import type { BundleInput, StepInput } from '../../src/stepRules';

export const ORIGIN = U4_ORIGIN;

/**
 * An app over the given database (U4: every route needs a session). `app.inject` is signed in as an admin by
 * default, so the U2 assertions stay as they were; `app.as(role)` and `app.rawInject` serve the role tests.
 */
export function makeApp(
  prisma: PrismaClient,
  extra: Partial<BuildAppOptions> = {},
  repo: Repository = createRepository(prisma, { passwords: cheapPasswords }),
): Promise<AuthApp> {
  return authApp(prisma, extra, repo);
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
  // The creator is any existing account (authApp creates three); U4 requires one for every DDCL.
  const [creator] = await repo.listUsers();
  if (!creator) throw new Error('seedDdclWithItem needs an account: build the app with makeApp first');
  const ddcl = await repo.createDdcl({ title, releaseHeader: {} }, creator.id);
  const item = await repo.addChecklistItem(ddcl.id, { stepId, parameterValues: null });
  return { ddcl, item };
}
