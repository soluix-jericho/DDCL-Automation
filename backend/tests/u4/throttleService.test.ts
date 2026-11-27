import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearThrottle, lockState, registerFailure } from '../../src/throttleService';
import { createTestPrisma, truncateAll } from '../helpers/db';

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

const fail = (email: string) =>
  prisma.$transaction(async (tx) => {
    const s = await lockState(tx, email);
    return s.locked ? 'locked' : (await registerFailure(tx, email)) ? 'just-locked' : 'counted';
  });

describe('ThrottleService (BR4.4, NFR2.24)', () => {
  it('creates the row on first sight, also for an email that has no account', async () => {
    const s = await prisma.$transaction((tx) => lockState(tx, 'ghost@x.test'));
    expect(s).toEqual({ locked: false, retryAfterSeconds: 0 });
    expect(await prisma.loginThrottle.count({ where: { email: 'ghost@x.test' } })).toBe(1);
  });

  it('locks on the 5th failure for 15 minutes and resets the counter', async () => {
    for (let i = 0; i < 4; i++) expect(await fail('a@x.test')).toBe('counted');
    expect(await fail('a@x.test')).toBe('just-locked');
    const row = await prisma.loginThrottle.findUniqueOrThrow({ where: { email: 'a@x.test' } });
    expect(row.failedCount).toBe(0);
    const secs = (await prisma.$queryRaw<Array<{ secs: number }>>`
      SELECT EXTRACT(EPOCH FROM ("lockedUntil" - (now() AT TIME ZONE 'UTC')))::float8 AS secs FROM "LoginThrottle" WHERE email = 'a@x.test'`)[0]!.secs;
    expect(secs).toBeGreaterThan(14 * 60);
    expect(secs).toBeLessThanOrEqual(15 * 60);
  });

  it('reports locked with a Retry-After between 1 and 900 seconds, without counting more failures', async () => {
    for (let i = 0; i < 5; i++) await fail('a@x.test');
    const s = await prisma.$transaction((tx) => lockState(tx, 'a@x.test'));
    expect(s.locked).toBe(true);
    expect(s.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(s.retryAfterSeconds).toBeLessThanOrEqual(900);
    expect(await fail('a@x.test')).toBe('locked');
  });

  it('treats an expired lock as unlocked', async () => {
    for (let i = 0; i < 5; i++) await fail('a@x.test');
    await prisma.$executeRaw`UPDATE "LoginThrottle" SET "lockedUntil" = (now() AT TIME ZONE 'UTC') - interval '1 second'`;
    expect((await prisma.$transaction((tx) => lockState(tx, 'a@x.test'))).locked).toBe(false);
  });

  it('keeps separate counters per email', async () => {
    for (let i = 0; i < 5; i++) await fail('a@x.test');
    expect(await fail('b@x.test')).toBe('counted');
  });

  it('clearThrottle removes the row (success or admin unlock) and is idempotent', async () => {
    for (let i = 0; i < 5; i++) await fail('a@x.test');
    await clearThrottle(prisma, 'a@x.test');
    await clearThrottle(prisma, 'a@x.test');
    expect(await prisma.loginThrottle.count()).toBe(0);
    expect(await fail('a@x.test')).toBe('counted');
  });
});
