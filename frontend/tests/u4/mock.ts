import type { AccountUser, AuditEvent, AuthUser, Role } from '../../src/api';
import { json, mockFetch as baseMockFetch, type Handler } from '../u2/mock';

export { bodyOf, callsTo, json, listItem } from '../u2/mock';
export type { Handler };

export function me(role: Role = 'admin', over: Partial<AuthUser> = {}): AuthUser {
  return { id: `u-${role}`, name: `${role} Uji`, email: `${role}@example.test`, role, ...over };
}

export function account(over: Partial<AccountUser> = {}): AccountUser {
  return {
    id: 'a1',
    name: 'Ana',
    email: 'ana@example.test',
    role: 'editor',
    status: 'active',
    createdAt: '2026-11-01T00:00:00.000Z',
    lastLoginAt: null,
    ...over,
  };
}

export function auditEvent(over: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'e1',
    occurredAt: '2026-11-02T10:00:00.000Z',
    type: 'login_failed',
    actorUserId: null,
    targetUserId: null,
    email: 'ana@example.test',
    ipAddress: '10.0.0.1',
    detail: null,
    ...over,
  };
}

/** The shared fetch router, signed in as `role` by default (or anonymous with `null`). */
export function mockFetch(role: Role | null, routes: Record<string, Handler> = {}) {
  return baseMockFetch({
    'GET /api/v1/auth/me': () => (role ? json(200, me(role)) : json(401, { error: 'unauthorized' })),
    ...routes,
  });
}
