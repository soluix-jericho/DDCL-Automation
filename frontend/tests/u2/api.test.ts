import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  BUSY_MESSAGE,
  createBundle,
  createStep,
  deleteBundle,
  deleteStep,
  GENERIC_ERROR,
  getBundle,
  getStep,
  getStepImpact,
  listBundles,
  listSteps,
  updateBundle,
  updateStep,
} from '../../src/api';
import { json } from './mock';

const draft = {
  name: 'A',
  category: 'Database',
  kind: 'forward' as const,
  columns: [{ label: null, lines: ['x'] }],
  attachments: [],
};

function stub(response: Response | (() => Response)) {
  const fn = vi.fn(async () => (typeof response === 'function' ? response() : response));
  vi.stubGlobal('fetch', fn);
  return fn;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('Library API client', () => {
  it('builds the list query from q and category, skipping empty values, and sends credentials', async () => {
    const fn = stub(() => json(200, []));
    await listSteps({ q: 'image', category: 'Bastion' });
    await listSteps({ q: '', category: '' });
    await listSteps();
    await listBundles({ q: 'a b' });
    const urls = fn.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls[0]).toMatch(/\/api\/v1\/steps\?q=image&category=Bastion$/);
    expect(urls[1]).toMatch(/\/api\/v1\/steps$/);
    expect(urls[2]).toMatch(/\/api\/v1\/steps$/);
    expect(urls[3]).toMatch(/\/api\/v1\/bundles\?q=a\+b$/);
    expect((fn.mock.calls[0] as unknown[])[1]).toMatchObject({ credentials: 'include' });
  });

  it('uses the right method and body for every step call, and encodes ids', async () => {
    const fn = stub(() => json(200, {}));
    await createStep(draft);
    await updateStep('a/b', draft);
    await getStep('s1');
    await getStepImpact('s1');
    await deleteStep('s1');
    const calls = fn.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([u, i]) => `${i?.method ?? 'GET'} ${new URL(u).pathname}`)).toEqual([
      'POST /api/v1/steps',
      'PATCH /api/v1/steps/a%2Fb',
      'GET /api/v1/steps/s1',
      'GET /api/v1/steps/s1/impact',
      'DELETE /api/v1/steps/s1',
    ]);
    expect(JSON.parse(String(calls[0]?.[1].body))).toEqual(draft);
    expect(calls[4]?.[1].body).toBeUndefined(); // a DELETE carries no JSON body or content type
  });

  it('uses the right method and body for every bundle call', async () => {
    const fn = stub(() => json(200, {}));
    const b = { name: 'B', category: null, forwardStepIds: ['a'], rollbackStepIds: [] };
    await createBundle(b);
    await updateBundle('b1', b);
    await getBundle('b1');
    await deleteBundle('b1');
    const calls = fn.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls.map(([u, i]) => `${i?.method ?? 'GET'} ${new URL(u).pathname}`)).toEqual([
      'POST /api/v1/bundles',
      'PATCH /api/v1/bundles/b1',
      'GET /api/v1/bundles/b1',
      'DELETE /api/v1/bundles/b1',
    ]);
  });

  it('carries the bad fields of a 400 in ApiError', async () => {
    stub(json(400, { error: 'validation_error', message: 'Nama wajib', fields: ['name', 'columns'] }));
    const err = (await createStep(draft).catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: 'Nama wajib', fields: ['name', 'columns'] });
  });

  it('carries the existing step and conflictOn of a 409', async () => {
    stub(json(409, { error: 'conflict', message: 'sudah ada', existing: { id: 'x' }, conflictOn: 'rollbackStep' }));
    const err = (await createStep(draft).catch((e) => e)) as ApiError;
    expect(err).toMatchObject({ status: 409, existing: { id: 'x' }, conflictOn: 'rollbackStep' });
  });

  it('says the server is busy on a 503 and does not retry the write by itself', async () => {
    const fn = stub(json(503, { error: 'service_busy', message: 'x' }, { 'Retry-After': '2' }));
    const err = (await createStep(draft).catch((e) => e)) as ApiError;
    expect(err).toMatchObject({ status: 503, message: BUSY_MESSAGE });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('hides server detail on a 500 and on a network failure', async () => {
    stub(json(500, { error: 'internal_error', message: 'host db.internal down' }));
    expect(((await createStep(draft).catch((e) => e)) as ApiError).message).toBe(GENERIC_ERROR);
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));
    expect(((await listSteps().catch((e) => e)) as ApiError).message).toBe(GENERIC_ERROR);
  });

  it('falls back to a default message for a non-JSON error body', async () => {
    stub(new Response('<html>', { status: 404 }));
    expect(((await getStep('x').catch((e) => e)) as ApiError).message).toBe('Permintaan tidak valid.');
  });
});
