import { Prisma, PrismaClient } from '@prisma/client';
import type { AuthApp } from '../u4/helpers';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RetryExhausted, ServiceBusyError } from '../../src/errors';
import { createRepository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeApp, seedDdclWithItem, seedStep, stepJson } from './helpers';

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
  app = await makeApp(prisma);
});
afterEach(async () => {
  await app.close();
});

const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/v1/steps', payload: payload as never });

describe('POST /api/v1/steps', () => {
  it('creates a step with columns, lines and attachments (201) and returns derived variables', async () => {
    const res = await post(
      stepJson({ attachments: [{ filename: 'deploy.yaml', content: 'kind: Pod\nspec: {}' }] }),
    );
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({
      name: 'Update Deployment',
      kind: 'forward',
      variables: ['file', 'pod'],
      columns: [{ label: 'Utama', lines: ['kubectl apply -f {file}', 'cek pod {pod}'] }],
      attachments: [{ filename: 'deploy.yaml' }],
    });
    expect(body.id).toBeTruthy();
  });

  it('creates a forward step together with a new rollback step as a pair (201)', async () => {
    const res = await post(
      stepJson({ rollbackStep: { name: 'Balikkan Deployment', category: 'Database', columns: [{ lines: ['kubectl rollout undo'] }] } }),
    );
    expect(res.statusCode).toBe(201);
    const partner = await app.inject({ method: 'GET', url: `/api/v1/steps/${res.json().pairedRollbackStepId}` });
    expect(partner.json()).toMatchObject({ name: 'Balikkan Deployment', kind: 'rollback' });
  });

  it('returns 400 naming the bad fields and stores nothing', async () => {
    const res = await post({ name: '', category: 'Nope', kind: 'forward', columns: [{ lines: ['ok {}'] }] });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: 'validation_error' });
    expect(res.json().fields).toEqual(['name', 'category', 'columns[0].lines[0]']);
    expect(await prisma.step.count()).toBe(0);
  });

  it('tells column, step number and position of an invalid brace', async () => {
    const res = await post(stepJson({ columns: [{ lines: ['a'] }, { lines: ['ok', 'x {a.b}'] }] }));
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/Kolom 2, langkah 2, karakter 3/);
  });

  it('returns 409 with the full existing step and conflictOn=step for a duplicate name in the category', async () => {
    const first = (await post(stepJson({ attachments: [{ filename: 'a.sql', content: 'select 1' }] }))).json();
    const res = await post(stepJson({ name: 'update deployment ', columns: [{ lines: ['lain'] }] }));
    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body).toMatchObject({ error: 'conflict', conflictOn: 'step' });
    expect(body.existing).toMatchObject({ id: first.id, attachments: [{ filename: 'a.sql', content: 'select 1' }] });
    expect(await prisma.step.count()).toBe(1);
  });

  it('returns 409 conflictOn=rollbackStep and stores neither step when the inline rollback clashes', async () => {
    await post(stepJson({ name: 'Balik', kind: 'rollback' }));
    const res = await post(
      stepJson({ name: 'Maju', rollbackStep: { name: 'BALIK', category: 'Database', columns: [{ lines: ['x'] }] } }),
    );
    expect(res.statusCode).toBe(409);
    expect(res.json().conflictOn).toBe('rollbackStep');
    expect(await prisma.step.count()).toBe(1);
  });

  it('returns a clean 400 for malformed JSON and 400 for a non-object body', async () => {
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/steps',
      headers: { 'content-type': 'application/json' },
      payload: '{bad json',
    });
    expect(bad.statusCode).toBe(400);
    expect((await post([1, 2])).statusCode).toBe(400);
  });

  it('answers 401 on Library routes without a session (U4 replaces the stub of NFR2.6)', async () => {
    const res = await app.rawInject({ method: 'GET', url: '/api/v1/steps' });
    expect(res.statusCode).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('GET /api/v1/steps and /steps/categories', () => {
  it('lists summaries only, filtered on the server by q and category', async () => {
    await post(stepJson({ name: 'Update Image', attachments: [{ filename: 'a', content: 'RAHASIA' }] }));
    await post(stepJson({ name: 'Open Port', category: 'Bastion' }));
    const all = await app.inject({ method: 'GET', url: '/api/v1/steps' });
    expect(all.statusCode).toBe(200);
    expect(all.json()).toHaveLength(2);
    expect(all.body).not.toMatch(/RAHASIA|kubectl/);
    expect(all.json()[0]).toHaveProperty('usageCount');
    expect(all.json()[0]).toHaveProperty('missingRollback');
    const byQ = await app.inject({ method: 'GET', url: '/api/v1/steps?q=image' });
    expect(byQ.json().map((s: { name: string }) => s.name)).toEqual(['Update Image']);
    const byCat = await app.inject({ method: 'GET', url: '/api/v1/steps?category=Bastion' });
    expect(byCat.json().map((s: { name: string }) => s.name)).toEqual(['Open Port']);
    const none = await app.inject({ method: 'GET', url: '/api/v1/steps?q=zzzz' });
    expect(none.statusCode).toBe(200);
    expect(none.json()).toEqual([]);
  });

  it('matches % and _ literally and survives a backslash in q (NFR2.9)', async () => {
    await post(stepJson({ name: 'Disk 100% full' }));
    await post(stepJson({ name: 'Ordinary' }));
    const pct = await app.inject({ method: 'GET', url: '/api/v1/steps?q=%25' });
    expect(pct.json().map((s: { name: string }) => s.name)).toEqual(['Disk 100% full']);
    const us = await app.inject({ method: 'GET', url: '/api/v1/steps?q=_' });
    expect(us.json()).toEqual([]);
    const bs = await app.inject({ method: 'GET', url: '/api/v1/steps?q=%5C' });
    expect(bs.statusCode).toBe(200);
  });

  it('rejects an unknown category or a q over 200 characters with 400', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/v1/steps?category=Nope' })).statusCode).toBe(400);
    expect((await app.inject({ method: 'GET', url: `/api/v1/steps?q=${'a'.repeat(201)}` })).statusCode).toBe(400);
  });

  it('returns the four categories as { name } (BR2.12)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/steps/categories' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ name: 'Database' }, { name: 'Bastion' }, { name: 'RabbitMQ' }, { name: 'Keycloak' }]);
  });
});

