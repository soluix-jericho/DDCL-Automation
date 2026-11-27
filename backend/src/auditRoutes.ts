import type { FastifyInstance } from 'fastify';
import { validateAuditQuery } from './accountRules';
import type { Repository } from './repository';

/** Read-only audit list for admins: `{ items, nextCursor }`, newest first (BR4.20). Mounted under /api/v1. */
export function registerAuditRoutes(api: FastifyInstance, { repo }: { repo: Repository }): void {
  api.get('/audit-events', async (request) => repo.listAuditEvents(validateAuditQuery(request.query)));
}
