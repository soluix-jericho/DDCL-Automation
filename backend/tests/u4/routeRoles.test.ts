import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { buildFixtureTemplate, cleanTmp } from '../helpers/template';
import { authApp, AuthApp, testConfig } from './helpers';

let prisma: PrismaClient;
let app: AuthApp;
let templatePath: string;

beforeAll(async () => {
  prisma = createTestPrisma();
  templatePath = await buildFixtureTemplate('roles-template.xlsx');
});
afterAll(async () => {
  await prisma.$disconnect();
  await cleanTmp();
});
beforeEach(async () => {
  await truncateAll(prisma);
  app = await authApp(prisma, {}, undefined, testConfig({ templatePath }));
});
afterEach(async () => {
  await app.close();
});

const step = { name: 'S', category: 'Database', kind: 'forward', columns: [{ lines: ['x'] }] };
type Role = 'viewer' | 'editor' | 'admin';
const send = (role: Role, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.rawInject({ method, url: `/api/v1${url}`, headers: app.as(role), ...(payload === undefined ? {} : { payload: payload as never }) });

describe('route role matrix (BR4.9, NFR2.27)', () => {
  it('viewer reads everything (steps, bundles, categories, export) and writes nothing', async () => {
    const s = (await send('editor', 'POST', '/steps', step)).json();
    const d = (await send('editor', 'POST', '/ddcls', { title: 'D' })).json();
    for (const url of ['/steps', '/steps/categories', `/steps/${s.id}`, `/steps/${s.id}/impact`, '/bundles', `/ddcls/${d.id}/export`]) {
      expect((await send('viewer', 'GET', url)).statusCode, url).toBe(200);
    }
    const writes: Array<['POST' | 'PATCH' | 'DELETE', string]> = [
      ['POST', '/steps'], ['PATCH', `/steps/${s.id}`], ['DELETE', `/steps/${s.id}`],
      ['POST', '/bundles'], ['POST', '/ddcls'], ['POST', `/ddcls/${d.id}/checklist-items`],
    ];
    for (const [m, url] of writes) expect((await send('viewer', m, url, {})).statusCode, `${m} ${url}`).toBe(403);
    expect(await prisma.step.count()).toBe(1);
  });

  it('editor creates and changes steps, bundles, DDCLs and checklist items, but deletes nothing', async () => {
    const s = await send('editor', 'POST', '/steps', step);
    expect(s.statusCode).toBe(201);
    const id = s.json().id;
    expect((await send('editor', 'PATCH', `/steps/${id}`, { name: 'S2', category: 'Database', columns: [{ lines: ['y'] }] })).statusCode).toBe(200);
    const b = await send('editor', 'POST', '/bundles', { name: 'B', forwardStepIds: [id], rollbackStepIds: [] });
    expect(b.statusCode).toBe(201);
    expect((await send('editor', 'PATCH', `/bundles/${b.json().id}`, { name: 'B2', forwardStepIds: [id], rollbackStepIds: [] })).statusCode).toBe(200);
    const d = await send('editor', 'POST', '/ddcls', { title: 'D' });
    expect(d.statusCode).toBe(201);
    expect((await send('editor', 'POST', `/ddcls/${d.json().id}/checklist-items`, { stepId: id })).statusCode).toBe(201);
    expect((await send('editor', 'DELETE', `/steps/${id}`)).statusCode).toBe(403);
    expect((await send('editor', 'DELETE', `/bundles/${b.json().id}`)).statusCode).toBe(403);
  });

  it('admin does everything an editor does and also deletes steps and bundles', async () => {
    const id = (await send('admin', 'POST', '/steps', step)).json().id;
    const bid = (await send('admin', 'POST', '/bundles', { name: 'B', forwardStepIds: [id], rollbackStepIds: [] })).json().id;
    expect((await send('admin', 'DELETE', `/bundles/${bid}`)).statusCode).toBe(200);
    expect((await send('admin', 'DELETE', `/steps/${id}`)).statusCode).toBe(200);
  });

  it('serves auth routes to every role', async () => {
    for (const role of ['viewer', 'editor', 'admin'] as const) {
      expect((await send(role, 'GET', '/auth/me')).statusCode).toBe(200);
    }
  });

  it('keeps a request that is allowed but invalid a 400, not a 403', async () => {
    expect((await send('editor', 'POST', '/steps', { name: '' })).statusCode).toBe(400);
  });
});
