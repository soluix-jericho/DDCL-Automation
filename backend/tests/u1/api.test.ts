import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildApp, GENERIC_ERROR_MESSAGE, SESSION_COOKIE, XLSX_MIME } from '../../src/app';
import type { AppConfig } from '../../src/config';
import { createRepository } from '../../src/repository';
import { createTestPrisma, createUnreachablePrisma, truncateAll } from '../helpers/db';
import { buildFixtureTemplate, cleanTmp, readBack, TMP_DIR } from '../helpers/template';

const ORIGIN = 'http://localhost:5173';

let prisma: PrismaClient;
let templatePath: string;
let app: FastifyInstance;
const logged: Array<{ level: string; obj: unknown; msg?: string }> = [];

/** Minimal logger that records entries, so tests can assert on error-boundary fields (OBS1.2). */
function collectingLogger() {
  const make = (level: string) => (obj: unknown, msg?: string) => {
    logged.push({ level, obj, msg });
  };
  const logger = {
    level: 'info',
    fatal: make('fatal'),
    error: make('error'),
    warn: make('warn'),
    info: make('info'),
    debug: make('debug'),
    trace: make('trace'),
    silent: () => undefined,
    child: () => logger,
  };
  return logger;
}

function config(over: Partial<AppConfig> = {}): AppConfig {
  return { port: 0, frontendOrigin: ORIGIN, templatePath, ...over };
}

beforeAll(async () => {
  prisma = createTestPrisma();
  templatePath = await buildFixtureTemplate('api-template.xlsx');
});
afterAll(async () => {
  await prisma.$disconnect();
  await cleanTmp();
});
beforeEach(async () => {
  logged.length = 0;
  await truncateAll(prisma);
  app = await buildApp({ repo: createRepository(prisma), config: config(), logger: collectingLogger() });
});
afterEach(async () => {
  await app.close();
});

// U2: a step body carries kind and at least one non-empty line (BR2.1).
const stepPayload = (name: string, category: string) => ({
  name,
  category,
  kind: 'forward',
  columns: [{ lines: ['langkah'] }],
});

async function createStep(name = 'Update Image', category = 'Database') {
  const res = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: stepPayload(name, category) });
  return res.json() as { id: string };
}

