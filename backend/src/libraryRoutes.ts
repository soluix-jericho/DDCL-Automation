import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Repository } from './repository';
import { validateBundleBody, validateListQuery, validateStepBody } from './stepRules';
import type { WriteLimiter } from './writeLimiter';

/** 24 MiB: the largest valid step (about 5 MB, 10 MB with an inline rollbackStep) with margin (NFR1.10). */
export const LIBRARY_BODY_LIMIT = 24 * 1024 * 1024;

interface Deps {
  repo: Repository;
  limiter: WriteLimiter;
}

type IdParams = { Params: { id: string } };

/** Log line for each successful write (NFR3.5). Step text and attachment content are never logged. */
function logWrite(
  request: FastifyRequest,
  action: string,
  entity: 'step' | 'bundle',
  id: string,
  impact?: unknown,
): void {
  request.log.info({ action, entity, id, impact }, `Library ${entity} ${action}`);
}

/** Routes of the Step Library (Contract 2): steps and bundles. Mounted under /api/v1 by buildApp. */
export function registerLibraryRoutes(api: FastifyInstance, { repo, limiter }: Deps): void {
  // Write routes only: bigger body limit, bounded concurrency, slot released on every way a request can end.
  const write = {
    bodyLimit: LIBRARY_BODY_LIMIT,
    onRequest: limiter.onRequest,
    onResponse: limiter.release,
    onRequestAbort: limiter.release,
  };

  api.get('/steps', async (request) => repo.listSteps(validateListQuery(request.query)));

  api.get('/steps/categories', async () => repo.listCategories());

  api.post('/steps', write, async (request, reply) => {
    const created = await repo.createStep(validateStepBody(request.body, 'create'));
    logWrite(request, 'create', 'step', created.id);
    return reply.code(201).send(created);
  });

  api.get<IdParams>('/steps/:id', async (request) => repo.getStep(request.params.id));

  api.patch<IdParams>('/steps/:id', write, async (request) => {
    const updated = await repo.updateStep(request.params.id, validateStepBody(request.body, 'update'));
    logWrite(request, 'update', 'step', updated.id);
    return updated;
  });

  api.get<IdParams>('/steps/:id/impact', async (request) => repo.getDeleteImpact(request.params.id));

  api.delete<IdParams>('/steps/:id', write, async (request) => {
    const impact = await repo.deleteStep(request.params.id);
    logWrite(request, 'delete', 'step', request.params.id, {
      bundlesRemoved: impact.bundlesRemoved.length,
      pairLost: impact.pairLost.length,
      checklistItemsDetached: impact.checklistItems,
    });
    return { id: request.params.id, impact };
  });

  api.get('/bundles', async (request) => repo.listBundles(validateListQuery(request.query)));

  api.post('/bundles', write, async (request, reply) => {
    const created = await repo.createBundle(validateBundleBody(request.body));
    logWrite(request, 'create', 'bundle', created.id);
    return reply.code(201).send(created);
  });

  api.get<IdParams>('/bundles/:id', async (request) => repo.getBundle(request.params.id));

  api.patch<IdParams>('/bundles/:id', write, async (request) => {
    const updated = await repo.updateBundle(request.params.id, validateBundleBody(request.body));
    logWrite(request, 'update', 'bundle', updated.id);
    return updated;
  });

  api.delete<IdParams>('/bundles/:id', write, async (request) => {
    const removed = await repo.deleteBundle(request.params.id);
    logWrite(request, 'delete', 'bundle', removed.id);
    return removed;
  });
}
