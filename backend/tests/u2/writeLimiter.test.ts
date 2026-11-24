import { PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ServiceBusyError } from '../../src/errors';
import { createRepository } from '../../src/repository';
import { createWriteLimiter, MAX_CONCURRENT_WRITES } from '../../src/writeLimiter';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeApp, stepJson } from './helpers';

let prisma: PrismaClient;
let app: FastifyInstance | undefined;

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
  app = undefined;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('condition not met in time');
    await sleep(10);
  }
}
const req = () => ({}) as FastifyRequest;

describe('createWriteLimiter (unit)', () => {
  it('admits up to the maximum and rejects the next with ServiceBusyError(write-limit)', async () => {
    const limiter = createWriteLimiter();
    expect(MAX_CONCURRENT_WRITES).toBe(4);
    const held = Array.from({ length: 4 }, req);
    for (const r of held) await limiter.onRequest(r);
    expect(limiter.activeCount()).toBe(4);
    await expect(limiter.onRequest(req())).rejects.toMatchObject({ reason: 'write-limit' });
    await expect(limiter.onRequest(req())).rejects.toBeInstanceOf(ServiceBusyError);
    expect(limiter.activeCount()).toBe(4);
  });

  it('release is idempotent: releasing twice, or a request that never got a slot, changes nothing extra', async () => {
    const limiter = createWriteLimiter(2);
    const a = req();
    await limiter.onRequest(a);
    await limiter.release(a);
    await limiter.release(a); // onResponse and onRequestAbort can both fire
    await limiter.release(req()); // rejected request: never admitted
    expect(limiter.activeCount()).toBe(0);
    await limiter.onRequest(req());
    await limiter.onRequest(req());
    await expect(limiter.onRequest(req())).rejects.toBeInstanceOf(ServiceBusyError);
  });
});

describe('write limiter in the API (503 and slot release)', () => {
  it('turns away the request over the limit with 503 + Retry-After: 2 while GET requests stay unlimited', async () => {
    const repo = createRepository(prisma);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let entered = 0;
    const original = repo.createStep.bind(repo);
    repo.createStep = async (input) => {
      entered += 1;
      await gate;
      return original(input);
    };
    const limiter = createWriteLimiter(2);
    app = await makeApp(prisma, { writeLimiter: limiter }, repo);

    const first = app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson({ name: 'S1' }) as never });
    const second = app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson({ name: 'S2' }) as never });
    await until(() => entered === 2);

    const third = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson({ name: 'S3' }) as never });
    expect(third.statusCode).toBe(503);
    expect(third.headers['retry-after']).toBe('2');
    expect(third.json().error).toBe('service_busy');
    const read = await app.inject({ method: 'GET', url: '/api/v1/steps' });
    expect(read.statusCode).toBe(200); // reads are not limited
    const patch = await app.inject({ method: 'DELETE', url: '/api/v1/steps/x' });
    expect(patch.statusCode).toBe(503); // every Library write route shares the limit

    release();
    expect((await first).statusCode).toBe(201);
    expect((await second).statusCode).toBe(201);
    expect(limiter.activeCount()).toBe(0);
    const again = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson({ name: 'S4' }) as never });
    expect(again.statusCode).toBe(201); // slot is free again
  });

  it('releases the slot after a 413, a 400 and a 500 (try/finally semantics)', async () => {
    const repo = createRepository(prisma);
    repo.createStep = async () => {
      throw new Error('boom');
    };
    const limiter = createWriteLimiter(1);
    app = await makeApp(prisma, { writeLimiter: limiter }, repo);

    const tooBig = await app.inject({
      method: 'POST',
      url: '/api/v1/steps',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'x', category: 'Database', kind: 'forward', columns: [{ lines: ['z'.repeat(25 * 1024 * 1024)] }] }),
    });
    expect(tooBig.statusCode).toBe(413);
    expect(limiter.activeCount()).toBe(0);

    const invalid = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: { name: '' } });
    expect(invalid.statusCode).toBe(400);
    expect(limiter.activeCount()).toBe(0);

    const failing = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
    expect(failing.statusCode).toBe(500);
    expect(limiter.activeCount()).toBe(0);

    const missing = await app.inject({ method: 'DELETE', url: '/api/v1/steps/nope' });
    expect(missing.statusCode).toBe(404);
    expect(limiter.activeCount()).toBe(0);
  }, 60000);

  it('releases the slot when the client aborts mid-upload (onRequestAbort)', async () => {
    const limiter = createWriteLimiter(1);
    app = await makeApp(prisma, { writeLimiter: limiter });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as AddressInfo).port;

    const clientRequest = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/v1/steps',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '1000000' },
    });
    clientRequest.on('error', () => undefined);
    clientRequest.write('{"name":"partial');
    await until(() => limiter.activeCount() === 1);
    clientRequest.destroy();
    await until(() => limiter.activeCount() === 0);

    const ok = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepJson() as never });
    expect(ok.statusCode).toBe(201);
  });

  it('rejects an over-limit request before its body is read', async () => {
    const limiter = createWriteLimiter(1);
    await limiter.onRequest(req()); // the only slot is taken
    app = await makeApp(prisma, { writeLimiter: limiter });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const port = (app.server.address() as AddressInfo).port;

    const r = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/v1/steps',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '5000000' },
    });
    const status = await new Promise<number>((resolve, reject) => {
      r.on('response', (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      r.on('error', reject);
      r.write('{"name":"never fully sent'); // the body is never completed
    });
    r.destroy();
    expect(status).toBe(503);
  });
});
