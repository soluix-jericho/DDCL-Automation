import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { validateLoginBody, validatePasswordChangeBody } from './accountRules';
import type { AppConfig } from './config';
import type { Repository } from './repository';
import { cookieOptions, readToken, SESSION_COOKIE } from './sessionToken';

function event(request: FastifyRequest, name: string, userId?: string): void {
  request.log.info(
    { event: name, userId, sessionId: request.auth?.sessionId, ip: request.ip, requestId: request.id, route: `${request.method} ${request.url}`, outcome: 'ok' },
    name,
  );
}

/** Routes of Contract 1: login, logout, me, own password change. Mounted under /api/v1. */
export function registerAuthRoutes(
  api: FastifyInstance,
  { repo, config }: { repo: Repository; config: Pick<AppConfig, 'cookieSecure'> },
): void {
  api.post('/auth/login', async (request, reply: FastifyReply) => {
    const { email, password } = validateLoginBody(request.body);
    const carried = readToken(request.headers, request.cookies);
    const result = await repo.login(email, password, request.ip, carried);
    event(request, 'login_success', result.user.id);
    reply.setCookie(SESSION_COOKIE, result.token, cookieOptions(config.cookieSecure));
    return { sessionToken: result.token, user: result.user };
  });

  api.post('/auth/logout', async (request, reply) => {
    const auth = request.auth!;
    await repo.logout(auth.sessionId, auth.user.id, request.ip);
    event(request, 'logout', auth.user.id);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.code(204).send();
  });

  api.get('/auth/me', async (request) => {
    const { id, name, email, role } = request.auth!.user;
    return { id, name, email, role };
  });

  api.post('/auth/password', async (request, reply) => {
    const auth = request.auth!;
    const body = validatePasswordChangeBody(request.body);
    await repo.changeOwnPassword(auth.user.id, auth.sessionId, body.currentPassword, body.newPassword, request.ip);
    event(request, 'password_changed', auth.user.id);
    return reply.code(204).send();
  });
}
