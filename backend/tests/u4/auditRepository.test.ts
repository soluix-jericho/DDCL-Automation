import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateAuditQuery } from '../../src/accountRules';
import { listAuditEvents, writeAudit, writeAuditBestEffort } from '../../src/auditRepository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeUser } from './helpers';

let prisma: PrismaClient;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
});

const q = (o: Record<string, unknown> = {}) => validateAuditQuery(o);

describe('AuditWriter (BR4.20, NFR3.23)', () => {
  it('written inside a transaction, the row is rolled back with the caller', async () => {
    const u = await makeUser(prisma);
    await prisma
      .$transaction(async (tx) => {
        await writeAudit(tx, { type: 'account_created', actorUserId: u.id });
        throw new Error('rollback');
      })
      .catch(() => undefined);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('written inside a transaction, a failure propagates to the caller', async () => {
    await expect(writeAudit(prisma, { type: 'logout', actorUserId: 'no-such-user' })).rejects.toThrow();
  });

  it('best-effort mode logs a warning and never throws', async () => {
    const warn = vi.fn();
    await expect(writeAuditBestEffort(prisma, { type: 'logout', actorUserId: 'no-such-user' }, warn)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(await prisma.auditEvent.count()).toBe(0);
  });

  it('cuts detail to 500 and email to 254 characters', async () => {
    await writeAudit(prisma, { type: 'login_failed', detail: 'd'.repeat(900), email: 'e'.repeat(400) });
    const row = await prisma.auditEvent.findFirstOrThrow();
    expect(row.detail).toHaveLength(500);
    expect(row.email).toHaveLength(254);
  });
});

describe('listAuditEvents (NFR1.23)', () => {
  async function seed(n: number) {
    // Three rows share one timestamp so the (occurredAt, id) tie-break is exercised.
    for (let i = 0; i < n; i++) {
      await prisma.auditEvent.create({
        data: {
          id: `e${String(i).padStart(2, '0')}`,
          type: i % 2 === 0 ? 'login_failed' : 'login_success',
          occurredAt: new Date(Date.UTC(2026, 9, 1, 10, 0, Math.floor(i / 3))),
        },
      });
    }
  }

  it('lists newest first and pages with a stable cursor, with no gaps or repeats', async () => {
    await seed(10);
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 5; page++) {
      const r = await listAuditEvents(prisma, q({ limit: '4', ...(cursor ? { cursor } : {}) }));
      seen.push(...r.items.map((i) => i.id));
      if (!r.nextCursor) break;
      cursor = r.nextCursor;
    }
    expect(seen).toHaveLength(10);
    expect(new Set(seen).size).toBe(10);
    const all = await prisma.auditEvent.findMany({ orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] });
    expect(seen).toEqual(all.map((a) => a.id));
  });

  it('returns no cursor on the last page', async () => {
    await seed(3);
    const r = await listAuditEvents(prisma, q({ limit: '3' }));
    expect(r.items).toHaveLength(3);
    expect(r.nextCursor).toBeNull();
  });

  it('filters by type and by date range', async () => {
    await seed(10);
    const failed = await listAuditEvents(prisma, q({ type: 'login_failed', limit: '100' }));
    expect(failed.items.every((i) => i.type === 'login_failed')).toBe(true);
    expect(failed.items).toHaveLength(5);
    const day = await listAuditEvents(prisma, q({ from: '2026-10-01', to: '2026-10-01', limit: '100' }));
    expect(day.items).toHaveLength(10);
    const none = await listAuditEvents(prisma, q({ from: '2026-10-02', limit: '100' }));
    expect(none.items).toHaveLength(0);
  });

  it('rejects a limit above 100 before any query runs', () => {
    expect(() => q({ limit: '101' })).toThrow();
  });
});
