import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findValidSession,
  issueSession,
  revokeAllForUser,
  revokeByToken,
  revokeSession,
  touchSession,
} from '../../src/sessionRepository';
import { hashToken } from '../../src/sessionToken';
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

const valid = (token: string) => findValidSession(prisma, hashToken(token));
const NOW = `(now() AT TIME ZONE 'UTC')`;

describe('sessions (BR4.5, BR4.6)', () => {
  it('issues a session whose token is stored only as a SHA-256 hash and finds it with the user and role', async () => {
    const u = await makeUser(prisma, { role: 'editor', name: 'Ana' });
    const { token, sessionId } = await issueSession(prisma, u.id);
    const row = await prisma.session.findUniqueOrThrow({ where: { id: sessionId } });
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    const found = await valid(token);
    expect(found).toEqual({ sessionId, user: { id: u.id, name: 'Ana', email: u.email, role: 'editor' } });
  });

  it('knows nothing about an unknown token', async () => {
    expect(await valid('tidak-ada')).toBeNull();
    expect(await valid('dev-session')).toBeNull();
  });

  it('expires after 8 hours without activity but not before', async () => {
    const u = await makeUser(prisma);
    const { token, sessionId } = await issueSession(prisma, u.id);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '7 hours 59 minutes' WHERE id = '${sessionId}'`);
    expect(await valid(token)).not.toBeNull();
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '8 hours 1 minute' WHERE id = '${sessionId}'`);
    expect(await valid(token)).toBeNull();
  });

  it('expires 7 days after login even when the session is active', async () => {
    const u = await makeUser(prisma);
    const { token, sessionId } = await issueSession(prisma, u.id);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "createdAt" = ${NOW} - interval '6 days 23 hours' WHERE id = '${sessionId}'`);
    expect(await valid(token)).not.toBeNull();
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "createdAt" = ${NOW} - interval '7 days 1 hour' WHERE id = '${sessionId}'`);
    expect(await valid(token)).toBeNull();
  });

  it('is invalid once revoked, and for an inactive user', async () => {
    const u = await makeUser(prisma);
    const a = await issueSession(prisma, u.id);
    const b = await issueSession(prisma, u.id);
    await revokeSession(prisma, a.sessionId);
    expect(await valid(a.token)).toBeNull();
    expect(await valid(b.token)).not.toBeNull();
    await prisma.user.update({ where: { id: u.id }, data: { status: 'inactive' } });
    expect(await valid(b.token)).toBeNull();
  });

  it('reads the role from the database on every lookup', async () => {
    const u = await makeUser(prisma, { role: 'admin' });
    const { token } = await issueSession(prisma, u.id);
    await prisma.user.update({ where: { id: u.id }, data: { role: 'viewer' } });
    expect((await valid(token))!.user.role).toBe('viewer');
  });

  it('moves lastSeenAt at most once per minute', async () => {
    const u = await makeUser(prisma);
    const { sessionId } = await issueSession(prisma, u.id);
    const warn = vi.fn();
    const seen = async () => (await prisma.session.findUniqueOrThrow({ where: { id: sessionId } })).lastSeenAt.getTime();
    const first = await seen();
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '30 seconds' WHERE id = '${sessionId}'`);
    const recent = await seen();
    await touchSession(prisma, sessionId, warn);
    expect(await seen()).toBe(recent);
    await prisma.$executeRawUnsafe(`UPDATE "Session" SET "lastSeenAt" = ${NOW} - interval '2 minutes' WHERE id = '${sessionId}'`);
    const old = await seen();
    await touchSession(prisma, sessionId, warn);
    expect(await seen()).toBeGreaterThan(old);
    expect(first).toBeGreaterThan(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('turns a failing touch into a warning, never an error', async () => {
    const warn = vi.fn();
    const broken = { $executeRaw: () => Promise.reject(new Error('db down')) } as unknown as PrismaClient;
    await expect(touchSession(broken, 'x', warn)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('revokes all sessions of a user except the one in use, and by token', async () => {
    const u = await makeUser(prisma);
    const other = await makeUser(prisma);
    const keep = await issueSession(prisma, u.id);
    const drop = await issueSession(prisma, u.id);
    const foreign = await issueSession(prisma, other.id);
    await revokeAllForUser(prisma, u.id, keep.sessionId);
    expect(await valid(keep.token)).not.toBeNull();
    expect(await valid(drop.token)).toBeNull();
    expect(await valid(foreign.token)).not.toBeNull();
    await revokeAllForUser(prisma, u.id);
    expect(await valid(keep.token)).toBeNull();
    await revokeByToken(prisma, foreign.token);
    expect(await valid(foreign.token)).toBeNull();
  });
});
