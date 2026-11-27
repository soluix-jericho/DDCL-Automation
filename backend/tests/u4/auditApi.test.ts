import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { authApp, AuthApp, makeUser, ORIGIN, TEST_PASSWORD } from './helpers';

let prisma: PrismaClient;
let app: AuthApp;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  app = await authApp(prisma);
});
afterEach(async () => {
  await app.close();
});

const list = (query = '', as: 'admin' | 'editor' | 'viewer' = 'admin') =>
  app.rawInject({ method: 'GET', url: `/api/v1/audit-events${query}`, headers: app.as(as) });

describe('GET /audit-events (BR4.20)', () => {
  it('is 403 for viewer and editor and 401 without a session', async () => {
    expect((await list('', 'viewer')).statusCode).toBe(403);
    expect((await list('', 'editor')).statusCode).toBe(403);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/audit-events' })).statusCode).toBe(401);
  });

  it('lists what happened, newest first, as { items, nextCursor }', async () => {
    const u = await makeUser(prisma, { email: 'ana@x.test', password: TEST_PASSWORD });
    const login = (pw: string) => app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: u.email, password: pw } });
    await login('salah-salah-1');
    await login(TEST_PASSWORD);
    const res = await list();
    expect(res.statusCode).toBe(200);
    const { items, nextCursor } = res.json();
    expect(nextCursor).toBeNull();
    expect(items.map((i: { type: string }) => i.type)).toEqual(['login_success', 'login_failed']);
    expect(items[0]).toMatchObject({ actorUserId: u.id, email: 'ana@x.test' });
    expect(res.body).not.toMatch(/passwordHash|scrypt|ddcl_session/);
  });

  it('filters by type and date and pages with the cursor', async () => {
    for (let i = 0; i < 7; i++) {
      await prisma.auditEvent.create({ data: { type: i < 5 ? 'login_failed' : 'logout', occurredAt: new Date(Date.UTC(2026, 9, 1, 10, i)) } });
    }
    const failed = (await list('?type=login_failed&limit=100')).json();
    expect(failed.items).toHaveLength(5);
    const page1 = (await list('?limit=3')).json();
    expect(page1.items).toHaveLength(3);
    const page2 = (await list(`?limit=3&cursor=${page1.nextCursor}`)).json();
    const page3 = (await list(`?limit=3&cursor=${page2.nextCursor}`)).json();
    const ids = [...page1.items, ...page2.items, ...page3.items].map((i: { id: string }) => i.id);
    expect(new Set(ids).size).toBe(7);
    expect(page3.nextCursor).toBeNull();
    expect((await list('?from=2026-10-02')).json().items).toHaveLength(0);
    expect((await list('?from=2026-10-01&to=2026-10-01&limit=100')).json().items).toHaveLength(7);
  });

  it.each([['type=hack', 'type'], ['limit=0', 'limit'], ['limit=101', 'limit'], ['from=kemarin', 'from'], ['cursor=rusak', 'cursor']])(
    'answers 400 naming the field for ?%s',
    async (q, field) => {
      const res = await list(`?${q}`);
      expect(res.statusCode).toBe(400);
      expect(res.json().fields).toEqual([field]);
    },
  );

  it('has no way to change or delete audit rows through the API', async () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE'] as const) {
      const res = await app.rawInject({ method, url: '/api/v1/audit-events', headers: app.as('admin') });
      expect(res.statusCode).toBe(404);
    }
  });
});
