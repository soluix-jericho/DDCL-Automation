import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountConflictError, TooManyAttemptsError, UnauthorizedError } from '../../src/errors';
import type { PasswordService } from '../../src/passwordService';
import { createRepository } from '../../src/repository';
import { createTestPrisma, truncateAll } from '../helpers/db';
import { cheapPasswords, makeUser, TEST_PASSWORD } from './helpers';

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

const outcome = (p: Promise<unknown>) =>
  p.then(
    () => 'ok',
    (e: unknown) =>
      e instanceof UnauthorizedError ? '401' : e instanceof TooManyAttemptsError ? '429' : e instanceof AccountConflictError ? '409' : `error:${String(e)}`,
  );

describe('concurrent logins (BR4.4, NFR2.24)', () => {
  it('8 parallel wrong passwords for one email yield at most 5 failures; the rest are 429 and the email ends up locked', async () => {
    const repo = createRepository(prisma, { passwords: cheapPasswords });
    await makeUser(prisma, { email: 'ana@x.test', password: TEST_PASSWORD });
    const results = await Promise.all(
      Array.from({ length: 8 }, () => outcome(repo.login('ana@x.test', 'salah-salah-1', null))),
    );
    expect(results.filter((r) => r === '401')).toHaveLength(5);
    expect(results.filter((r) => r === '429')).toHaveLength(3);
    expect(results.filter((r) => r.startsWith('error'))).toEqual([]);
    expect(await prisma.session.count()).toBe(0);
    await expect(repo.login('ana@x.test', TEST_PASSWORD, null)).rejects.toBeInstanceOf(TooManyAttemptsError);
    expect(await prisma.auditEvent.count({ where: { type: 'login_locked' } })).toBe(1);
  });

  it('a correct login whose hash finishes after another request locked the email is answered 429 and issues no session', async () => {
    let release!: () => void;
    const hold = new Promise<void>((r) => (release = r));
    const slowCorrect: PasswordService = {
      ...cheapPasswords,
      async verify(pw, stored) {
        const ok = await cheapPasswords.verify(pw, stored);
        if (pw === TEST_PASSWORD) await hold; // the right password is still "hashing" while the lock lands
        return ok;
      },
    };
    const repo = createRepository(prisma, { passwords: slowCorrect });
    await makeUser(prisma, { email: 'ana@x.test', password: TEST_PASSWORD });
    await prisma.loginThrottle.create({ data: { email: 'ana@x.test', failedCount: 4 } });

    const correct = outcome(repo.login('ana@x.test', TEST_PASSWORD, null));
    await new Promise((r) => setTimeout(r, 300)); // it has passed check A and waits inside verify
    expect(await outcome(repo.login('ana@x.test', 'salah-salah-1', null))).toBe('401'); // 5th failure sets the lock
    release();
    expect(await correct).toBe('429');
    expect(await prisma.session.count()).toBe(0);
  });
});

describe('concurrent account changes (BR4.13, BR4.14, BR4.19)', () => {
  it('two admins deactivating each other: exactly one 409, and at least one active admin remains', async () => {
    const repo = createRepository(prisma, { passwords: cheapPasswords });
    const a = await makeUser(prisma, { role: 'admin' });
    const b = await makeUser(prisma, { role: 'admin' });
    for (let round = 0; round < 3; round++) {
      await prisma.user.updateMany({ data: { status: 'active', role: 'admin' } });
      const results = await Promise.all([
        outcome(repo.patchUser(a.id, b.id, { status: 'inactive' }, null)),
        outcome(repo.patchUser(b.id, a.id, { status: 'inactive' }, null)),
      ]);
      expect(results.filter((r) => r === '409')).toHaveLength(1);
      expect(results.filter((r) => r === 'ok')).toHaveLength(1);
      expect(await prisma.user.count({ where: { role: 'admin', status: 'active' } })).toBeGreaterThanOrEqual(1);
    }
  });

  it('two admins demoting each other: exactly one 409 and one admin left', async () => {
    const repo = createRepository(prisma, { passwords: cheapPasswords });
    const a = await makeUser(prisma, { role: 'admin' });
    const b = await makeUser(prisma, { role: 'admin' });
    const results = await Promise.all([
      outcome(repo.patchUser(a.id, b.id, { role: 'viewer' }, null)),
      outcome(repo.patchUser(b.id, a.id, { role: 'viewer' }, null)),
    ]);
    expect(results.sort()).toEqual(['409', 'ok']);
    expect(await prisma.user.count({ where: { role: 'admin', status: 'active' } })).toBe(1);
  });

  it('opposite role changes on one account both succeed and leave one of the two roles', async () => {
    const repo = createRepository(prisma, { passwords: cheapPasswords });
    const admin = await makeUser(prisma, { role: 'admin' });
    const t = await makeUser(prisma, { role: 'viewer' });
    const results = await Promise.all([
      outcome(repo.patchUser(admin.id, t.id, { role: 'editor' }, null)),
      outcome(repo.patchUser(admin.id, t.id, { role: 'admin' }, null)),
    ]);
    expect(results).toEqual(['ok', 'ok']);
    expect(['editor', 'admin']).toContain((await prisma.user.findUniqueOrThrow({ where: { id: t.id } })).role);
  });

  it('deactivating and re-roling the same account at once never half-applies and never answers 500', async () => {
    const repo = createRepository(prisma, { passwords: cheapPasswords });
    const admin = await makeUser(prisma, { role: 'admin' });
    const t = await makeUser(prisma, { role: 'editor' });
    const results = await Promise.all([
      outcome(repo.patchUser(admin.id, t.id, { status: 'inactive' }, null)),
      outcome(repo.patchUser(admin.id, t.id, { role: 'viewer' }, null)),
    ]);
    expect(results.filter((r) => r.startsWith('error'))).toEqual([]);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: t.id } });
    expect(row.status).toBe('inactive');
    expect(['editor', 'viewer']).toContain(row.role);
  });
});
