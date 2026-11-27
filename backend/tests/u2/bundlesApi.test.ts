import { PrismaClient } from '@prisma/client';
import type { AuthApp } from '../u4/helpers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRepository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeApp, seedRollback, seedStep } from './helpers';

let prisma: PrismaClient;
let app: AuthApp;
let ids: { f1: string; f2: string; f3: string; r1: string; r2: string };

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  app = await makeApp(prisma);
  const repo = createRepository(prisma);
  ids = {
    f1: (await seedStep(repo, { name: 'F1' })).id,
    f2: (await seedStep(repo, { name: 'F2' })).id,
    f3: (await seedStep(repo, { name: 'F3' })).id,
    r1: (await seedRollback(repo, 'R1')).id,
    r2: (await seedRollback(repo, 'R2')).id,
  };
});
afterEach(async () => {
  await app.close();
});

const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/bundles', payload: payload as never });
const body = (over: Record<string, unknown> = {}) => ({
  name: 'Buka database',
  category: 'Database',
  forwardStepIds: [ids.f1, ids.f2, ids.f3],
  rollbackStepIds: [ids.r2, ids.r1],
  ...over,
});

describe('POST /api/v1/bundles', () => {
  it('creates a bundle (201) with ordered forward members and its own rollback sequence of a different length', async () => {
    const res = await post(body({ rollbackStepIds: [ids.r1] }));
    expect(res.statusCode).toBe(201);
    const bundle = res.json();
    expect(bundle.forward.map((s: { name: string }) => s.name)).toEqual(['F1', 'F2', 'F3']);
    expect(bundle.rollback.map((s: { name: string }) => s.name)).toEqual(['R1']);
    expect(bundle.forward[0].columns[0].lines[0]).toContain('kubectl');
  });

  it('returns 400 naming the field when the name is empty, nothing is forward, or a member has the wrong kind', async () => {
    const empty = await post(body({ name: '' }));
    expect(empty.statusCode).toBe(400);
    expect(empty.json().fields).toEqual(['name']);
    expect((await post(body({ forwardStepIds: [] }))).json().fields).toEqual(['forwardStepIds']);
    const wrong = await post(body({ forwardStepIds: [ids.r1], rollbackStepIds: [] }));
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json().fields).toEqual(['forwardStepIds']);
    const wrongRb = await post(body({ rollbackStepIds: [ids.f2] }));
    expect(wrongRb.json().fields).toEqual(['rollbackStepIds']);
    expect(await prisma.stepBundle.count()).toBe(0);
  });

  it('returns 409 with the existing bundle and conflictOn=bundle for a duplicate name', async () => {
    const first = (await post(body())).json();
    const res = await post(body({ name: ' BUKA DATABASE ' }));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: 'conflict', conflictOn: 'bundle' });
    expect(res.json().existing.id).toBe(first.id);
  });

  it('answers 400 for a JSON body that is not an object', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/bundles',
      headers: { 'content-type': 'application/json' },
      payload: '"x"',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields).toEqual(['body']);
  });
});

describe('GET /api/v1/bundles', () => {
  it('lists summaries with member counts and filters on the server', async () => {
    await post(body());
    await post(body({ name: 'Cek 100%', category: 'Bastion', forwardStepIds: [ids.f1], rollbackStepIds: [] }));
    const all = await app.inject({ method: 'GET', url: '/api/v1/bundles' });
    expect(all.statusCode).toBe(200);
    expect(all.json().map((b: { name: string; forwardCount: number; rollbackCount: number }) => [b.name, b.forwardCount, b.rollbackCount])).toEqual([
      ['Buka database', 3, 2],
      ['Cek 100%', 1, 0],
    ]);
    expect(all.json()[0]).not.toHaveProperty('forward');
    const q = await app.inject({ method: 'GET', url: '/api/v1/bundles?q=%25' });
    expect(q.json().map((b: { name: string }) => b.name)).toEqual(['Cek 100%']);
    const cat = await app.inject({ method: 'GET', url: '/api/v1/bundles?category=Database' });
    expect(cat.json().map((b: { name: string }) => b.name)).toEqual(['Buka database']);
    expect((await app.inject({ method: 'GET', url: '/api/v1/bundles?category=Nope' })).statusCode).toBe(400);
  });
});

describe('GET, PATCH, DELETE /api/v1/bundles/:id', () => {
  it('reads a bundle with full ordered steps, 404 for an unknown id', async () => {
    const created = (await post(body())).json();
    const res = await app.inject({ method: 'GET', url: `/api/v1/bundles/${created.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().rollback.map((s: { name: string }) => s.name)).toEqual(['R2', 'R1']);
    expect((await app.inject({ method: 'GET', url: '/api/v1/bundles/nope' })).statusCode).toBe(404);
  });

  it('updates members and order (200), 404 when unknown, 409 on a clash with another bundle', async () => {
    const a = (await post(body())).json();
    await post(body({ name: 'Lain', forwardStepIds: [ids.f1], rollbackStepIds: [] }));
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/v1/bundles/${a.id}`,
      payload: body({ forwardStepIds: [ids.f3, ids.f1], rollbackStepIds: [] }) as never,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().forward.map((s: { name: string }) => s.name)).toEqual(['F3', 'F1']);
    expect(ok.json().rollback).toEqual([]);
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/bundles/nope', payload: body() as never })).statusCode).toBe(404);
    const clash = await app.inject({ method: 'PATCH', url: `/api/v1/bundles/${a.id}`, payload: body({ name: 'lain' }) as never });
    expect(clash.statusCode).toBe(409);
  });

  it('deletes a bundle (200) without deleting its steps; a second delete is 404', async () => {
    const a = (await post(body())).json();
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/bundles/${a.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toMatchObject({ id: a.id, forwardCount: 3, rollbackCount: 2 });
    expect(await prisma.step.count()).toBe(5);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/bundles/${a.id}` })).statusCode).toBe(404);
  });

  it('deleting a step removes it from the bundle read back through the API (BR2.7)', async () => {
    const a = (await post(body())).json();
    await app.inject({ method: 'DELETE', url: `/api/v1/steps/${ids.f2}` });
    const res = await app.inject({ method: 'GET', url: `/api/v1/bundles/${a.id}` });
    expect(res.json().forward.map((s: { name: string }) => s.name)).toEqual(['F1', 'F3']);
  });
});