describe('steps API', () => {
  it('creates a step (201) and lists it', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/steps',
      payload: stepPayload('Update Image', 'Database'),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ name: 'Update Image', kind: 'forward' });
    const list = await app.inject({ method: 'GET', url: '/api/v1/steps' });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toHaveLength(1);
  });

  it('returns 400 naming the empty fields and stores nothing (BR1.1)', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/steps', payload: { name: '' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().fields).toEqual(['name', 'category', 'columns', 'kind']);
    expect(await prisma.step.count()).toBe(0);
  });

  it('returns a clean 400 for malformed JSON', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/steps',
      headers: { 'content-type': 'application/json' },
      payload: '{bad json',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('DDCL API', () => {
  it('creates a Draft DDCL created by dev-user with header and tabLabel (BR1.2, BR1.3, BR1.7)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/ddcls',
      payload: { title: 'DDCL 1', releaseHeader: { date: '2026-10-26', environment: 'PROD' } },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ status: 'Draft', createdBy: 'dev-user', tabLabel: '2026-10-26' });
    expect(body.releaseHeader.environment).toBe('PROD');
  });

  it('rejects a DDCL without a title with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/ddcls', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('adds a checklist item (201) and 404s for unknown DDCL', async () => {
    const step = await createStep();
    const d = (
      await app.inject({ method: 'POST', url: '/api/v1/ddcls', payload: { title: 'T' } })
    ).json();
    const ok = await app.inject({
      method: 'POST',
      url: `/api/v1/ddcls/${d.id}/checklist-items`,
      payload: { stepId: step.id, parameterValues: { image: 'a:1' } },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ order: 1, parameterValues: { image: 'a:1' } });
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/ddcls/nope/checklist-items',
      payload: { stepId: step.id },
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe('export API', () => {
  async function ddclWithItem() {
    const step = await createStep();
    const d = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/ddcls',
        payload: { title: 'T', releaseHeader: { date: '2026-10-26', impactedSystem: 'CES' } },
      })
    ).json();
    await app.inject({
      method: 'POST',
      url: `/api/v1/ddcls/${d.id}/checklist-items`,
      payload: { stepId: step.id, parameterValues: { p: '=SUM(1)' } },
    });
    return d.id as string;
  }

  it('returns an .xlsx file (200) filled from the DDCL', async () => {
    const id = await ddclWithItem();
    const res = await app.inject({ method: 'GET', url: `/api/v1/ddcls/${id}/export` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe(XLSX_MIME);
    expect(res.headers['content-disposition']).toContain('.xlsx');
    const wb = await readBack(res.rawPayload);
    expect(wb.getWorksheet('Release Document')!.getCell('H8').value).toBe('CES');
    expect(wb.getWorksheet('Deployment Check List')!.getCell('B13').value).toBe('Update Image');
    expect(wb.getWorksheet('List Object & Parameter')!.getCell('I7').value).toBe('=SUM(1)');
  });

  it('returns 404 for an unknown DDCL', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/ddcls/nope/export' });
    expect(res.statusCode).toBe(404);
  });

  it('fails with a clear message naming the expected path when the template is missing (BR1.4)', async () => {
    const missing = path.join(TMP_DIR, 'absent.xlsx');
    const other = await buildApp({
      repo: createRepository(prisma),
      config: config({ templatePath: missing }),
      logger: collectingLogger(),
    });
    try {
      const id = await ddclWithItem();
      const res = await other.inject({ method: 'GET', url: `/api/v1/ddcls/${id}/export` });
      expect(res.statusCode).toBe(500);
      expect(res.json().message).toContain(missing);
      expect(res.headers['content-type']).not.toBe(XLSX_MIME);
    } finally {
      await other.close();
    }
  });
});

describe('error handling when the database is unreachable (BR1.5, NFR3.2)', () => {
  it('returns a generic 500 without infrastructure details and logs operation + err', async () => {
    const bad = createUnreachablePrisma();
    const badApp = await buildApp({
      repo: createRepository(bad),
      config: config(),
      logger: collectingLogger(),
    });
    try {
      const res = await badApp.inject({
        method: 'POST',
        url: '/api/v1/steps',
        payload: stepPayload('X', 'Database'),
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: 'internal_error', message: GENERIC_ERROR_MESSAGE });
      expect(res.body).not.toMatch(/127\.0\.0\.1|nobody|postgres|prisma/i);
      const entry = logged.find((l) => l.level === 'error');
      expect(entry?.obj).toMatchObject({ operation: 'createStep', method: 'POST' });
      expect((entry?.obj as { err: unknown }).err).toBeDefined();
    } finally {
      await badApp.close();
      await bad.$disconnect();
    }
  });
});

describe('health endpoint', () => {
  it('reports ok when the database is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('reports 503 unhealthy when the database is unreachable', async () => {
    const bad = createUnreachablePrisma();
    const badApp = await buildApp({ repo: createRepository(bad), config: config(), logger: false });
    try {
      const res = await badApp.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ status: 'unhealthy' });
    } finally {
      await badApp.close();
      await bad.$disconnect();
    }
  });
});

describe('session cookie stub and CORS (NFR2.1, NFR2.2)', () => {
  it('sets an HTTP-only session cookie when none is sent and never rejects', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/steps' });
    expect(res.statusCode).toBe(200);
    const setCookie = String(res.headers['set-cookie']);
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('does not reset the cookie when one is already present', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/steps',
      headers: { cookie: `${SESSION_COOKIE}=dev-session` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('allows credentials only for the configured frontend origin', async () => {
    const ok = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/steps',
      headers: { origin: ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const other = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/steps',
      headers: { origin: 'http://evil.test', 'access-control-request-method': 'POST' },
    });
    expect(other.headers['access-control-allow-origin']).not.toBe('http://evil.test');
  });
});
