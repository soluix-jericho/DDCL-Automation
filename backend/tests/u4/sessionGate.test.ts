import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ROUTE_ROLES } from '../../src/roles';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { authApp, AuthApp, makeSession, makeUser, ORIGIN } from './helpers';

let prisma: PrismaClient;
let app: AuthApp;
const routes: Array<{ method: string; url: string }> = [];
const NOW = `(now() AT TIME ZONE 'UTC')`;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  routes.length = 0;
  app = await authApp(prisma, {
    onRoute: (r) => {
      for (const m of Array.isArray(r.method) ? r.method : [r.method]) routes.push({ method: m, url: r.url });
    },
  });
});
afterEach(async () => {
  await app.close();
});

const bearer = (t: string) => ({ authorization: `Bearer ${t}` });
const stepBody = { name: 'S', category: 'Database', kind: 'forward', columns: [{ lines: ['x'] }] };

describe('every /api/v1 route is behind the gate (BR4.8, NFR5.20)', () => {
  const apiRoutes = () =>
    routes
      .filter((r) => r.url.startsWith('/api/v1') && r.method !== 'OPTIONS' && r.method !== 'HEAD')
      .filter((r) => !(r.method === 'POST' && r.url === '/api/v1/auth/login'));

  it('answers 401 without a session on every registered route, with the path parameters filled in', async () => {
    expect(apiRoutes().length).toBeGreaterThanOrEqual(20);
    for (const r of apiRoutes()) {
      const url = r.url.replace(/:[A-Za-z]+/g, 'x');
      const res = await app.rawInject({ method: r.method as 'GET', url });
      expect(res.statusCode, `${r.method} ${url}`).toBe(401);
      expect(res.body).toBe(JSON.stringify({ error: 'unauthorized' }));
    }
  });

  it('has an explicit role declaration for every registered route (nothing is admin by accident)', () => {
    const missing = apiRoutes()
      .map((r) => `${r.method} ${r.url.slice('/api/v1'.length)}`)
      .filter((key) => !(key in ROUTE_ROLES));
    expect(missing).toEqual([]);
  });

  it('declares no route that does not exist', () => {
    const existing = new Set(apiRoutes().map((r) => `${r.method} ${r.url.slice('/api/v1'.length)}`));
    const phantom = Object.keys(ROUTE_ROLES).filter((k) => !existing.has(k));
    expect(phantom).toEqual([]);
  });
});

describe('exemptions and carriers', () => {
  it('serves /health and a CORS preflight without a session', async () => {
    expect((await app.rawInject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    const pre = await app.rawInject({
      method: 'OPTIONS',
      url: '/api/v1/steps',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(pre.statusCode).toBeLessThan(300);
    expect(pre.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(pre.body).toBe('');
  });

  it('treats HEAD like GET', async () => {
    expect((await app.rawInject({ method: 'HEAD', url: '/api/v1/steps' })).statusCode).toBe(401);
    expect((await app.rawInject({ method: 'HEAD', url: '/api/v1/steps', headers: app.as('viewer') })).statusCode).toBe(200);
  });

  it('no longer knows the old dev-session cookie', async () => {
    const res = await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: { cookie: 'ddcl_session=dev-session' } });
    expect(res.statusCode).toBe(401);
  });

  it('prefers Bearer over the cookie when both are present', async () => {
    const good = await makeSession(prisma, app.users.viewer.id);
    const badBearer = await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: { authorization: 'Bearer nope', cookie: `ddcl_session=${good}` } });
    expect(badBearer.statusCode).toBe(401);
    const goodBearer = await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: { authorization: `Bearer ${good}`, cookie: 'ddcl_session=nope' } });
    expect(goodBearer.statusCode).toBe(200);
  });

  it('accepts the cookie alone', async () => {
    const good = await makeSession(prisma, app.users.viewer.id);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: { cookie: `ddcl_session=${good}` } })).statusCode).toBe(200);
  });
});

