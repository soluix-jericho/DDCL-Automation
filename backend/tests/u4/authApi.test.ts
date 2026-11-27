import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHashGate } from '../../src/hashGate';
import { createPasswordService } from '../../src/passwordService';
import { createRepository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { authApp, AuthApp, cheapPasswords, makeUser, ORIGIN, TEST_PASSWORD, testConfig } from './helpers';

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
});
afterEach(async () => {
  await app?.close();
});

const GENERIC_401 = { error: 'unauthorized' };

function login(a: AuthApp, email: string, password: string, headers: Record<string, string> = {}) {
  return a.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN, ...headers }, payload: { email, password } });
}

describe('POST /auth/login (BR4.3, BR4.5)', () => {
  beforeEach(async () => {
    app = await authApp(prisma);
    await makeUser(prisma, { email: 'ana@x.test', name: 'Ana', role: 'editor', password: TEST_PASSWORD });
  });

  it('answers 200 with sessionToken and user, and sets an httpOnly SameSite=Lax cookie without Max-Age', async () => {
    const res = await login(app, ' ANA@x.test ', TEST_PASSWORD);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user).toMatchObject({ name: 'Ana', email: 'ana@x.test', role: 'editor' });
    expect(Object.keys(body.user).sort()).toEqual(['email', 'id', 'name', 'role']);
    expect(body.sessionToken).toMatch(/^[A-Za-z0-9_-]{43,}$/);
    expect(res.body).not.toMatch(/passwordHash|scrypt/);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain(`ddcl_session=${body.sessionToken}`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Max-Age|Expires|Secure/i);
  });

  it('adds Secure to the cookie when COOKIE_SECURE is on', async () => {
    await app.close();
    app = await authApp(prisma, {}, undefined, testConfig({ cookieSecure: true }));
    const res = await login(app, 'ana@x.test', TEST_PASSWORD);
    expect(String(res.headers['set-cookie'])).toMatch(/Secure/i);
  });

  it('the issued token works as a cookie and as a Bearer header', async () => {
    const { sessionToken } = (await login(app, 'ana@x.test', TEST_PASSWORD)).json();
    const viaCookie = await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie: `ddcl_session=${sessionToken}` } });
    const viaBearer = await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${sessionToken}` } });
    expect(viaCookie.statusCode).toBe(200);
    expect(viaBearer.json()).toEqual(viaCookie.json());
  });

  it.each([
    [{}],
    [{ email: 'bukan-email', password: 'x' }],
    [{ email: 'ana@x.test' }],
    [{ email: 'ana@x.test', password: '' }],
  ])('answers 400 for an invalid body %j', async (payload) => {
    const res = await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', payload: payload as never });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation_error');
  });

  it('answers the same generic 401 for wrong password, unknown email and inactive account', async () => {
    await makeUser(prisma, { email: 'off@x.test', status: 'inactive', password: TEST_PASSWORD });
    const responses = [
      await login(app, 'ana@x.test', 'salah-salah-1'),
      await login(app, 'ghost@x.test', TEST_PASSWORD),
      await login(app, 'off@x.test', TEST_PASSWORD),
    ];
    for (const r of responses) {
      expect(r.statusCode).toBe(401);
      expect(r.json()).toEqual(GENERIC_401);
      expect(r.headers['set-cookie']).toBeUndefined();
    }
  });

  it('answers 429 with Retry-After once locked, without checking the password at all', async () => {
    const verify = vi.fn(cheapPasswords.verify);
    await app.close();
    app = await authApp(prisma, {}, createRepository(prisma, { passwords: { ...cheapPasswords, verify } }));
    for (let i = 0; i < 5; i++) expect((await login(app, 'ana@x.test', 'salah-salah-1')).statusCode).toBe(401);
    const calls = verify.mock.calls.length;
    const locked = await login(app, 'ana@x.test', TEST_PASSWORD);
    expect(locked.statusCode).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    expect(locked.json().error).toBe('too_many_attempts');
    expect(verify.mock.calls.length).toBe(calls);
    // An unregistered email is locked the same way.
    for (let i = 0; i < 5; i++) await login(app, 'ghost@x.test', 'x');
    expect((await login(app, 'ghost@x.test', TEST_PASSWORD)).statusCode).toBe(429);
  });

  it('answers 503 with Retry-After when the hash queue is full', async () => {
    await app.close();
    const gate = createHashGate({ slots: 1, maxWaitMs: 40 });
    app = await authApp(prisma, {}, createRepository(prisma, { passwords: createPasswordService(gate, { N: 1024, r: 8, p: 1 }) }));
    let release!: () => void;
    const hold = gate.run(() => new Promise<void>((r) => (release = r)));
    const res = await login(app, 'ana@x.test', TEST_PASSWORD);
    release();
    await hold;
    expect(res.statusCode).toBe(503);
    expect(res.headers['retry-after']).toBe('5');
    expect(res.json().error).toBe('service_busy');
    expect(await prisma.session.count({ where: { user: { email: 'ana@x.test' } } })).toBe(0);
  });
});

describe('logout, me and password (BR4.7, BR4.12)', () => {
  let token: string;
  beforeEach(async () => {
    app = await authApp(prisma);
    await makeUser(prisma, { email: 'ana@x.test', name: 'Ana', role: 'viewer', password: TEST_PASSWORD });
    token = (await login(app, 'ana@x.test', TEST_PASSWORD)).json().sessionToken;
  });
  const bearer = () => ({ authorization: `Bearer ${token}` });

  it('logout answers 204, clears the cookie, and the token stops working; other sessions live on', async () => {
    const other = (await login(app, 'ana@x.test', TEST_PASSWORD)).json().sessionToken;
    const res = await app.rawInject({ method: 'POST', url: '/api/v1/auth/logout', headers: bearer() });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers['set-cookie'])).toMatch(/ddcl_session=;/);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer() })).statusCode).toBe(401);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: `Bearer ${other}` } })).statusCode).toBe(200);
  });

  it('logout without a session answers 401', async () => {
    expect((await app.rawInject({ method: 'POST', url: '/api/v1/auth/logout' })).statusCode).toBe(401);
  });

  it('me serves every role with id, name, email and role only', async () => {
    const res = await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer() });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ name: 'Ana', email: 'ana@x.test', role: 'viewer' });
    expect(Object.keys(res.json()).sort()).toEqual(['email', 'id', 'name', 'role']);
  });

  it('a login that carries a valid session revokes it', async () => {
    const second = await login(app, 'ana@x.test', TEST_PASSWORD, bearer());
    expect(second.statusCode).toBe(200);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/auth/me', headers: bearer() })).statusCode).toBe(401);
  });

  it('changes the password (204) for any role; the old one stops working', async () => {
    const res = await app.rawInject({
      method: 'POST',
      url: '/api/v1/auth/password',
      headers: bearer(),
      payload: { currentPassword: TEST_PASSWORD, newPassword: 'kata-sandi-baru-1' },
    });
    expect(res.statusCode).toBe(204);
    expect((await login(app, 'ana@x.test', TEST_PASSWORD)).statusCode).toBe(401);
    expect((await login(app, 'ana@x.test', 'kata-sandi-baru-1')).statusCode).toBe(200);
  });

  it('answers 400 for a wrong current or too short new password, and 429 after 5 wrong ones', async () => {
    const change = (currentPassword: string, newPassword: string) =>
      app.rawInject({ method: 'POST', url: '/api/v1/auth/password', headers: bearer(), payload: { currentPassword, newPassword } });
    const short = await change(TEST_PASSWORD, 'pendek');
    expect(short.statusCode).toBe(400);
    expect(short.json().fields).toEqual(['newPassword']);
    for (let i = 0; i < 5; i++) expect((await change('bukan-sandi-lama', 'kata-sandi-baru-1')).statusCode).toBe(400);
    const locked = await change(TEST_PASSWORD, 'kata-sandi-baru-1');
    expect(locked.statusCode).toBe(429);
    expect(locked.headers['retry-after']).toBeDefined();
  });
});
