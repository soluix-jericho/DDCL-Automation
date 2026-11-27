import type { Role } from './accountRules';

/** RoleRegistry (BR4.9): viewer < editor < admin. */
export const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, admin: 3 };

export function hasRole(userRole: Role, minRole: Role): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[minRole];
}

/**
 * Minimum role per route (NFR2.27). Keys are "METHOD /pattern" relative to /api/v1, with the pattern as
 * Fastify registers it. A route that is not listed needs admin, so a new endpoint is safe by default.
 */
export const ROUTE_ROLES: Record<string, Role> = {
  'GET /steps': 'viewer',
  'GET /steps/categories': 'viewer',
  'GET /steps/:id': 'viewer',
  'GET /steps/:id/impact': 'viewer',
  'GET /bundles': 'viewer',
  'GET /bundles/:id': 'viewer',
  'GET /ddcls/:id/export': 'viewer',
  'POST /steps': 'editor',
  'PATCH /steps/:id': 'editor',
  'POST /bundles': 'editor',
  'PATCH /bundles/:id': 'editor',
  'POST /ddcls': 'editor',
  'POST /ddcls/:id/checklist-items': 'editor',
  'DELETE /steps/:id': 'admin',
  'DELETE /bundles/:id': 'admin',
  'GET /auth/me': 'viewer',
  'POST /auth/logout': 'viewer',
  'POST /auth/password': 'viewer',
  'GET /users': 'admin',
  'POST /users': 'admin',
  'PATCH /users/:id': 'admin',
  'POST /users/:id/password': 'admin',
  'POST /users/:id/unlock': 'admin',
  'GET /audit-events': 'admin',
};

/** HEAD is treated as GET (BR4.8). Unlisted routes are admin-only (BR4.9). */
export function minRoleFor(method: string, routePattern: string): Role {
  const m = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  return ROUTE_ROLES[`${m} ${routePattern}`] ?? 'admin';
}
