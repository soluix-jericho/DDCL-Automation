import { PrismaClient } from '@prisma/client';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultLogger } from '../../src/app';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { authApp, AuthApp, makeUser, ORIGIN, TEST_PASSWORD } from './helpers';

let prisma: PrismaClient;
let app: AuthApp;
let out: string;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  out = '';
  const stream = new Writable({
    write(chunk, _enc, cb) {
      out += chunk.toString();
      cb();
    },
  });
  app = await authApp(prisma, { logger: { ...defaultLogger, level: 'info', stream } });
});
afterEach(async () => {
  await app.close();
});

const lines = () => out.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);

describe('log content (NFR3.24, NFR3.25)', () => {
  it('never contains passwords, tokens, hashes or cookie values, while still logging the events', async () => {
    const u = await makeUser(prisma, { email: 'ana@x.test', password: TEST_PASSWORD });
    const wrong = 'sandi-yang-salah-123';
    await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: u.email, password: wrong } });
    const ok = await app.rawInject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: u.email, password: TEST_PASSWORD } });
    const token = ok.json().sessionToken as string;
    await app.rawInject({ method: 'POST', url: '/api/v1/auth/password', headers: { authorization: `Bearer ${token}` }, payload: { currentPassword: TEST_PASSWORD, newPassword: 'kata-sandi-baru-1' } });
    await app.rawInject({ method: 'GET', url: '/api/v1/users', headers: { authorization: `Bearer ${token}`, cookie: `ddcl_session=${token}` } }); // 403
    await app.rawInject({ method: 'GET', url: '/api/v1/steps' }); // 401
    const hash = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).passwordHash;
    for (const secret of [wrong, TEST_PASSWORD, 'kata-sandi-baru-1', token, hash, 'scrypt$']) {
      expect(out, secret).not.toContain(secret);
    }
    const events = lines().map((l) => l.event).filter(Boolean);
    expect(events).toEqual(expect.arrayContaining(['login_success', 'password_changed', 'access_denied']));
  });

  it('logs 401 and 403 as one info line with fixed fields', async () => {
    await app.rawInject({ method: 'GET', url: '/api/v1/steps' });
    await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: app.as('viewer'), payload: {} });
    const denied = lines().filter((l) => l.event === 'access_denied');
    expect(denied).toHaveLength(2);
    for (const l of denied) {
      expect(l.level).toBe('info');
      expect(Object.keys(l)).toEqual(expect.arrayContaining(['event', 'ip', 'requestId', 'route', 'outcome', 'reason']));
    }
    expect(denied.map((l) => l.outcome)).toEqual([401, 403]);
    expect(denied[1]).toMatchObject({ userId: app.users.viewer.id, route: 'POST /api/v1/steps' });
  });

  it('redacts sensitive fields in any logged object, as a second line of defence', async () => {
    app.log.info({ password: 'p-1', passwordHash: 'h-1', tokenHash: 't-1', token: 'k-1', nested: { password: 'p-2', cookie: 'c-2' }, req: { headers: { authorization: 'Bearer a-3', cookie: 'ddcl_session=c-3' } } }, 'probe');
    for (const secret of ['p-1', 'h-1', 't-1', 'k-1', 'p-2', 'c-2', 'a-3', 'c-3']) expect(out).not.toContain(secret);
    expect(out).toContain('[Redacted]');
  });

  it('answers an unexpected failure with a generic 500 and keeps the detail on the server (NFR3.26)', async () => {
    await app.close();
    const stream = new Writable({ write: (c, _e, cb) => { out += c.toString(); cb(); } });
    app = await authApp(prisma, { logger: { ...defaultLogger, level: 'info', stream } });
    await prisma.$executeRawUnsafe('ALTER TABLE "Step" RENAME TO "Step_x"');
    try {
      const res = await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: app.as('viewer') });
      expect(res.statusCode).toBe(500);
      expect(res.body).not.toMatch(/Step|prisma|relation/i);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE "Step_x" RENAME TO "Step"');
    }
    expect(out).toMatch(/Unexpected error/);
  });
});