describe('GET, PATCH, DELETE /api/v1/steps/:id', () => {
  it('reads one step in full and answers 404 for an unknown id', async () => {
    const created = (await post(stepJson())).json();
    const got = await app.inject({ method: 'GET', url: `/api/v1/steps/${created.id}` });
    expect(got.statusCode).toBe(200);
    expect(got.json().columns[0].lines).toHaveLength(2);
    expect((await app.inject({ method: 'GET', url: '/api/v1/steps/nope' })).statusCode).toBe(404);
  });

  it('updates a step (200), 404 for unknown, 409 on a name clash, 400 when the kind is changed', async () => {
    const a = (await post(stepJson({ name: 'A' }))).json();
    await post(stepJson({ name: 'B' }));
    const ok = await app.inject({
      method: 'PATCH',
      url: `/api/v1/steps/${a.id}`,
      payload: stepJson({ name: 'A2', kind: undefined, columns: [{ lines: ['baru'] }] }),
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ name: 'A2', columns: [{ label: null, lines: ['baru'] }] });
    const missing = await app.inject({ method: 'PATCH', url: '/api/v1/steps/nope', payload: stepJson() as never });
    expect(missing.statusCode).toBe(404);
    const clash = await app.inject({ method: 'PATCH', url: `/api/v1/steps/${a.id}`, payload: stepJson({ name: 'b' }) as never });
    expect(clash.statusCode).toBe(409);
    const kind = await app.inject({
      method: 'PATCH',
      url: `/api/v1/steps/${a.id}`,
      payload: stepJson({ name: 'A2', kind: 'rollback' }) as never,
    });
    expect(kind.statusCode).toBe(400);
    expect(kind.json().fields).toEqual(['kind']);
  });

  it('previews the impact, then deletes with 200 and the same impact; a second delete is 404', async () => {
    const rb = (await post(stepJson({ name: 'Balik', kind: 'rollback' }))).json();
    const fwd = (await post(stepJson({ name: 'Maju', pairedRollbackStepId: rb.id }))).json();
    await seedDdclWithItem(createRepository(prisma), rb.id);
    const preview = await app.inject({ method: 'GET', url: `/api/v1/steps/${rb.id}/impact` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toMatchObject({ usageCount: 1, checklistItems: 1, pairLost: [{ id: fwd.id, name: 'Maju' }] });
    const del = await app.inject({ method: 'DELETE', url: `/api/v1/steps/${rb.id}` });
    expect(del.statusCode).toBe(200);
    expect(del.json()).toEqual({ id: rb.id, impact: preview.json() });
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/steps/${rb.id}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/api/v1/steps/${rb.id}/impact` })).statusCode).toBe(404);
  });
});

describe('payload sizes (NFR1.8, NFR1.10)', () => {
  const maxStep = (name: string, char: string, extra: Record<string, unknown> = {}) => ({
    name,
    category: 'Database',
    kind: 'forward',
    columns: Array.from({ length: 10 }, (_, c) => ({
      label: `k${c}`,
      lines: Array.from({ length: 50 }, () => char.repeat(2000)),
    })),
    attachments: Array.from({ length: 10 }, (_, i) => ({ filename: `f${i}.txt`, content: char.repeat(i < 5 ? 100 : 25_600) })),
    ...extra,
  });

  it('accepts a maximum-size step with an inline rollbackStep (about 10 MB of ASCII) without 413', async () => {
    const res = await post(maxStep('Besar', 'x', { rollbackStep: maxStep('Besar balik', 'y', { kind: 'rollback' }) }));
    expect(res.statusCode).toBe(201);
    expect(await prisma.stepLine.count()).toBe(1000);
  }, 60000);

  it('accepts the same step made of 4-byte characters (raw UTF-8, the worst case of supported clients)', async () => {
    const res = await post(
      maxStep('Besar emoji', '😀', { rollbackStep: maxStep('Besar emoji balik', '😀', { kind: 'rollback' }) }),
    );
    expect(res.statusCode).toBe(201);
  }, 60000);

  it('answers 413 with a generic error above the 24 MiB body limit and stores nothing', async () => {
    const huge = 'z'.repeat(25 * 1024 * 1024);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/steps',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Raksasa', category: 'Database', kind: 'forward', columns: [{ lines: [huge] }] }),
    });
    expect(res.statusCode).toBe(413);
    expect(res.json()).toEqual({ error: 'payload_too_large', message: 'Data yang dikirim terlalu besar.' });
    expect(await prisma.step.count()).toBe(0);
  }, 60000);

  it('keeps the default 1 MiB limit on U1 routes (only Library write routes are raised)', async () => {
    const big = 'q'.repeat(2 * 1024 * 1024);
    const res = await app.inject({ method: 'POST', url: '/api/v1/ddcls', payload: { title: big } });
    expect(res.statusCode).toBe(413);
  });
});

describe('error mapping to HTTP (reliability-design.md)', () => {
  async function appWhereCreateFails(err: Error) {
    const repo = createRepository(prisma);
    repo.createStep = async () => {
      throw err;
    };
    return makeApp(prisma, {}, repo);
  }

  it('maps pool exhaustion (P2024) and ServiceBusyError to 503 with Retry-After: 2', async () => {
    for (const err of [
      new Prisma.PrismaClientKnownRequestError('pool', { code: 'P2024', clientVersion: 'x' }),
      new ServiceBusyError('pool'),
    ]) {
      const a = await appWhereCreateFails(err);
      const res = await a.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
      expect(res.statusCode).toBe(503);
      expect(res.headers['retry-after']).toBe('2');
      expect(res.json().error).toBe('service_busy');
      await a.close();
    }
  });

  it('maps exhausted deadlock retries to 409 "coba lagi" and a vanished foreign key (P2003) to 404', async () => {
    const retry = await appWhereCreateFails(new RetryExhausted('createStep'));
    const r1 = await retry.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
    expect(r1.statusCode).toBe(409);
    expect(r1.json().error).toBe('retry');
    await retry.close();

    const fk = await appWhereCreateFails(new Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x' }));
    const r2 = await fk.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
    expect(r2.statusCode).toBe(404);
    await fk.close();
  });

  it('hides everything else behind a generic 500', async () => {
    const a = await appWhereCreateFails(new Error('connection string postgresql://u:secret@host'));
    const res = await a.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toMatch(/secret|postgresql/);
    await a.close();
  });

  it('still lets a step be added to a DDCL and exports through the U1 flow after Library changes', async () => {
    const step = await seedStep(createRepository(prisma), { name: 'Dipasang' });
    const d = (await app.inject({ method: 'POST', url: '/api/v1/ddcls', payload: { title: 'T' } })).json();
    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/ddcls/${d.id}/checklist-items`,
      payload: { stepId: step.id },
    });
    expect(ok.statusCode).toBe(201);
    const stored = await prisma.checklistItem.findFirstOrThrow({ where: { ddclId: d.id } });
    expect(stored.stepSnapshot).toMatchObject({ name: 'Dipasang' });
  });
});
