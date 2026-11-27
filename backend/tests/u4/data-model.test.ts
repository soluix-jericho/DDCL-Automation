import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { makeSession, makeUser } from './helpers';

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

const code = async (p: Promise<unknown>) =>
  ((await p.catch((e) => e)) as Prisma.PrismaClientKnownRequestError).code;

describe('U4 data model (database behaviour)', () => {
  it('defaults User.status to active and counters of LoginThrottle to zero', async () => {
    const u = await prisma.user.create({
      data: { name: 'A', email: 'a@x.test', passwordHash: 'h', role: 'viewer' },
    });
    expect(u.status).toBe('active');
    expect(u.lastLoginAt).toBeNull();
    expect(u.createdAt).toBeInstanceOf(Date);
    const t = await prisma.loginThrottle.create({ data: { email: 'a@x.test' } });
    expect(t.failedCount).toBe(0);
    expect(t.lockedUntil).toBeNull();
  });

  it('rejects a second user with the same email', async () => {
    await makeUser(prisma, { email: 'dup@x.test' });
    expect(await code(makeUser(prisma, { email: 'dup@x.test' }))).toBe('P2002');
  });

  it('rejects an unknown role value', async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "User" ("id","name","email","passwordHash","role","updatedAt") VALUES ('u1','n','e@x.test','h','root', now())`,
      ),
    ).rejects.toThrow();
  });

  it('keeps tokenHash unique', async () => {
    const u = await makeUser(prisma);
    await prisma.session.create({ data: { userId: u.id, tokenHash: 'same' } });
    expect(await code(prisma.session.create({ data: { userId: u.id, tokenHash: 'same' } }))).toBe('P2002');
  });

  it('rejects a Session or DdclDocument pointing at a missing user (foreign keys)', async () => {
    expect(await code(prisma.session.create({ data: { userId: 'nope', tokenHash: 't' } }))).toBe('P2003');
    expect(await code(prisma.ddclDocument.create({ data: { title: 'D', createdByUserId: 'nope' } }))).toBe(
      'P2003',
    );
  });

  it('never deletes a user that has DDCLs, sessions or audit rows (RESTRICT)', async () => {
    const u = await makeUser(prisma);
    await prisma.ddclDocument.create({ data: { title: 'D', createdByUserId: u.id } });
    expect(await code(prisma.user.delete({ where: { id: u.id } }))).toBe('P2003');

    const v = await makeUser(prisma);
    await makeSession(prisma, v.id);
    expect(await code(prisma.user.delete({ where: { id: v.id } }))).toBe('P2003');

    const w = await makeUser(prisma);
    await prisma.auditEvent.create({ data: { type: 'logout', actorUserId: w.id } });
    expect(await code(prisma.user.delete({ where: { id: w.id } }))).toBe('P2003');
  });

  it('lets DdclDocument.createdByUserId stay NULL in the database (enforced by the application)', async () => {
    const d = await prisma.ddclDocument.create({ data: { title: 'D' } });
    expect(d.createdByUserId).toBeNull();
  });

  it('rejects AuditEvent.detail longer than 500 characters', async () => {
    await expect(
      prisma.auditEvent.create({ data: { type: 'login_failed', detail: 'x'.repeat(501) } }),
    ).rejects.toThrow();
    const ok = await prisma.auditEvent.create({ data: { type: 'login_failed', detail: 'x'.repeat(500) } });
    expect(ok.occurredAt).toBeInstanceOf(Date);
  });

  it('has the audit list indexes and the Session.userId index', async () => {
    const rows = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('AuditEvent', 'Session')`;
    const defs = rows.map((r) => r.indexdef);
    expect(defs.some((d) => /"AuditEvent".*\("occurredAt" DESC, id DESC\)/.test(d) || /occurredAt.* DESC, .*id.* DESC/.test(d))).toBe(true);
    expect(defs.some((d) => /\(type, "occurredAt" DESC, id DESC\)/.test(d))).toBe(true);
    expect(defs.some((d) => /Session.*\("userId"\)/.test(d))).toBe(true);
    expect(defs.some((d) => /UNIQUE.*\("tokenHash"\)/.test(d))).toBe(true);
  });
});
