import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  validateCreateUserBody,
  validatePatchUserBody,
  validateResetPasswordBody,
} from './accountRules';
import type { Repository } from './repository';

function event(request: FastifyRequest, name: string, targetId?: string): void {
  request.log.info(
    { event: name, userId: request.auth?.user.id, targetId, sessionId: request.auth?.sessionId, ip: request.ip, requestId: request.id, route: `${request.method} ${request.url}`, outcome: 'ok' },
    name,
  );
}

type IdParams = { Params: { id: string } };

/** Account administration (admin only; the gate enforces the role). Mounted under /api/v1. */
export function registerUserRoutes(api: FastifyInstance, { repo }: { repo: Repository }): void {
  api.get('/users', async () => repo.listUsers());

  api.post('/users', async (request, reply) => {
    const created = await repo.createUser(request.auth!.user.id, validateCreateUserBody(request.body), request.ip);
    event(request, 'account_created', created.id);
    return reply.code(201).send(created);
  });

  api.patch<IdParams>('/users/:id', async (request) => {
    const updated = await repo.patchUser(
      request.auth!.user.id,
      request.params.id,
      validatePatchUserBody(request.body),
      request.ip,
    );
    event(request, 'account_updated', updated.id);
    return updated;
  });

  api.post<IdParams>('/users/:id/password', async (request, reply) => {
    const { newPassword } = validateResetPasswordBody(request.body);
    await repo.resetPassword(request.auth!.user.id, request.params.id, newPassword, request.ip);
    event(request, 'password_reset_by_admin', request.params.id);
    return reply.code(204).send();
  });

  api.post<IdParams>('/users/:id/unlock', async (request, reply) => {
    await repo.unlock(request.auth!.user.id, request.params.id, request.ip);
    event(request, 'lockout_cleared_by_admin', request.params.id);
    return reply.code(204).send();
  });
}
