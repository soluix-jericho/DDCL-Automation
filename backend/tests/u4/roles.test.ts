import { describe, expect, it } from 'vitest';
import { hasRole, minRoleFor, ROUTE_ROLES } from '../../src/roles';

describe('RoleRegistry (BR4.9, NFR2.27)', () => {
  it('ranks viewer < editor < admin', () => {
    expect(hasRole('admin', 'editor')).toBe(true);
    expect(hasRole('editor', 'editor')).toBe(true);
    expect(hasRole('viewer', 'editor')).toBe(false);
    expect(hasRole('editor', 'admin')).toBe(false);
    expect(hasRole('viewer', 'viewer')).toBe(true);
  });

  it.each([
    ['GET', '/steps', 'viewer'],
    ['GET', '/steps/:id', 'viewer'],
    ['GET', '/bundles/:id', 'viewer'],
    ['GET', '/ddcls/:id/export', 'viewer'],
    ['POST', '/steps', 'editor'],
    ['PATCH', '/steps/:id', 'editor'],
    ['POST', '/bundles', 'editor'],
    ['POST', '/ddcls', 'editor'],
    ['POST', '/ddcls/:id/checklist-items', 'editor'],
    ['DELETE', '/steps/:id', 'admin'],
    ['DELETE', '/bundles/:id', 'admin'],
    ['GET', '/auth/me', 'viewer'],
    ['POST', '/auth/logout', 'viewer'],
    ['POST', '/auth/password', 'viewer'],
    ['GET', '/users', 'admin'],
    ['POST', '/users', 'admin'],
    ['PATCH', '/users/:id', 'admin'],
    ['POST', '/users/:id/password', 'admin'],
    ['POST', '/users/:id/unlock', 'admin'],
    ['GET', '/audit-events', 'admin'],
  ])('%s %s needs %s', (method, route, role) => {
    expect(minRoleFor(method, route)).toBe(role);
  });

  it('treats HEAD like GET', () => {
    expect(minRoleFor('HEAD', '/steps')).toBe('viewer');
    expect(minRoleFor('head', '/users')).toBe('admin');
  });

  it('gives admin to any route that has no declaration (safe by default)', () => {
    expect(minRoleFor('GET', '/brand-new-route')).toBe('admin');
    expect(minRoleFor('DELETE', '/ddcls/:id')).toBe('admin');
    expect(minRoleFor('PUT', '/steps/:id')).toBe('admin');
  });

  it('declares only known roles', () => {
    for (const role of Object.values(ROUTE_ROLES)) expect(['viewer', 'editor', 'admin']).toContain(role);
  });
});