describe('Origin check (BR4.15)', () => {
  it('rejects a cookie-authenticated write from another origin with 403, and stores nothing', async () => {
    const token = await makeSession(prisma, app.users.editor.id);
    const res = await app.rawInject({
      method: 'POST',
      url: '/api/v1/steps',
      headers: { cookie: `ddcl_session=${token}`, origin: 'http://evil.test' },
      payload: stepBody,
    });
    expect(res.statusCode).toBe(403);
    expect(await prisma.step.count()).toBe(0);
  });

  it('lets a Bearer write through whatever the Origin, and a write without Origin header', async () => {
    const token = await makeSession(prisma, app.users.editor.id);
    const withOrigin = await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: { ...bearer(token), origin: 'http://evil.test' }, payload: stepBody });
    expect(withOrigin.statusCode).toBe(201);
    const noOrigin = await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: { cookie: `ddcl_session=${token}` }, payload: { ...stepBody, name: 'T' } });
    expect(noOrigin.statusCode).toBe(201);
  });

  it('accepts a cookie write from an allowed origin and never checks Origin on reads', async () => {
    const token = await makeSession(prisma, app.users.editor.id);
    const ok = await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: { cookie: `ddcl_session=${token}`, origin: ORIGIN }, payload: stepBody });
    expect(ok.statusCode).toBe(201);
    const read = await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: { cookie: `ddcl_session=${token}`, origin: 'http://evil.test' } });
    expect(read.statusCode).toBe(200);
  });

  it('applies to the login route too, even though it needs no session', async () => {
    const res = await app.rawInject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { origin: 'http://evil.test' },
      payload: { email: 'viewer@example.test', password: 'x' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a Bearer header that is invalid still ends as 401, not as a skipped check', async () => {
    const res = await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: { authorization: 'Bearer nope', origin: 'http://evil.test' }, payload: stepBody });
    expect(res.statusCode).toBe(401);
  });
});

describe('session validity and roles', () => {
  it('rejects expired (idle 8 h, age 7 d), revoked and inactive-user sessions with 401', async () => {
    const u = await makeUser(prisma, { role: 'viewer' });
    const idle = await makeSession(prisma, u.id);
    const old = await makeSession(prisma, u.id);
    const revoked = await makeSession(prisma, u.id);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '9 hours' WHERE "tokenHash" = encode(sha256(convert_to('${idle}','UTF8')),'hex')`);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "createdAt" = ${NOW} - interval '8 days' WHERE "tokenHash" = encode(sha256(convert_to('${old}','UTF8')),'hex')`);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "revokedAt" = ${NOW} WHERE "tokenHash" = encode(sha256(convert_to('${revoked}','UTF8')),'hex')`);
    for (const t of [idle, old, revoked]) {
      expect((await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: bearer(t) })).statusCode).toBe(401);
    }
    const live = await makeSession(prisma, u.id);
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: bearer(live) })).statusCode).toBe(200);
    await prisma.user.update({ where: { id: u.id }, data: { status: 'inactive' } });
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: bearer(live) })).statusCode).toBe(401);
  });

  it('applies a lowered role on the very next request', async () => {
    const u = await makeUser(prisma, { role: 'editor' });
    const t = await makeSession(prisma, u.id);
    expect((await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: bearer(t), payload: stepBody })).statusCode).toBe(201);
    await prisma.user.update({ where: { id: u.id }, data: { role: 'viewer' } });
    expect((await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: bearer(t), payload: { ...stepBody, name: 'T' } })).statusCode).toBe(403);
  });

  it('answers 403 before the route runs: a viewer cannot write and an editor cannot delete', async () => {
    const step = (await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepBody })).json();
    const viewerWrite = await app.rawInject({ method: 'POST', url: '/api/v1/steps', headers: app.as('viewer'), payload: { ...stepBody, name: 'V' } });
    expect(viewerWrite.statusCode).toBe(403);
    expect(viewerWrite.json().error).toBe('forbidden');
    const editorDelete = await app.rawInject({ method: 'DELETE', url: `/api/v1/steps/${step.id}`, headers: app.as('editor') });
    expect(editorDelete.statusCode).toBe(403);
    expect(await prisma.step.count()).toBe(1);
    expect((await app.rawInject({ method: 'DELETE', url: `/api/v1/steps/${step.id}`, headers: app.as('admin') })).statusCode).toBe(200);
  });

  it('fills lastSeenAt lazily without delaying the answer', async () => {
    const u = await makeUser(prisma, { role: 'viewer' });
    const t = await makeSession(prisma, u.id);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '5 minutes' WHERE "userId" = '${u.id}'`);
    const before = (await prisma.session.findFirstOrThrow({ where: { userId: u.id } })).lastSeenAt.getTime();
    expect((await app.rawInject({ method: 'GET', url: '/api/v1/steps', headers: bearer(t) })).statusCode).toBe(200);
    await new Promise((r) => setTimeout(r, 300));
    expect((await prisma.session.findFirstOrThrow({ where: { userId: u.id } })).lastSeenAt.getTime()).toBeGreaterThan(before);
  });
});

describe('who is acting comes from the session only (BR4.16)', () => {
  it('ignores a createdByUserId (or createdBy) sent by the client when creating a DDCL', async () => {
    const res = await app.rawInject({
      method: 'POST',
      url: '/api/v1/ddcls',
      headers: app.as('editor'),
      payload: { title: 'D', createdByUserId: app.users.admin.id, createdBy: 'Orang Lain' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ createdByUserId: app.users.editor.id, createdBy: 'editor' });
    const row = await prisma.ddclDocument.findFirstOrThrow();
    expect(row.createdByUserId).toBe(app.users.editor.id);
  });
});
