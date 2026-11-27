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

const call = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown, as: 'admin' | 'editor' | 'viewer' = 'admin') =>
  app.rawInject({ method, url: `/api/v1${url}`, headers: app.as(as), ...(payload === undefined ? {} : { payload: payload as never }) });

const newUser = { name: 'Budi', email: 'Budi@X.test', role: 'viewer', password: 'kata-sandi-awal-1' };

describe('admin only (BR4.9, BR4.17)', () => {
  it.each([
    ['GET', '/users'],
    ['POST', '/users'],
    ['PATCH', '/users/x'],
    ['POST', '/users/x/password'],
    ['POST', '/users/x/unlock'],
  ] as const)('%s %s is 403 for viewer and editor, 401 without a session', async (method, url) => {
    expect((await call(method, url, {}, 'viewer')).statusCode).toBe(403);
    expect((await call(method, url, {}, 'editor')).statusCode).toBe(403);
    expect((await app.rawInject({ method, url: `/api/v1${url}` })).statusCode).toBe(401);
  });
});

describe('GET and POST /users', () => {
  it('lists accounts with only the public fields', async () => {
    const res = await call('GET', '/users');
    expect(res.statusCode).toBe(200);
    const list = res.json() as Array<Record<string, unknown>>;
    expect(list).toHaveLength(3);
    for (const u of list) {
      expect(Object.keys(u).sort()).toEqual(['createdAt', 'email', 'id', 'lastLoginAt', 'name', 'role', 'status']);
    }
    expect(res.body).not.toMatch(/passwordHash|tokenHash|scrypt/);
  });

  it('creates an account (201, normalized email, no hash) that can log in at once', async () => {
    const res = await call('POST', '/users', newUser);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Budi', email: 'budi@x.test', role: 'viewer', status: 'active' });
    expect(res.body).not.toMatch(/passwordHash|scrypt/);
    const login = await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'budi@x.test', password: newUser.password } });
    expect(login.statusCode).toBe(200);
  });

  it('answers 400 naming the fields and 409 for a duplicate (also an inactive account)', async () => {
    const bad = await call('POST', '/users', { ...newUser, role: 'root', password: 'pendek' });
    expect(bad.statusCode).toBe(400);
    const dup = await call('POST', '/users', { ...newUser, email: 'ADMIN@example.test' });
    expect(dup.statusCode).toBe(409);
    expect(dup.json()).toEqual({ error: 'conflict', message: expect.any(String) });
    await makeUser(prisma, { email: 'off@x.test', status: 'inactive' });
    expect((await call('POST', '/users', { ...newUser, email: 'off@x.test' })).statusCode).toBe(409);
  });
});

describe('PATCH /users/:id (BR4.13, BR4.14, BR4.19)', () => {
  it('changes a role (200) and the change applies to the next request of that user', async () => {
    const t = await makeUser(prisma, { role: 'editor' });
    const sessionToken = (await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: t.email, password: TEST_PASSWORD } })).json().sessionToken;
    const write = () => app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: { authorization: `Bearer ${sessionToken}` }, payload: { name: 'S', category: 'Database', kind: 'forward', columns: [{ lines: ['x'] }] } });
    expect((await write()).statusCode).toBe(201);
    const res = await call('PATCH', `/users/${t.id}`, { role: 'viewer' });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe('viewer');
    expect((await write()).statusCode).toBe(403);
  });

  it('deactivates an account: its session dies at once and it cannot log in', async () => {
    const t = await makeUser(prisma, { role: 'editor' });
    const token = (await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: t.email, password: TEST_PASSWORD } })).json().sessionToken;
    expect((await call('PATCH', `/users/${t.id}`, { status: 'inactive' })).statusCode).toBe(200);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(401);
    const again = await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: t.email, password: TEST_PASSWORD } });
    expect(again.statusCode).toBe(401);
  });

  it('is 404 for an unknown account and 400 for an empty body or a field other than role/status', async () => {
    expect((await call('PATCH', '/users/ghost', { role: 'viewer' })).statusCode).toBe(404);
    const t = await makeUser(prisma);
    expect((await call('PATCH', `/users/${t.id}`, {})).statusCode).toBe(400);
    const other = await call('PATCH', `/users/${t.id}`, { role: 'viewer', email: 'x@y.test' });
    expect(other.statusCode).toBe(400);
    expect(other.json().fields).toEqual(['email']);
  });

  it('is 409 for own deactivation, the last admin, and "status: active" on an inactive account', async () => {
    const self = await call('PATCH', `/users/${app.users.admin.id}`, { status: 'inactive' });
    expect(self.statusCode).toBe(409);
    const demote = await call('PATCH', `/users/${app.users.admin.id}`, { role: 'editor' });
    expect(demote.statusCode).toBe(409);
    const off = await makeUser(prisma, { status: 'inactive' });
    expect((await call('PATCH', `/users/${off.id}`, { status: 'active' })).statusCode).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: app.users.admin.id } })).role).toBe('admin');
  });

  it('is an idempotent 200 for the same role, and for deactivating an inactive account', async () => {
    const off = await makeUser(prisma, { status: 'inactive', role: 'viewer' });
    expect((await call('PATCH', `/users/${off.id}`, { status: 'inactive' })).statusCode).toBe(200);
    expect((await call('PATCH', `/users/${off.id}`, { role: 'viewer' })).statusCode).toBe(200);
  });

  it('applies role and status together or not at all', async () => {
    const t = await makeUser(prisma, { role: 'editor' });
    const both = await call('PATCH', `/users/${t.id}`, { role: 'viewer', status: 'inactive' });
    expect(both.json()).toMatchObject({ role: 'viewer', status: 'inactive' });
    const off = await makeUser(prisma, { role: 'editor', status: 'inactive' });
    const refused = await call('PATCH', `/users/${off.id}`, { role: 'viewer', status: 'active' });
    expect(refused.statusCode).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: off.id } })).role).toBe('editor');
  });
});

describe('POST /users/:id/password and /unlock (BR4.18)', () => {
  it('resets another account password (204) and refuses 409 for yourself, 404 unknown, 400 short', async () => {
    const t = await makeUser(prisma);
    expect((await call('POST', `/users/${t.id}/password`, { newPassword: 'sandi-baru-dari-admin' })).statusCode).toBe(204);
    const login = await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: t.email, password: 'sandi-baru-dari-admin' } });
    expect(login.statusCode).toBe(200);
    expect((await call('POST', `/users/${app.users.admin.id}/password`, { newPassword: 'sandi-baru-dari-admin' })).statusCode).toBe(409);
    expect((await call('POST', '/users/ghost/password', { newPassword: 'sandi-baru-dari-admin' })).statusCode).toBe(404);
    expect((await call('POST', `/users/${t.id}/password`, { newPassword: 'pendek' })).statusCode).toBe(400);
  });

  it('unlocks a locked email (204, idempotent) and 404s for an unknown account', async () => {
    const t = await makeUser(prisma);
    const attempt = (pw: string) => app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: t.email, password: pw } });
    for (let i = 0; i < 5; i++) await attempt('salah-salah-1');
    expect((await attempt(TEST_PASSWORD)).statusCode).toBe(429);
    expect((await call('POST', `/users/${t.id}/unlock`)).statusCode).toBe(204);
    expect((await call('POST', `/users/${t.id}/unlock`)).statusCode).toBe(204);
    expect((await attempt(TEST_PASSWORD)).statusCode).toBe(200);
    expect((await call('POST', '/users/ghost/unlock')).statusCode).toBe(404);
  });
});
