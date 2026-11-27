import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AppConfig } from './config';
import { ForbiddenError, UnauthorizedError } from './errors';
import type { Repository } from './repository';
import { hasRole, minRoleFor } from './roles';
import type { SessionUser } from './sessionRepository';
import { hashToken, readToken } from './sessionToken';

export interface AuthContext {
  user: SessionUser;
  sessionId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the gate on every route except login; the only source of "who is acting" (BR4.16). */
    auth?: AuthContext;
  }
}

export const API_PREFIX = '/api/v1';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function deny(request: FastifyRequest, outcome: 401 | 403, why: string, auth?: AuthContext): void {
  // NFR3.24: one info line with fixed fields; never a token, cookie or password.
  request.log.info(
    {
      event: 'access_denied',
      userId: auth?.user.id,
      sessionId: auth?.sessionId,
      ip: request.ip,
      requestId: request.id,
      route: `${request.method} ${request.routeOptions.url ?? request.url}`,
      outcome: outcome,
      reason: why,
    },
    'Access denied',
  );
}

/**
 * SessionGate: the single entrance of /api/v1 (security-design "Arsitektur Penegakan"). Installed once with
 * an onRequest hook, so routes cannot skip it and routes added later are covered automatically (BR4.8).
 * Order: exemptions, Origin check, token, session validity, role.
 */
export function registerSessionGate(
  api: FastifyInstance,
  { repo, config }: { repo: Repository; config: Pick<AppConfig, 'allowedOrigins'> },
): void {
  const origins = new Set(config.allowedOrigins);

  api.addHook('onRequest', async (request) => {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') return; // CORS preflight carries no credentials and returns no data
    const pattern = (request.routeOptions.url ?? '').slice(API_PREFIX.length) || '/';
    const isLogin = method === 'POST' && pattern === '/auth/login';

    // BR4.15: cookie-authenticated or anonymous writes must come from an allowed Origin. A Bearer header
    // is never sent automatically by a browser, so it skips this check (judged before the token is validated).
    if (WRITE_METHODS.has(method) && !/^Bearer\s/i.test(request.headers.authorization ?? '')) {
      const origin = request.headers.origin;
      if (origin !== undefined && !origins.has(origin)) {
        deny(request, 403, 'origin');
        throw new ForbiddenError('Asal permintaan tidak diizinkan.');
      }
    }
    if (isLogin) return;

    const token = readToken(request.headers, request.cookies);
    const found = token ? await repo.findSession(hashToken(token)) : null;
    if (!found) {
      deny(request, 401, 'no-valid-session');
      throw new UnauthorizedError();
    }
    const auth: AuthContext = { user: found.user, sessionId: found.sessionId };
    if (!hasRole(found.user.role, minRoleFor(method, pattern))) {
      deny(request, 403, 'role', auth);
      throw new ForbiddenError();
    }
    request.auth = auth;
    // Not awaited: a failed write only warns (NFR1.21).
    void repo.touchSession(found.sessionId, (obj, msg) => request.log.warn(obj, msg));
  });
}
