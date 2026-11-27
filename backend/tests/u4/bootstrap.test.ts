import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { backfillCreatedBy, bootstrapAdmin, PLACEHOLDER_PASSWORD } from '../../src/bootstrap';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { cheapPasswords, makeUser } from './helpers';

let prisma: PrismaClient;
const log = { info: vi.fn() };
const SECRET = 'rahasia-awal-admin-1';
const admin = (over: Record<string, string> = {}) => ({
  admin: { email: 'Admin@Example.test', password: SECRET, name: '', ...over },
});

beforeAll(() => {
  prisma = createTestPrisma();
});
afterAll(async () => {
  await prisma.$disconnect();
});
beforeEach(async () => {
  await truncateAll(prisma);
  log.info.mockClear();
});

describe('bootstrapAdmin (BR4.11)', () => {
  it('creates the first admin (active, lowercase email, name from the local part) when no user exists', async () => {
    const r = await bootstrapAdmin(prisma, admin(), cheapPasswords, log);
    expect(r.created).toBe(true);
    const u = await prisma.user.findFirstOrThrow();
    expect(u).toMatchObject({ email: 'admin@example.test', name: 'admin', role: 'admin', status: 'active' });
    expect(await cheapPasswords.verify(SECRET, u.passwordHash)).toBe(true);
    expect(JSON.stringify(log.info.mock.calls)).not.toContain(SECRET);
  });

  it('uses ADMIN_NAME when given', async () => {
    await bootstrapAdmin(prisma, admin({ name: 'Kepala Tim' }), cheapPasswords, log);
    expect((await prisma.user.findFirstOrThrow()).name).toBe('Kepala Tim');
  });

  it('ignores ADMIN_* completely once any user exists', async () => {
    const existing = await makeUser(prisma, { role: 'viewer' });
    const r = await bootstrapAdmin(prisma, admin({ password: 'x' }), cheapPasswords, log);
    expect(r.created).toBe(false);
    expect(await prisma.user.count()).toBe(1);
    expect((await prisma.user.findFirstOrThrow()).id).toBe(existing.id);
  });

  it.each([
    ['missing', null, /ADMIN_EMAIL dan ADMIN_PASSWORD/],
    ['empty password', { email: 'a@b.test', password: '', name: '' }, /ADMIN_EMAIL dan ADMIN_PASSWORD/],
    ['bad email', { email: 'bukan-email', password: SECRET, name: '' }, /ADMIN_EMAIL/],
    ['too short', { email: 'a@b.test', password: 'pendek', name: '' }, /ADMIN_PASSWORD/],
    ['placeholder', { email: 'a@b.test', password: PLACEHOLDER_PASSWORD, name: '' }, /ADMIN_PASSWORD/],
  ])('fails fast and names the variable, never the value (%s)', async (_n, cfg, pattern) => {
    const err = await bootstrapAdmin(prisma, { admin: cfg }, cheapPasswords, log).catch((e) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(pattern);
    for (const v of [SECRET, PLACEHOLDER_PASSWORD, 'pendek']) expect((err as Error).message).not.toContain(v);
    expect(await prisma.user.count()).toBe(0);
  });

  it('creates exactly one admin when two instances start at the same time', async () => {
    const results = await Promise.all([
      bootstrapAdmin(prisma, admin(), cheapPasswords, log),
      bootstrapAdmin(prisma, admin(), cheapPasswords, log),
    ]).catch(async (e) => {
      // The loser of a unique-email race may surface as an error; the database must still hold one admin.
      return [e];
    });
    expect(results.length).toBeGreaterThan(0);
    expect(await prisma.user.count()).toBe(1);
  });
});

describe('backfillCreatedBy (BR4.16)', () => {
  it('fills only empty rows with the earliest admin (id breaks ties) and is idempotent', async () => {
    const early = await prisma.user.create({
      data: { name: 'E', email: 'e@x.test', passwordHash: 'h', role: 'admin', createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    await prisma.user.create({
      data: { name: 'L', email: 'l@x.test', passwordHash: 'h', role: 'admin', createdAt: new Date('2026-06-01T00:00:00Z') },
    });
    const editor = await makeUser(prisma, { role: 'editor' });
    await prisma.ddclDocument.create({ data: { id: 'old1', title: 'A' } });
    await prisma.ddclDocument.create({ data: { id: 'old2', title: 'B' } });
    await prisma.ddclDocument.create({ data: { id: 'own', title: 'C', createdByUserId: editor.id } });
    expect((await backfillCreatedBy(prisma)).filled).toBe(2);
    expect((await prisma.ddclDocument.findUniqueOrThrow({ where: { id: 'old1' } })).createdByUserId).toBe(early.id);
    expect((await prisma.ddclDocument.findUniqueOrThrow({ where: { id: 'own' } })).createdByUserId).toBe(editor.id);
    expect((await backfillCreatedBy(prisma)).filled).toBe(0);
  });

  it('does nothing and passes when no DDCL is empty, even without any admin', async () => {
    expect((await backfillCreatedBy(prisma)).filled).toBe(0);
  });

  it('aborts when empty rows exist but there is no admin to fill them with', async () => {
    await prisma.ddclDocument.create({ data: { id: 'old1', title: 'A' } });
    await expect(backfillCreatedBy(prisma)).rejects.toThrow(/admin/);
    expect((await prisma.ddclDocument.findUniqueOrThrow({ where: { id: 'old1' } })).createdByUserId).toBeNull();
  });
});
