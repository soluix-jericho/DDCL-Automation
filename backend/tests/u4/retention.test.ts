import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runRetention, startRetentionTimer } from '../../src/retention';
import { issueSession } from '../../src/sessionRepository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeUser } from './helpers';

let prisma: PrismaClient;
const log = { info: vi.fn(), warn: vi.fn() };
const NOW = `(now() AT TIME ZONE 'UTC')`;

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  log.info.mockClear();
  log.warn.mockClear();
});

describe('RetentionJob (NFR4.20)', () => {
  it('deletes sessions revoked or expired more than 7 days ago and keeps live and recent ones', async () => {
    const u = await makeUser(prisma);
    const live = await issueSession(prisma, u.id);
    const revokedOld = await issueSession(prisma, u.id);
    const revokedRecent = await issueSession(prisma, u.id);
    const idleOld = await issueSession(prisma, u.id);
    const ancient = await issueSession(prisma, u.id);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "revokedAt" = ${NOW} - interval '8 days' WHERE id = '${revokedOld.sessionId}'`);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "revokedAt" = ${NOW} - interval '6 days' WHERE id = '${revokedRecent.sessionId}'`);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '8 days' WHERE id = '${idleOld.sessionId}'`);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "createdAt" = ${NOW} - interval '15 days' WHERE id = '${ancient.sessionId}'`);
    const counts = await runRetention(prisma, log);
    expect(counts.sessions).toBe(3);
    const left = (await prisma.session.findMany()).map((s) => s.id).sort();
    expect(left).toEqual([live.sessionId, revokedRecent.sessionId].sort());
  });

  it('deletes stale throttle rows (unlocked and idle over 24 h) but keeps locked and fresh ones', async () => {
    await prisma.loginThrottle.createMany({ data: [{ email: 'stale@x.test' }, { email: 'fresh@x.test' }, { email: 'locked@x.test' }, { email: 'oldlock@x.test' }] });
    await prisma.$executeRawUnsafe(`UPDATE "LoginThrottle" SET "updatedAt" = ${NOW} - interval '25 hours' WHERE email IN ('stale@x.test','locked@x.test','oldlock@x.test')`);
    await prisma.$executeRawUnsafe(`UPDATE "LoginThrottle" SET "lockedUntil" = ${NOW} + interval '5 minutes' WHERE email = 'locked@x.test'`);
    await prisma.$executeRawUnsafe(`UPDATE "LoginThrottle" SET "lockedUntil" = ${NOW} - interval '1 hour' WHERE email = 'oldlock@x.test'`);
    const counts = await runRetention(prisma, log);
    expect(counts.throttles).toBe(2);
    expect((await prisma.loginThrottle.findMany()).map((t) => t.email).sort()).toEqual(['fresh@x.test', 'locked@x.test']);
  });

  it('deletes audit rows older than one year, in batches of 1000, and logs the counts', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AuditEvent" ("id","type","occurredAt") SELECT 'old' || g, 'logout', ${NOW} - interval '400 days' FROM generate_series(1, 2500) g`,
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO "AuditEvent" ("id","type","occurredAt") SELECT 'new' || g, 'logout', ${NOW} - interval '364 days' FROM generate_series(1, 5) g`,
    );
    const counts = await runRetention(prisma, log);
    expect(counts.auditEvents).toBe(2500);
    expect(await prisma.auditEvent.count()).toBe(5);
    expect(log.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'retention_run', auditEvents: 2500 }), expect.any(String));
  });

  it('skips rows another transaction holds locked instead of waiting for them', async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO "AuditEvent" ("id","type","occurredAt") VALUES ('held','logout', ${NOW} - interval '400 days'), ('free','logout', ${NOW} - interval '400 days')`);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AuditEvent" WHERE id = 'held' FOR UPDATE`;
      const counts = await runRetention(prisma, log); // a different connection: must not block on 'held'
      expect(counts.auditEvents).toBe(1);
      await held;
    });
    await new Promise((r) => setTimeout(r, 1500));
    release();
    await holder;
    expect((await prisma.auditEvent.findMany()).map((a) => a.id)).toEqual(['held']);
  });

  it('runs once right after start and only warns when a run fails', async () => {
    await prisma.$executeRawUnsafe(`INSERT INTO "AuditEvent" ("id","type","occurredAt") VALUES ('o','logout', ${NOW} - interval '400 days')`);
    const timer = startRetentionTimer(prisma, log, 3_600_000);
    await vi.waitFor(async () => expect(await prisma.auditEvent.count()).toBe(0));
    timer.stop();

    const broken = { $executeRaw: () => Promise.reject(new Error('db down')) } as unknown as PrismaClient;
    const t2 = startRetentionTimer(broken, log, 3_600_000);
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled());
    t2.stop();
  });
});
